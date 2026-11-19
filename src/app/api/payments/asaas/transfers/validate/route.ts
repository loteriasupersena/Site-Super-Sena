import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { getAsaasTransfer } from "@/modules/payments/asaas";

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
  if (type === "PHONE") {
    const digits = value.replace(/\D/g, "");
    // Accept the same Brazilian phone Pix key with or without country code 55.
    return digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
      ? digits.slice(2)
      : digits;
  }
  return ["CPF", "CNPJ"].includes(type)
    ? value.replace(/\D/g, "")
    : value.trim().toLowerCase();
}

function validTransfer(payload: ValidationPayload) {
  const transfer = payload.transfer;
  return payload.type === "TRANSFER" && !!transfer?.id?.trim() &&
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
  const valueCents = Math.round((transfer.value ?? 0) * 100);
  const actualPix = transfer.bankAccount?.pixAddressKey?.trim() || null;
  if (!Number.isSafeInteger(valueCents) || valueCents <= 0) {
    return refuse("Não foi possível validar o valor da transferência.");
  }

  try {
    let externalReference = transfer.externalReference?.trim() || null;
    // Asaas' validation payload may omit externalReference. Recover it from
    // the provider when the callback races our post-creation database update.
    if (!externalReference) {
      const providerTransfer = await getAsaasTransfer(transferId);
      if (providerTransfer.id !== transferId ||
          providerTransfer.value !== transfer.value ||
          providerTransfer.operationType !== "PIX") {
        return refuse("Os dados recuperados da transferência não correspondem à solicitação.");
      }
      externalReference = providerTransfer.externalReference?.trim() || null;
    }
    const transferLookup = externalReference
      ? { OR: [{ paymentReference: externalReference }, { asaasTransferId: transferId }] }
      : { asaasTransferId: transferId };
    const decision = await authPrisma.$transaction(async tx => {
      const batch = await tx.prizePaymentBatch.findFirst({
        where: transferLookup,
        select: { id: true, status: true, paymentReference: true, asaasTransferId: true, netCents: true, pixKey: true, pixKeyType: true },
      });
      if (batch) {
        const valid = batch.status === "PROCESSING" &&
          (!externalReference || batch.paymentReference === externalReference) &&
          (!batch.asaasTransferId || batch.asaasTransferId === transferId) &&
          batch.netCents === valueCents && !!batch.pixKey && !!batch.pixKeyType &&
          (!actualPix || normalizePix(batch.pixKey, batch.pixKeyType) === normalizePix(actualPix, batch.pixKeyType));
        if (!valid) return { approved: false, entityType: "PrizePaymentBatch", entityId: batch.id, reason: "Lote não corresponde à transferência registrada." };
        const linked = await tx.prizePaymentBatch.updateMany({
          where: { id: batch.id, status: "PROCESSING", ...(externalReference ? { paymentReference: externalReference } : { asaasTransferId: transferId }), OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }] },
          data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
        });
        if (linked.count !== 1) return { approved: false, entityType: "Lote", entityId: batch.id, reason: "Registro alterado durante a validação." };
        await tx.auditEvent.create({ data: { action: "ASAAS_TRANSFER_VALIDATION_APPROVED", entityType: "PrizePaymentBatch", entityId: batch.id, metadata: { transferId, externalReference, valueCents, beneficiaryKeyComparedFromPayload: Boolean(actualPix), beneficiaryValidatedAgainstStoredRequest: true } } });
        return { approved: true, entityType: "PrizePaymentBatch", entityId: batch.id };
      }

      const prizeRequest = await tx.prizePaymentRequest.findFirst({
        where: transferLookup,
        select: { id: true, status: true, paymentReference: true, asaasTransferId: true, netCents: true, pixKey: true, pixKeyType: true },
      });
      if (prizeRequest) {
        const valid = prizeRequest.status === "PROCESSING" &&
          (!externalReference || prizeRequest.paymentReference === externalReference) &&
          (!prizeRequest.asaasTransferId || prizeRequest.asaasTransferId === transferId) &&
          prizeRequest.netCents === valueCents && !!prizeRequest.pixKey && !!prizeRequest.pixKeyType &&
          (!actualPix || normalizePix(prizeRequest.pixKey, prizeRequest.pixKeyType) === normalizePix(actualPix, prizeRequest.pixKeyType));
        if (!valid) return { approved: false, entityType: "PrizePaymentRequest", entityId: prizeRequest.id, reason: "Solicitação não corresponde à transferência registrada." };
        const linked = await tx.prizePaymentRequest.updateMany({
          where: { id: prizeRequest.id, status: "PROCESSING", ...(externalReference ? { paymentReference: externalReference } : { asaasTransferId: transferId }), OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }] },
          data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
        });
        if (linked.count !== 1) return { approved: false, entityType: "Solicitação", entityId: prizeRequest.id, reason: "Registro alterado durante a validação." };
        await tx.auditEvent.create({ data: { action: "ASAAS_TRANSFER_VALIDATION_APPROVED", entityType: "PrizePaymentRequest", entityId: prizeRequest.id, metadata: { transferId, externalReference, valueCents, beneficiaryKeyComparedFromPayload: Boolean(actualPix), beneficiaryValidatedAgainstStoredRequest: true } } });
        return { approved: true, entityType: "PrizePaymentRequest", entityId: prizeRequest.id };
      }

      const withdrawal = await tx.withdrawal.findFirst({
        where: transferLookup,
        select: { id: true, status: true, paymentReference: true, asaasTransferId: true, amountCents: true, pixKey: true, pixKeyType: true, reviewedById: true },
      });
      if (withdrawal) {
        const storedPixKey = withdrawal.pixKey;
        const storedPixKeyType = withdrawal.pixKeyType;
        const valid = withdrawal.status === "PROCESSING" && !!withdrawal.reviewedById &&
          (!externalReference || withdrawal.paymentReference === externalReference) &&
          (!withdrawal.asaasTransferId || withdrawal.asaasTransferId === transferId) &&
          withdrawal.amountCents === valueCents && !!storedPixKey && !!storedPixKeyType &&
          (!actualPix || normalizePix(storedPixKey, storedPixKeyType) === normalizePix(actualPix, storedPixKeyType));
        if (!valid) return { approved: false, entityType: "Withdrawal", entityId: withdrawal.id, reason: "Saque não corresponde à transferência registrada." };
        const linked = await tx.withdrawal.updateMany({
          where: { id: withdrawal.id, status: "PROCESSING", ...(externalReference ? { paymentReference: externalReference } : { asaasTransferId: transferId }), OR: [{ asaasTransferId: null }, { asaasTransferId: transferId }] },
          data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
        });
        if (linked.count !== 1) return { approved: false, entityType: "Saque", entityId: withdrawal.id, reason: "Registro alterado durante a validação." };
        await tx.auditEvent.create({ data: { action: "ASAAS_TRANSFER_VALIDATION_APPROVED", entityType: "Withdrawal", entityId: withdrawal.id, metadata: { transferId, externalReference, valueCents, beneficiaryKeyComparedFromPayload: Boolean(actualPix), beneficiaryValidatedAgainstStoredRequest: true } } });
        return { approved: true, entityType: "Withdrawal", entityId: withdrawal.id };
      }

      return { approved: false, entityType: "Unknown", entityId: null, reason: "Transferência não encontrada no banco de dados." };
    }, { isolationLevel: "Serializable" });

    if (!decision.approved) {
      const reason = "reason" in decision && typeof decision.reason === "string"
        ? decision.reason
        : "Transferência não autorizada.";
      await authPrisma.auditEvent.create({
        data: {
          action: "ASAAS_TRANSFER_VALIDATION_REFUSED",
          entityType: decision.entityType === "Unknown" ? "AsaasTransferValidation" : decision.entityType,
          entityId: decision.entityId ?? transferId,
          metadata: {
            transferId,
            externalReference,
            valueCents,
            reason,
            entityFound: decision.entityType !== "Unknown",
            beneficiaryKeyComparedFromPayload: Boolean(actualPix),
          },
        },
      });
      return refuse(reason);
    }
    return NextResponse.json({ status: "APPROVED" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    // A transient database failure must trigger Asaas retry, not a false decision.
    return NextResponse.json({ error: "Validação temporariamente indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
