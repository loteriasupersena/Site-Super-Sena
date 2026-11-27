import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { authPrisma } from "@/lib/auth/session";

const MAX_INT = 2_147_483_647;
const GLOBAL_COUPON_QUEUE_LOCK_A = 20261127;
const GLOBAL_COUPON_QUEUE_LOCK_B = 100;

function makePublicCode() {
  return randomBytes(18).toString("base64url");
}

function calculatePlatformFeeCents(amountCents: number, rateBasisPoints: number) {
  const numerator = BigInt(amountCents) * BigInt(rateBasisPoints);
  const fee = (numerator + 5_000n) / 10_000n;
  if (fee > BigInt(MAX_INT)) throw new Error("COUPON_PLATFORM_FEE_OUT_OF_RANGE");
  return Number(fee);
}

/**
 * Creates one coupon in the global queue.
 * A PostgreSQL transaction-scoped advisory lock serializes queue allocation,
 * preventing two cashiers from assigning the same final slot or drawing twice.
 */
export async function issueCoupon(input: {
  issuedById: string;
  idempotencyKey: string;
  purchaseAmountCents: number;
}) {
  if (!input.issuedById.trim()
    || input.idempotencyKey.length < 16
    || input.idempotencyKey.length > 200
    || !Number.isSafeInteger(input.purchaseAmountCents)
    || input.purchaseAmountCents <= 0
    || input.purchaseAmountCents > MAX_INT) {
    throw new Error("COUPON_ISSUE_INPUT_INVALID");
  }

  return authPrisma.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({
      where: { id: input.issuedById },
      select: {
        id: true, role: true, status: true, storeId: true,
        administeredStore: { select: { id: true, status: true } },
      },
    });
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "CASHIER" || !actor.storeId) {
      throw new Error("COUPON_ISSUER_FORBIDDEN");
    }

    const store = await tx.store.findUnique({
      where: { id: actor.storeId },
      select: { id: true, status: true, commissionRateBasisPoints: true },
    });
    if (!store || store.status !== "ACTIVE") throw new Error("COUPON_STORE_INACTIVE");

    const existing = await tx.coupon.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.storeId !== store.id || existing.issuedById !== actor.id) {
        throw new Error("COUPON_IDEMPOTENCY_KEY_CONFLICT");
      }
      const batch = await tx.couponBatch.findUnique({ where: { id: existing.batchId } });
      return { coupon: existing, batch, replayed: true };
    }

    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${GLOBAL_COUPON_QUEUE_LOCK_A}, ${GLOBAL_COUPON_QUEUE_LOCK_B})`;

    // Recheck after acquiring the global lock: another request may have committed
    // while this transaction was waiting for the queue.
    const raced = await tx.coupon.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (raced) {
      if (raced.storeId !== store.id || raced.issuedById !== actor.id) {
        throw new Error("COUPON_IDEMPOTENCY_KEY_CONFLICT");
      }
      const batch = await tx.couponBatch.findUnique({ where: { id: raced.batchId } });
      return { coupon: raced, batch, replayed: true };
    }

    let batch = await tx.couponBatch.findFirst({
      where: { status: "OPEN" },
      orderBy: { sequenceNumber: "desc" },
    });
    if (!batch) {
      const latest = await tx.couponBatch.findFirst({ orderBy: { sequenceNumber: "desc" }, select: { sequenceNumber: true } });
      batch = await tx.couponBatch.create({
        data: { sequenceNumber: (latest?.sequenceNumber ?? 0) + 1 },
      });
    }

    const memberCount = await tx.coupon.count({ where: { batchId: batch.id } });
    if (memberCount >= 100) throw new Error("COUPON_BATCH_CAPACITY_INVARIANT");

    const coupon = await tx.coupon.create({
      data: {
        publicCode: makePublicCode(),
        idempotencyKey: input.idempotencyKey,
        storeId: store.id,
        issuedById: actor.id,
        batchId: batch.id,
        purchaseAmountCents: input.purchaseAmountCents,
        commissionRateBasisPoints: store.commissionRateBasisPoints,
        platformFeeCents: calculatePlatformFeeCents(input.purchaseAmountCents, store.commissionRateBasisPoints),
      },
    });

    if (memberCount + 1 === 100) {
      const members = await tx.coupon.findMany({
        where: { batchId: batch.id },
        select: { id: true },
        orderBy: { issuedAt: "asc" },
      });
      if (members.length !== 100) throw new Error("COUPON_BATCH_COMPLETION_INVARIANT");
      const winner = members[randomInt(members.length)];
      const now = new Date();
      const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await tx.coupon.update({
        where: { id: winner.id },
        data: { status: "WINNER", drawnAt: now, customerRedemptionDeadline: deadline },
      });
      batch = await tx.couponBatch.update({
        where: { id: batch.id },
        data: { status: "DRAWN", completedAt: now, winnerCouponId: winner.id },
      });
    }

    const savedCoupon = await tx.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    return { coupon: savedCoupon, batch, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}
