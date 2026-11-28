import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authPrisma } from "@/lib/auth/session";
import { issueCoupon } from "./issue-coupon";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;

suite("PostgreSQL coupon issuance load and concurrency", () => {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (enabled) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for coupon load integration tests");
    const parsed = new URL(databaseUrl);
    if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(parsed.hostname)
      || parsed.pathname.replace(/^\//, "").split("?")[0] !== "superquina_test") {
      throw new Error("Refusing to run coupon load tests outside local superquina_test");
    }
  }

  const suffix = randomUUID();
  const storeIds: string[] = [];
  const userIds: string[] = [];
  let initialQueue: {
    currentBatchId: string | null;
    currentBatchSequence: number;
    currentBatchCount: number;
    nextBatchSequence: number;
  } | null = null;
  let initialBatch: { id: string; sequenceNumber: number; status: "OPEN" | "DRAWN"; completedAt: Date | null; winnerCouponId: string | null } | null = null;
  let initialMembers: Array<{ id: string; status: "ACTIVE" | "WINNER" | "REDEEMED" | "EXPIRED" | "STORE_CLAIMABLE" | "STORE_REDEEMED"; drawnAt: Date | null; customerRedemptionDeadline: Date | null }> = [];

  beforeAll(async () => {
    await authPrisma.$connect();
    const queue = await authPrisma.couponQueueState.findUniqueOrThrow({ where: { id: "global" } });
    initialQueue = {
      currentBatchId: queue.currentBatchId,
      currentBatchSequence: queue.currentBatchSequence,
      currentBatchCount: queue.currentBatchCount,
      nextBatchSequence: queue.nextBatchSequence,
    };
    if (!queue.currentBatchId) throw new Error("Global coupon queue has no active batch");
    const batch = await authPrisma.couponBatch.findUniqueOrThrow({ where: { id: queue.currentBatchId } });
    initialBatch = {
      id: batch.id,
      sequenceNumber: batch.sequenceNumber,
      status: batch.status,
      completedAt: batch.completedAt,
      winnerCouponId: batch.winnerCouponId,
    };
    initialMembers = await authPrisma.coupon.findMany({
      where: { batchId: batch.id },
      select: { id: true, status: true, drawnAt: true, customerRedemptionDeadline: true },
    });
  });

  afterAll(async () => {
    if (storeIds.length && initialQueue && initialBatch) {
      const testCoupons = await authPrisma.coupon.findMany({
        where: { storeId: { in: storeIds } },
        select: { id: true, batchId: true },
      });
      const batchesCreatedDuringTest = await authPrisma.couponBatch.findMany({
        where: { sequenceNumber: { gte: initialQueue.nextBatchSequence } },
        select: { id: true },
      });
      const touchedBatchIds = [...new Set([
        ...testCoupons.map((coupon) => coupon.batchId),
        ...batchesCreatedDuringTest.map((batch) => batch.id),
      ])];
      if (touchedBatchIds.length) {
        await authPrisma.couponBatch.updateMany({
          where: { id: { in: touchedBatchIds } },
          data: { winnerCouponId: null, status: "OPEN", completedAt: null },
        });
      }
      await authPrisma.coupon.deleteMany({ where: { storeId: { in: storeIds } } });
      const createdBatchIds = touchedBatchIds.filter((id) => id !== initialBatch!.id);
      if (createdBatchIds.length) {
        await authPrisma.couponBatch.deleteMany({ where: { id: { in: createdBatchIds } } });
      }
      await authPrisma.couponBatch.update({
        where: { id: initialBatch.id },
        data: {
          status: initialBatch.status,
          completedAt: initialBatch.completedAt,
          winnerCouponId: initialBatch.winnerCouponId,
        },
      });
      for (const member of initialMembers) {
        await authPrisma.coupon.update({
          where: { id: member.id },
          data: {
            status: member.status,
            drawnAt: member.drawnAt,
            customerRedemptionDeadline: member.customerRedemptionDeadline,
          },
        });
      }
      await authPrisma.couponQueueState.update({
        where: { id: "global" },
        data: initialQueue,
      });
      await authPrisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    if (userIds.length) await authPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    await authPrisma.$disconnect();
  });

  it("issues 1,000 coupons concurrently across 20 independent stores without duplicates or lost slots", async () => {
    const cashiers: Array<{ id: string; storeId: string }> = [];

    for (let index = 0; index < 20; index += 1) {
      const adminId = `it-coupon-admin-${suffix}-${index}`;
      const cashierId = `it-coupon-cashier-${suffix}-${index}`;
      userIds.push(adminId, cashierId);
      await authPrisma.user.create({
        data: {
          id: adminId,
          username: `it-coupon-admin-${suffix}-${index}`,
          passwordHash: "integration-test",
          role: "STORE_ADMIN",
        },
      });
      const store = await authPrisma.store.create({
        data: {
          name: `Integration Coupon Store ${index}`,
          adminUserId: adminId,
          commissionRateBasisPoints: 1000,
          couponLimit: 100,
        },
      });
      storeIds.push(store.id);
      await authPrisma.user.create({
        data: {
          id: cashierId,
          username: `it-coupon-cashier-${suffix}-${index}`,
          passwordHash: "integration-test",
          role: "CASHIER",
          storeId: store.id,
        },
      });
      cashiers.push({ id: cashierId, storeId: store.id });
    }

    const jobs = Array.from({ length: 1000 }, (_, index) => {
      const cashier = cashiers[index % cashiers.length]!;
      return issueCoupon({
        issuedById: cashier.id,
        idempotencyKey: `it-coupon-load-${suffix}-${index}`,
        purchaseAmountCents: 1000,
      });
    });
    // Keep pressure bounded to the 20 independent store actors. Launching all
    // 1,000 transactions at once only exhausts the test database connection
    // pool before transactions can start; it does not exercise useful queue
    // concurrency. Each wave still races across all stores.
    const results: PromiseSettledResult<Awaited<ReturnType<typeof issueCoupon>>>[] = [];
    for (let offset = 0; offset < jobs.length; offset += cashiers.length) {
      const wave = await Promise.allSettled(jobs.slice(offset, offset + cashiers.length));
      results.push(...wave);
    }
    const failures = results.filter((result) => result.status === "rejected");
    expect(failures, failures.map((result) => String((result as PromiseRejectedResult).reason)).join("\n")).toHaveLength(0);

    const issued = results.map((result) => (result as PromiseFulfilledResult<Awaited<ReturnType<typeof issueCoupon>>>).value);
    expect(issued).toHaveLength(1000);
    expect(new Set(issued.map((result) => result.coupon.id)).size).toBe(1000);
    expect(new Set(issued.map((result) => result.coupon.publicCode)).size).toBe(1000);

    const stores = await authPrisma.store.findMany({
      where: { id: { in: storeIds } },
      select: { outstandingCouponCount: true },
    });
    expect(stores).toHaveLength(20);
    expect(stores.every((store) => store.outstandingCouponCount === 50)).toBe(true);

    const testBatches = await authPrisma.couponBatch.findMany({
      where: { coupons: { some: { storeId: { in: storeIds } } } },
      select: {
        id: true,
        status: true,
        winnerCouponId: true,
        _count: { select: { coupons: true } },
      },
    });
    expect(testBatches.length).toBeGreaterThanOrEqual(10);
    for (const batch of testBatches) {
      if (batch.status === "DRAWN") {
        expect(batch._count.coupons).toBe(100);
        expect(batch.winnerCouponId).toBeTruthy();
      } else {
        expect(batch._count.coupons).toBeLessThan(100);
        expect(batch.winnerCouponId).toBeNull();
      }
    }

    const duplicate = await issueCoupon({
      issuedById: cashiers[0]!.id,
      idempotencyKey: `it-coupon-load-${suffix}-0`,
      purchaseAmountCents: 1000,
    });
    expect(duplicate.replayed).toBe(true);
    expect(await authPrisma.coupon.count({ where: { storeId: { in: storeIds } } })).toBe(1000);
  }, 180_000);
});
