import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ValidationPayload = {
  type?: string;
  transfer?: {
    id?: string;
    externalReference?: string | null;
    value?: number;
    operationType?: string;
    bankAccount?: { pixAddressKey?: string | null } | null;
  };
};

function tokenMatches(received: string | null, expected: string) {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function normalizePix(value: string, type: string) {
  return ["CPF", "CNPJ", "PHONE"].includes(type)
    ? value.replace(/\D/g, "")
    : value.trim().toLowerCase();
}

function validTransfer(payload: ValidationPayload) {
  const transfer = payload.transfer;
  return payload.type === "TRANSFER" && !!transfer?.id?.trim() &&
    !!transfer.externalReference?.trim() &&
    Number.isFinite(transfer.value) && (transfer.value ?? 0) > 0 &&
    transfer.operationType === "PIX";
}

function refuse(reason: string) {
  return NextResponse.json({ status: "REFUSED", refuseReason: reason }, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const expectedToken = process.env.ASAAS_WITHDRAWAL_VALIDATION_TOKEN?.trim();
  if (!expectedToken || expectedToken.length < 32 ||
      !tokenMatches(request.headers.get("asaas-access-token"), expectedToken)) {
    return NextResponse.json({ error: "Autenticação inválida." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  let payload: ValidationPayload;
  try {
    payload = await request.json() as ValidationPayload;
  } catch {
    return refuse("Payload inválido.");
  }
  if (!validTransfer(payload)) return refuse("Operação não reconhecida.");

  const transfer = payload.transfer!;
  const transferId = transfer.id!.trim();
  const externalReference = transfer.externalReference!.trim();
  const valueCents = Math.round((transfer.value ?? 0) * 100);
  const actualPix = transfer.bankAccount?.pixAddressKey?.trim();
  if (!actualPix || !Number.isSafeInteger(valueCents) || valueCents <= 0) {
    return refuse("Não foi possível validar o favorecido ou o valor.");
  }

  try {
    const decision = await authPrisma.$transaction(async tx => {
      const batch = await tx.prizePaymentBatch.findFirst({
        where: { OR: [{ paymentReference: externalReference }, { asaasTransferId: transferId }] },
        select: { id: true, status: true, paymentReference: true, asaasTransferId: true, netCents: true, pixKey: true, pixKeyType: true },
      });
      if (batch) {
        const valid = batch.status === "PROCESSING" &&
          batch.paymentReference === externalReference &&
          (!batch.asaasTransferId || batch.asaasTransferId === transferId) &&
          batch.netCents === valueCents && !!batch.pixKey && !!batch.pixKeyType &&
          normalizePix(batch.pixKey, batch.pixKeyType) === normalizePix(actualPix, batch.pixKeyType);
        if (!valid) return { approved: false, entityType: "PrizePaymentBatch", entityId: batch.id, reason: "Lote não corresponde à transferência registrada." };
        await tx.prizePaymentBatch.updateMany({
          where: { id: batch.id, status: "PROCESSING", paymentReference: externalReference, OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }] },
          data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
        });
        await tx.auditEvent.create({ data: { action: "ASAAS_TRANSFER_VALIDATION_APPROVED", entityType: "PrizePaymentBatch", entityId: batch.id, metadata: { transferId, externalReference, valueCents } } });
        return { approved: true, entityType: "PrizePaymentBatch", entityId: batch.id };
      }

      const prizeRequest = await tx.prizePaymentRequest.findFirst({
        where: { OR: [{ paymentReference: externalReference }, { asaasTransferId: transferId }] },
        select: { id: true, status: true, paymentReference: true, asaasTransferId: true, netCents: true, pixKey: true, pixKeyType: true },
      });
      if (prizeRequest) {
        const valid = prizeRequest.status === "PROCESSING" &&
          prizeRequest.paymentReference === externalReference &&
          (!prizeRequest.asaasTransferId || prizeRequest.asaasTransferId === transferId) &&
          prizeRequest.netCents === valueCents && !!prizeRequest.pixKey && !!prizeRequest.pixKeyType &&
          normalizePix(prizeRequest.pixKey, prizeRequest.pixKeyType) === normalizePix(actualPix, prizeRequest.pixKeyType);
        if (!valid) return { approved: false, entityType: "PrizePaymentRequest", entityId: prizeRequest.id, reason: "Solicitação não corresponde à transferência registrada." };
        await tx.prizePaymentRequest.updateMany({
          where: { id: prizeRequest.id, status: "PROCESSING", paymentReference: externalReference, OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }] },
          data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
        });
        await tx.auditEvent.create({ data: { action: "ASAAS_TRANSFER_VALIDATION_APPROVED", entityType: "PrizePaymentRequest", entityId: prizeRequest.id, metadata: { transferId, externalReference, valueCents } } });
        return { approved: true, entityType: "PrizePaymentRequest", entityId: prizeRequest.id };
      }

      const withdrawal = await tx.withdrawal.findFirst({
        where: { OR: [{ paymentReference: externalReference }, { asaasTransferId: transferId }] },
        select: { id: true, status: true, paymentReference: true, asaasTransferId: true, amountCents: true, pixKey: true, pixKeyType: true, reviewedById: true },
      });
      if (withdrawal) {
        const valid = withdrawal.status === "PROCESSING" && !!withdrawal.reviewedById &&
          withdrawal.paymentReference === externalReference &&
          (!withdrawal.asaasTransferId || withdrawal.asaasTransferId === transferId) &&
          withdrawal.amountCents === valueCents && !!withdrawal.pixKey && !!withdrawal.pixKeyType &&
          normalizePix(withdrawal.pixKey, withdrawal.pixKeyType) === normalizePix(actualPix, withdrawal.pixKeyType);
        if (!valid) return { approved: false, entityType: "Withdrawal", entityId: withdrawal.id, reason: "Saque não corresponde à transferência registrada." };
        await tx.withdrawal.updateMany({
          where: { id: withdrawal.id, status: "PROCESSING", paymentReference: externalReference, OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }] },
          data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
        });
        await tx.auditEvent.create({ data: { action: "ASAAS_TRANSFER_VALIDATION_APPROVED", entityType: "Withdrawal", entityId: withdrawal.id, metadata: { transferId, externalReference, valueCents } } });
        return { approved: true, entityType: "Withdrawal", entityId: withdrawal.id };
      }

      return { approved: false, entityType: "Unknown", entityId: null, reason: "Transferência não encontrada no banco de dados." };
    }, { isolationLevel: "Serializable" });

    if (!decision.approved) return refuse("reason" in decision ? decision.reason : "Transferência não autorizada.");
    return NextResponse.json({ status: "APPROVED" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    // A transient database failure must trigger Asaas retry, not a false decision.
    return NextResponse.json({ error: "Validação temporariamente indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
