import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { getAsaasTransfer } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidationPayload = {
  type?: string;
  transfer?: { id?: string };
};

type ExpectedTransfer = {
  kind: "withdrawal" | "prize" | "batch";
  id: string;
  status: string;
  paymentReference: string | null;
  asaasTransferId: string | null;
  amountCents: number;
  pixKey: string | null;
  pixKeyType: string | null;
  reviewerId: string | null;
};

function tokenMatches(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function decision(status: "APPROVED" | "REFUSED", refuseReason?: string) {
  return NextResponse.json(
    status === "APPROVED" ? { status } : { status, refuseReason },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}

function normalizePix(value: string, type: string) {
  return ["CPF", "CNPJ", "PHONE"].includes(type)
    ? value.replace(/\\D/g, "")
    : value.trim().toLowerCase();
}

function beneficiaryMatches(expected: ExpectedTransfer, actual: string | null | undefined) {
  return Boolean(
    expected.pixKey &&
    expected.pixKeyType &&
    actual &&
    normalizePix(expected.pixKey, expected.pixKeyType) === normalizePix(actual, expected.pixKeyType),
  );
}

async function findExpectedTransfer(externalReference: string): Promise<ExpectedTransfer | null> {
  if (externalReference.startsWith("wallet_withdrawal_")) {
    const id = externalReference.slice("wallet_withdrawal_".length);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return null;
    const row = await authPrisma.withdrawal.findUnique({
      where: { id },
      select: {
        id: true, status: true, paymentReference: true, asaasTransferId: true,
        amountCents: true, pixKey: true, pixKeyType: true, reviewedById: true,
      },
    });
    if (!row || row.paymentReference !== externalReference) return null;
    return {
      kind: "withdrawal", id: row.id, status: row.status,
      paymentReference: row.paymentReference, asaasTransferId: row.asaasTransferId,
      amountCents: row.amountCents, pixKey: row.pixKey, pixKeyType: row.pixKeyType,
      reviewerId: row.reviewedById,
    };
  }

  if (externalReference.startsWith("prize_batch_")) {
    const id = externalReference.slice("prize_batch_".length);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return null;
    const row = await authPrisma.prizePaymentBatch.findUnique({
      where: { id },
      select: {
        id: true, status: true, paymentReference: true, asaasTransferId: true,
        netCents: true, pixKey: true, pixKeyType: true, reviewerId: true,
      },
    });
    if (!row || row.paymentReference !== externalReference) return null;
    return {
      kind: "batch", id: row.id, status: row.status,
      paymentReference: row.paymentReference, asaasTransferId: row.asaasTransferId,
      amountCents: row.netCents, pixKey: row.pixKey, pixKeyType: row.pixKeyType,
      reviewerId: row.reviewerId,
    };
  }

  if (externalReference.startsWith("prize_request_")) {
    const id = externalReference.slice("prize_request_".length);
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(id)) return null;
    const row = await authPrisma.prizePaymentRequest.findUnique({
      where: { id },
      select: {
        id: true, status: true, paymentReference: true, asaasTransferId: true,
        netCents: true, pixKey: true, pixKeyType: true, reviewerId: true,
      },
    });
    if (!row || row.paymentReference !== externalReference) return null;
    return {
      kind: "prize", id: row.id, status: row.status,
      paymentReference: row.paymentReference, asaasTransferId: row.asaasTransferId,
      amountCents: row.netCents, pixKey: row.pixKey, pixKeyType: row.pixKeyType,
      reviewerId: row.reviewerId,
    };
  }

  return null;
}

async function attachTransfer(expected: ExpectedTransfer, transferId: string, status: string) {
  if (expected.kind === "withdrawal") {
    return authPrisma.withdrawal.updateMany({
      where: {
        id: expected.id, status: "PROCESSING", paymentReference: expected.paymentReference,
        OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }],
      },
      data: { asaasTransferId: transferId, asaasTransferStatus: status },
    });
  }
  if (expected.kind === "batch") {
    const changed = await authPrisma.prizePaymentBatch.updateMany({
      where: {
        id: expected.id, status: "PROCESSING", paymentReference: expected.paymentReference,
        OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }],
      },
      data: { asaasTransferId: transferId, asaasTransferStatus: status },
    });
    if (changed.count === 1) {
      await authPrisma.prizePaymentRequest.updateMany({
        where: { batchId: expected.id, status: "PROCESSING" },
        data: { asaasTransferId: transferId, asaasTransferStatus: status },
      });
    }
    return changed;
  }
  return authPrisma.prizePaymentRequest.updateMany({
    where: {
      id: expected.id, status: "PROCESSING", paymentReference: expected.paymentReference,
      OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }],
    },
    data: { asaasTransferId: transferId, asaasTransferStatus: status },
  });
}

/**
 * Asaas calls this endpoint before executing API-originated withdrawals.
 * Only transfers previously initiated and recorded by Super Sena are approved.
 * Approval here does not mark a prize as paid; TRANSFER_DONE still does that.
 */
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WITHDRAWAL_VALIDATION_TOKEN?.trim();
  if (!token || token.length < 32 || token.length > 255 || /\\s/.test(token)) {
    return decision("REFUSED", "Validação de transferência não configurada.");
  }
  if (!tokenMatches(request.headers.get("asaas-access-token"), token)) {
    return decision("REFUSED", "Autenticação inválida.");
  }

  let body: ValidationPayload;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return decision("REFUSED", "Solicitação inválida.");
    body = parsed as ValidationPayload;
  } catch {
    return decision("REFUSED", "Solicitação inválida.");
  }

  if (body.type !== "TRANSFER" || typeof body.transfer?.id !== "string" || !body.transfer.id.trim()) {
    return decision("REFUSED", "Operação não reconhecida.");
  }

  let canonical;
  try {
    canonical = await getAsaasTransfer(body.transfer.id.trim());
  } catch {
    return NextResponse.json({ error: "Não foi possível validar a transferência." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }

  if (canonical.id !== body.transfer.id.trim() || !canonical.externalReference ||
      canonical.operationType !== "PIX" || !Number.isFinite(canonical.value)) {
    return decision("REFUSED", "Transferência não corresponde a uma solicitação Pix válida.");
  }

  try {
    const expected = await findExpectedTransfer(canonical.externalReference);
    if (!expected || expected.status !== "PROCESSING" || !expected.reviewerId ||
        (expected.asaasTransferId && expected.asaasTransferId !== canonical.id) ||
        !Number.isSafeInteger(expected.amountCents) ||
        Math.round((canonical.value ?? 0) * 100) !== expected.amountCents ||
        !beneficiaryMatches(expected, canonical.bankAccount?.pixAddressKey)) {
      return decision("REFUSED", "Transferência não corresponde a uma solicitação autorizada.");
    }

    const attached = await attachTransfer(expected, canonical.id, canonical.status);
    if (attached.count !== 1) {
      return decision("REFUSED", "A solicitação não está mais disponível para autorização.");
    }

    return decision("APPROVED");
  } catch {
    return NextResponse.json({ error: "Falha ao validar a transferência." }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
