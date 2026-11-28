import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";

const MAX_INT = 2_147_483_647;
const GLOBAL_QUEUE_STATE_ID = "global";

function makePublicCode() {
  return randomBytes(18).toString("base64url");
}

export function calculatePlatformFeeCents(amountCents: number, rateBasisPoints: number) {
  const numerator = BigInt(amountCents) * BigInt(rateBasisPoints);
  const fee = (numerator + 5_000n) / 10_000n;
  if (fee > BigInt(MAX_INT)) throw new Error("COUPON_PLATFORM_FEE_OUT_OF_RANGE");
  return Number(fee);
}

/**
 * Issues one coupon while keeping financial accounting tenant-local.
 *
 * The store counter is updated atomically, so the limit check does not scan
 * historical coupons. Global draw allocation uses one compact database row:
 * the row update assigns exactly one slot, while the transaction guarantees
 * the coupon insert, draw completion and next-batch rotation commit together.
 * No provider request or other network work occurs inside this transaction.
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

  try {
    return await authPrisma.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: input.issuedById },
        select: { id: true, role: true, status: true, storeId: true },
      });
      if (!actor || actor.status !== "ACTIVE" || actor.role !== "CASHIER" || !actor.storeId) {
        throw new Error("COUPON_ISSUER_FORBIDDEN");
      }

      const store = await tx.store.findUnique({
        where: { id: actor.storeId },
        select: {
          id: true,
          status: true,
          commissionRateBasisPoints: true,
          couponLimit: true,
        },
      });
      if (!store || store.status !== "ACTIVE") throw new Error("COUPON_STORE_INACTIVE");

      const existing = await tx.coupon.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        if (existing.storeId !== store.id || existing.issuedById !== actor.id) {
          throw new Error("COUPON_IDEMPOTENCY_KEY_CONFLICT");
        }
        const batch = await tx.couponBatch.findUnique({ where: { id: existing.batchId } });
        return { coupon: existing, batch, replayed: true };
      }

      const platformFeeCents = calculatePlatformFeeCents(
        input.purchaseAmountCents,
        store.commissionRateBasisPoints,
      );

      // Atomic per-store quota reservation. The update itself serializes only
      // requests belonging to this store; different stores do not contend here.
      if (platformFeeCents > 0) {
        const reserved = await tx.store.updateMany({
          where: {
            id: store.id,
            status: "ACTIVE",
            outstandingCouponCount: { lt: store.couponLimit },
          },
          data: { outstandingCouponCount: { increment: 1 } },
        });
        if (reserved.count !== 1) throw new Error("COUPON_STORE_BILLING_LIMIT_REACHED");
      }

      // A retry may have passed the first idempotency check before another
      // transaction committed the same key. Recheck before taking the global
      // queue slot so duplicate requests do not serialize the draw allocator.
      const raced = await tx.coupon.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (raced) {
        if (raced.storeId !== store.id || raced.issuedById !== actor.id) {
          throw new Error("COUPON_IDEMPOTENCY_KEY_CONFLICT");
        }
        if (platformFeeCents > 0) {
          const released = await tx.store.updateMany({
            where: { id: store.id, outstandingCouponCount: { gte: 1 } },
            data: { outstandingCouponCount: { decrement: 1 } },
          });
          if (released.count !== 1) throw new Error("COUPON_STORE_COUNTER_INVARIANT");
        }
        const batch = await tx.couponBatch.findUnique({ where: { id: raced.batchId } });
        return { coupon: raced, batch, replayed: true };
      }

      // A single compact atomic update allocates the next global slot. This
      // preserves one worldwide order and prevents two requests from claiming
      // the final slot of the same 100-coupon batch.
      const slots = await tx.$queryRaw<Array<{
        currentBatchId: string;
        currentBatchSequence: number;
        currentBatchCount: number;
        nextBatchSequence: number;
      }>>`
        UPDATE "CouponQueueState"
        SET "currentBatchCount" = "currentBatchCount" + 1,
            "updatedAt" = NOW()
        WHERE "id" = ${GLOBAL_QUEUE_STATE_ID}
          AND "currentBatchId" IS NOT NULL
          AND "currentBatchCount" < 100
        RETURNING
          "currentBatchId",
          "currentBatchSequence",
          "currentBatchCount",
          "nextBatchSequence"
      `;
      const slot = slots[0];
      if (!slot) throw new Error("COUPON_QUEUE_STATE_UNAVAILABLE");

      const coupon = await tx.coupon.create({
        data: {
          publicCode: makePublicCode(),
          idempotencyKey: input.idempotencyKey,
          storeId: store.id,
          issuedById: actor.id,
          batchId: slot.currentBatchId,
          purchaseAmountCents: input.purchaseAmountCents,
          commissionRateBasisPoints: store.commissionRateBasisPoints,
          platformFeeCents,
        },
      });

      let savedCoupon = coupon;
      let batch: {
        id: string;
        sequenceNumber: number;
        status: "OPEN" | "DRAWN";
        completedAt: Date | null;
      };

      if (slot.currentBatchCount === 100) {
        const members = await tx.coupon.findMany({
          where: { batchId: slot.currentBatchId },
          select: { id: true },
        });
        if (members.length !== 100) throw new Error("COUPON_BATCH_COMPLETION_INVARIANT");

        const winner = members[randomInt(members.length)];
        const now = new Date();
        const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const updatedWinner = await tx.coupon.update({
          where: { id: winner.id },
          data: { status: "WINNER", drawnAt: now, customerRedemptionDeadline: deadline },
        });
        if (winner.id === coupon.id) savedCoupon = updatedWinner;

        const drawnBatch = await tx.couponBatch.update({
          where: { id: slot.currentBatchId },
          data: { status: "DRAWN", completedAt: now, winnerCouponId: winner.id },
        });

        const nextBatch = await tx.couponBatch.create({
          data: { sequenceNumber: slot.nextBatchSequence },
        });
        await tx.couponQueueState.update({
          where: { id: GLOBAL_QUEUE_STATE_ID },
          data: {
            currentBatchId: nextBatch.id,
            currentBatchSequence: nextBatch.sequenceNumber,
            currentBatchCount: 0,
            nextBatchSequence: { increment: 1 },
          },
        });
        batch = {
          id: drawnBatch.id,
          sequenceNumber: drawnBatch.sequenceNumber,
          status: "DRAWN",
          completedAt: drawnBatch.completedAt,
        };
      } else {
        batch = {
          id: slot.currentBatchId,
          sequenceNumber: slot.currentBatchSequence,
          status: "OPEN",
          completedAt: null,
        };
      }

      return { coupon: savedCoupon, batch, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  } catch (error) {
    // Concurrent retries with the same idempotency key may race before either
    // transaction commits. The unique index chooses one winner; the loser
    // returns the already-created coupon instead of issuing a second one.
    const existing = await authPrisma.coupon.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.issuedById !== input.issuedById) {
        throw new Error("COUPON_IDEMPOTENCY_KEY_CONFLICT");
      }
      const batch = await authPrisma.couponBatch.findUnique({ where: { id: existing.batchId } });
      return { coupon: existing, batch, replayed: true };
    }
    throw error;
  }
}
