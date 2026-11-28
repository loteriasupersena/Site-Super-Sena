import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";
import { createAsaasStaticPixQrCode } from "@/modules/payments/asaas";

function referenceFor(storeId: string, cycleKey: string) {
  const digest = createHash("sha256").update(storeId + ":" + cycleKey).digest("hex");
  return "meu-vale-pix-store-billing-" + digest;
}

/**
 * Creates one charge for the store's currently unbilled coupons.
 * Coupon membership is frozen before contacting Asaas; later coupons belong
 * to a later charge. A pending charge is returned instead of duplicated.
 */
export async function createStoreBillingPixCharge(input: { storeId: string; dueAt?: Date }) {
  if (!input.storeId.trim()) throw new Error("STORE_BILLING_INPUT_INVALID");
  if (input.dueAt && Number.isNaN(input.dueAt.getTime())) throw new Error("STORE_BILLING_DUE_DATE_INVALID");

  const reservation = await authPrisma.$transaction(async (tx) => {
    // Lock only this store row. Coupon issuance takes the same row lock when
    // incrementing its counter, so the billing snapshot has an exact cutoff.
    await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${input.storeId} FOR UPDATE`;
    const store = await tx.store.findUnique({
      where: { id: input.storeId },
      select: { id: true, status: true },
    });
    if (!store || store.status !== "ACTIVE") throw new Error("STORE_BILLING_STORE_INACTIVE");

    const open = await tx.storeBilling.findFirst({
      where: { storeId: store.id, status: { in: ["PROCESSING", "PENDING"] } },
      orderBy: { createdAt: "desc" },
    });
    if (open) return { billing: open, created: false };

    const coupons = await tx.coupon.findMany({
      where: {
        storeId: store.id,
        platformFeeCents: { gt: 0 },
        billingLinks: { none: {} },
      },
      select: { id: true, platformFeeCents: true },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
    });
    if (coupons.length === 0) throw new Error("STORE_BILLING_NO_UNBILLED_COUPONS");

    const amountCents = coupons.reduce((sum, coupon) => sum + coupon.platformFeeCents, 0);
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > 2_147_483_647) {
      throw new Error("STORE_BILLING_AMOUNT_INVALID");
    }

    const previous = await tx.storeBilling.findFirst({
      where: { storeId: store.id },
      orderBy: { createdAt: "desc" },
      select: { periodKey: true },
    });
    const previousSequence = Number(previous?.periodKey.match(/^CYCLE-(\\d+)$/)?.[1] ?? 0);
    const periodKey = "CYCLE-" + String(previousSequence + 1).padStart(8, "0");
    const externalReference = referenceFor(store.id, periodKey);
    const billing = await tx.storeBilling.create({
      data: {
        storeId: store.id,
        periodKey,
        amountCents,
        status: "PROCESSING",
        idempotencyKey: "store-billing:" + externalReference,
        externalReference,
        dueAt: input.dueAt,
        couponLinks: { create: coupons.map((coupon) => ({ couponId: coupon.id })) },
      },
    });
    return { billing, created: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15_000, timeout: 30_000 });

  if (reservation.billing.providerQrCodeId && reservation.billing.pixCopyPaste && reservation.billing.pixQrCodeBase64) {
    return reservation.billing;
  }
  if (!reservation.created) throw new Error("STORE_BILLING_PROVIDER_REQUEST_UNCERTAIN");

  const qr = await createAsaasStaticPixQrCode({
    amountCents: reservation.billing.amountCents,
    externalReference: reservation.billing.externalReference,
    description: "MEU VALE PIX - cobrança da loja",
  });

  return authPrisma.storeBilling.update({
    where: { id: reservation.billing.id },
    data: {
      provider: "ASAAS",
      providerQrCodeId: qr.id,
      pixCopyPaste: qr.payload,
      pixQrCodeBase64: qr.encodedImage,
      status: "PENDING",
    },
  });
}
