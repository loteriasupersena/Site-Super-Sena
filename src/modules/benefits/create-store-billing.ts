import "server-only";
import { createHash } from "node:crypto";
import { authPrisma } from "@/lib/auth/session";
import { createAsaasStaticPixQrCode } from "@/modules/payments/asaas";

function referenceFor(storeId: string, periodKey: string) {
  const digest = createHash("sha256").update(storeId + ":" + periodKey).digest("hex");
  return "meu-vale-pix-store-billing-" + digest;
}

/**
 * Reserves one invoice per store/period before contacting Asaas.
 * An uncertain provider request is deliberately not repeated automatically.
 */
export async function createStoreBillingPixCharge(input: {
  storeId: string;
  periodKey: string;
  amountCents: number;
  dueAt?: Date;
}) {
  if (!input.storeId.trim() || !/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(input.periodKey)) {
    throw new Error("STORE_BILLING_INPUT_INVALID");
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("STORE_BILLING_AMOUNT_INVALID");
  }
  if (input.dueAt && Number.isNaN(input.dueAt.getTime())) {
    throw new Error("STORE_BILLING_DUE_DATE_INVALID");
  }

  const externalReference = referenceFor(input.storeId, input.periodKey);
  const idempotencyKey = "store-billing:" + externalReference;
  let created = false;
  let billing = await authPrisma.storeBilling.findUnique({
    where: { storeId_periodKey: { storeId: input.storeId, periodKey: input.periodKey } },
  });

  if (!billing) {
    try {
      billing = await authPrisma.storeBilling.create({
        data: {
          storeId: input.storeId,
          periodKey: input.periodKey,
          amountCents: input.amountCents,
          status: "PROCESSING",
          idempotencyKey,
          externalReference,
          dueAt: input.dueAt,
        },
      });
      created = true;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code) : "";
      if (code !== "P2002") throw error;
      billing = await authPrisma.storeBilling.findUnique({
        where: { storeId_periodKey: { storeId: input.storeId, periodKey: input.periodKey } },
      });
    }
  }

  if (!billing) throw new Error("STORE_BILLING_RESERVATION_FAILED");
  if (billing.amountCents !== input.amountCents) throw new Error("STORE_BILLING_PERIOD_AMOUNT_CONFLICT");
  if (billing.providerQrCodeId && billing.pixCopyPaste && billing.pixQrCodeBase64) return billing;
  if (!created) throw new Error("STORE_BILLING_PROVIDER_REQUEST_UNCERTAIN");

  const qr = await createAsaasStaticPixQrCode({
    amountCents: billing.amountCents,
    externalReference: billing.externalReference,
    description: "MEU VALE PIX - cobrança da loja",
  });

  return authPrisma.storeBilling.update({
    where: { id: billing.id },
    data: {
      provider: "ASAAS",
      providerQrCodeId: qr.id,
      pixCopyPaste: qr.payload,
      pixQrCodeBase64: qr.encodedImage,
      status: "PENDING",
    },
  });
}
