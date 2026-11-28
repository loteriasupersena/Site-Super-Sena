import "server-only";
import { randomBytes, randomInt } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";

const MAX_INT = 2_147_483_647;
const GLOBAL_QUEUE_STATE_ID = "global";
const GLOBAL_DRAW_CONFIG_ID = "global";

function makePublicCode() {
  return randomBytes(18).toString("base64url");
}

export function chooseDistinct<T>(items: T[], count: number): T[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > items.length) {
    throw new Error("COUPON_DRAW_WINNER_COUNT_INVALID");
  }
  const pool = [...items];
  for (let index = 0; index < count; index += 1) {
    const selected = index + randomInt(pool.length - index);
    [pool[index], pool[selected]] = [pool[selected]!, pool[index]!];
  }
  return pool.slice(0, count);
}

export function calculatePlatformFeeCents(amountCents: number, rateBasisPoints: number) {
  const numerator = BigInt(amountCents) * BigInt(rateBasisPoints);
  const fee = (numerator + 5_000n) / 10_000n;
  if (fee > BigInt(MAX_INT)) throw new Error("COUPON_PLATFORM_FEE_OUT_OF_RANGE");
  return Number(fee);
}

/**
 * Issues one coupon into the single global queue. Each batch carries an immutable
 * snapshot of its draw rule; changes to the global config only affect the next batch.
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

      const existing = await tx.coupon.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
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

      const raced = await tx.coupon.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
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

      let slot: {
        currentBatchId: string;
        currentBatchSequence: number;
        currentBatchCount: number;
        nextBatchSequence: number;
        batchSize: number;
        winnersPerBatch: number;
        ruleVersion: number;
      } | undefined;

      // A caller can wait behind the transaction that fills the final slot.
      // PostgreSQL then rechecks the conditional UPDATE against the now-full
      // batch and correctly returns no row. Retry so that caller takes a slot
      // from the newly-created batch instead of treating normal contention as
      // a broken global queue.
      for (let attempt = 0; attempt < 20 && !slot; attempt += 1) {
        const slots = await tx.$queryRaw<Array<{
          currentBatchId: string;
          currentBatchSequence: number;
          currentBatchCount: number;
          nextBatchSequence: number;
          batchSize: number;
          winnersPerBatch: number;
          ruleVersion: number;
        }>>`
          UPDATE "CouponQueueState" AS queue
          SET "currentBatchCount" = queue."currentBatchCount" + 1,
              "updatedAt" = NOW()
          FROM "CouponBatch" AS batch
          WHERE queue."id" = ${GLOBAL_QUEUE_STATE_ID}
            AND batch."id" = queue."currentBatchId"
            AND queue."currentBatchCount" < batch."batchSize"
          RETURNING
            queue."currentBatchId",
            queue."currentBatchSequence",
            queue."currentBatchCount",
            queue."nextBatchSequence",
            batch."batchSize",
            batch."winnersPerBatch",
            batch."ruleVersion"
        `;
        slot = slots[0];
      }
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
        batchSize: number;
        winnersPerBatch: number;
        ruleVersion: number;
      };

      if (slot.currentBatchCount === slot.batchSize) {
        const members = await tx.coupon.findMany({
          where: { batchId: slot.currentBatchId },
          select: { id: true },
        });
        if (members.length !== slot.batchSize) throw new Error("COUPON_BATCH_COMPLETION_INVARIANT");

        const winners = chooseDistinct(members, slot.winnersPerBatch);
        const winnerIds = winners.map((winner) => winner.id);
        const now = new Date();
        const deadline = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await tx.coupon.updateMany({
          where: { id: { in: winnerIds }, batchId: slot.currentBatchId, status: "ACTIVE" },
          data: { status: "WINNER", drawnAt: now, customerRedemptionDeadline: deadline },
        });
        if (winnerIds.includes(coupon.id)) {
          savedCoupon = await tx.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
        }

        const drawnBatch = await tx.couponBatch.update({
          where: { id: slot.currentBatchId },
          data: { status: "DRAWN", completedAt: now },
        });

        // Lock the singleton config while taking the next batch's immutable snapshot.
        const configs = await tx.$queryRaw<Array<{
          batchSize: number;
          winnersPerBatch: number;
          version: number;
        }>>`
          SELECT "batchSize", "winnersPerBatch", "version"
          FROM "CouponDrawConfig"
          WHERE "id" = ${GLOBAL_DRAW_CONFIG_ID}
          FOR SHARE
        `;
        const nextRule = configs[0];
        if (!nextRule) throw new Error("COUPON_DRAW_CONFIG_UNAVAILABLE");
        const nextBatch = await tx.couponBatch.create({
          data: {
            sequenceNumber: slot.nextBatchSequence,
            batchSize: nextRule.batchSize,
            winnersPerBatch: nextRule.winnersPerBatch,
            ruleVersion: nextRule.version,
          },
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
          batchSize: slot.batchSize,
          winnersPerBatch: slot.winnersPerBatch,
          ruleVersion: slot.ruleVersion,
        };
      } else {
        batch = {
          id: slot.currentBatchId,
          sequenceNumber: slot.currentBatchSequence,
          status: "OPEN",
          completedAt: null,
          batchSize: slot.batchSize,
          winnersPerBatch: slot.winnersPerBatch,
          ruleVersion: slot.ruleVersion,
        };
      }

      return { coupon: savedCoupon, batch, replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 15_000, timeout: 30_000 });
  } catch (error) {
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
