import "server-only";
import { createHash } from "node:crypto";
import { authPrisma } from "@/lib/auth/session";
import { decryptStorePixKey, encryptStorePixKey } from "@/lib/wallet/store-pix-key";
import { maskPixKey, parsePixKeyInput } from "@/lib/wallet/pix-key";
import { createAsaasPixTransfer } from "@/modules/payments/asaas";

type PayoutKind = "CUSTOMER_REDEMPTION" | "STORE_EXPIRED_CLAIM";

function payoutReference(couponId: string) {
  const digest = createHash("sha256").update("coupon-payout:" + couponId).digest("hex");
  return "meu-vale-pix-coupon-payout-" + digest;
}

/**
 * Reserves and submits one Pix payout for a winning coupon.
 * The unique coupon constraint and PROCESSING reservation prevent duplicate sends.
 * A timeout leaves the operation in PROCESSING for provider reconciliation; it is never resent here.
 */
export async function startCouponPixPayout(input: {
  couponId: string;
  storeId: string;
  actorId: string;
  kind: PayoutKind;
  customerPix?: { pixKey: string; pixKeyType: string };
}) {
  const actor = await authPrisma.user.findUnique({
    where: { id: input.actorId },
    select: { id: true, role: true, status: true, storeId: true, administeredStore: { select: { id: true } } },
  });
  if (!actor || actor.status !== "ACTIVE"
    || !["STORE_ADMIN", "CASHIER"].includes(actor.role)
    || (actor.storeId !== input.storeId && actor.administeredStore?.id !== input.storeId)) {
    throw new Error("COUPON_PAYOUT_ACTOR_FORBIDDEN");
  }

  const coupon = await authPrisma.coupon.findUnique({
    where: { id: input.couponId },
    select: {
      id: true, storeId: true, purchaseAmountCents: true, status: true,
      customerRedemptionDeadline: true,
    },
  });
  if (!coupon || coupon.storeId !== input.storeId) throw new Error("COUPON_PAYOUT_NOT_FOUND");
  const now = new Date();
  if (input.kind === "CUSTOMER_REDEMPTION") {
    if (coupon.status !== "WINNER" || !coupon.customerRedemptionDeadline
      || coupon.customerRedemptionDeadline <= now) {
      throw new Error("COUPON_CUSTOMER_REDEMPTION_NOT_AVAILABLE");
    }
  } else if (coupon.status !== "STORE_CLAIMABLE"
    || !coupon.customerRedemptionDeadline || coupon.customerRedemptionDeadline > now) {
    throw new Error("COUPON_STORE_CLAIM_NOT_AVAILABLE");
  }

  let pixKey: string;
  let pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  if (input.kind === "CUSTOMER_REDEMPTION") {
    const parsed = parsePixKeyInput(input.customerPix);
    if (!parsed) throw new Error("COUPON_CUSTOMER_PIX_KEY_INVALID");
    pixKey = parsed.pixKey;
    pixKeyType = parsed.pixKeyType;
  } else {
    const saved = await authPrisma.storePixKey.findUnique({ where: { storeId: input.storeId } });
    if (!saved || saved.validatedAt > now) throw new Error("STORE_PIX_KEY_NOT_VALIDATED");
    pixKey = decryptStorePixKey(saved.keyCiphertext);
    pixKeyType = saved.keyType as typeof pixKeyType;
  }

  const externalReference = payoutReference(coupon.id);
  const idempotencyKey = "coupon-payout:" + coupon.id;
  let payout;
  try {
    payout = await authPrisma.couponPayout.create({
      data: {
        couponId: coupon.id,
        storeId: coupon.storeId,
        kind: input.kind,
        method: "PIX",
        status: "PROCESSING",
        amountCents: coupon.purchaseAmountCents,
        idempotencyKey,
        externalReference,
        provider: "ASAAS",
        pixKeyCiphertext: encryptStorePixKey(pixKey),
        pixKeyMasked: maskPixKey(pixKey),
        pixKeyType,
        requestedAt: now,
      },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code) : "";
    if (code === "P2002") throw new Error("COUPON_PAYOUT_ALREADY_RESERVED");
    throw error;
  }

  const transfer = await createAsaasPixTransfer({
    amountCents: payout.amountCents,
    pixKey,
    pixKeyType,
    externalReference,
    description: "MEU VALE PIX - prêmio de cupom",
  });

  return authPrisma.couponPayout.update({
    where: { id: payout.id },
    data: {
      providerTransferId: transfer.id,
      providerStatus: transfer.status ?? "PENDING",
      status: "PROCESSING",
    },
  });
}
