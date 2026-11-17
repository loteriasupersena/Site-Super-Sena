import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransferValidation = {
  type?: string;
  transfer?: {
    id?: string;
    status?: string;
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

function refuse(reason: string) {
  return NextResponse.json({ status: "REFUSED", refuseReason: reason }, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_TRANSFER_VALIDATION_TOKEN?.trim();
  if (!token || token.length < 32) {
    return NextResponse.json({ status: "REFUSED", refuseReason: "Validação não configurada." }, { status: 503 });
  }
  if (!tokenMatches(request.headers.get("asaas-access-token"), token)) {
    return refuse("Autenticação inválida.");
  }

  let payload: TransferValidation;
  try {
    payload = await request.json() as TransferValidation;
  } catch {
    return refuse("Payload inválido.");
  }

  const transfer = payload.transfer;
  const transferId = transfer?.id?.trim();
  if (payload.type !== "TRANSFER" || !transferId ||
      transfer?.operationType !== "PIX" ||
      !Number.isFinite(transfer.value) || (transfer.value ?? 0) <= 0 ||
      !transfer.bankAccount?.pixAddressKey) {
    return refuse("Dados da transferência incompletos ou operação não suportada.");
  }

  try {
    const [withdrawal, prizeRequest, batch] = await Promise.all([
      authPrisma.withdrawal.findUnique({
        where: { asaasTransferId: transferId },
        select: { id: true, status: true, amountCents: true, pixKey: true, pixKeyType: true },
      }),
      authPrisma.prizePaymentRequest.findUnique({
        where: { asaasTransferId: transferId },
        select: { id: true, status: true, netCents: true, pixKey: true, pixKeyType: true },
      }),
      authPrisma.prizePaymentBatch.findUnique({
        where: { asaasTransferId: transferId },
        select: { id: true, status: true, netCents: true, pixKey: true, pixKeyType: true },
      }),
    ]);

    const matches = [withdrawal, prizeRequest, batch].filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );
    if (matches.length !== 1) return refuse("Transferência não localizada ou referência ambígua.");

    const item = matches[0]!;
    const expectedCents = "amountCents" in item ? item.amountCents : item.netCents;
    const expectedStatus = item.status === "PROCESSING";
    const keyType = item.pixKeyType;
    const expectedKey = item.pixKey;
    const actualKey = transfer.bankAccount.pixAddressKey;

    if (!expectedStatus || !keyType || !expectedKey ||
        Math.round((transfer.value ?? 0) * 100) !== expectedCents ||
        normalizePix(expectedKey, keyType) !== normalizePix(actualKey, keyType)) {
      await authPrisma.auditEvent.create({
        data: {
          action: "ASAAS_TRANSFER_VALIDATION_REFUSED",
          entityType: withdrawal ? "Withdrawal" : prizeRequest ? "PrizePaymentRequest" : "PrizePaymentBatch",
          entityId: item.id,
          metadata: { transferId, reason: "STATE_VALUE_OR_BENEFICIARY_MISMATCH" },
        },
      });
      return refuse("Estado, valor ou beneficiário não corresponde ao registro interno.");
    }

    await authPrisma.auditEvent.create({
      data: {
        action: "ASAAS_TRANSFER_VALIDATION_APPROVED",
        entityType: withdrawal ? "Withdrawal" : prizeRequest ? "PrizePaymentRequest" : "PrizePaymentBatch",
        entityId: item.id,
        metadata: { transferId, amountCents: expectedCents },
      },
    });

    return NextResponse.json({ status: "APPROVED" }, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return refuse("Não foi possível confirmar a transferência no banco de dados.");
  }
}
