import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const providerMocks = vi.hoisted(() => ({
  createAsaasPixTransfer: vi.fn(),
  createAsaasStaticPixQrCode: vi.fn(),
}));

vi.mock("@/modules/payments/asaas", () => providerMocks);

import { authPrisma } from "@/lib/auth/session";
import { encryptStorePixKey } from "@/lib/wallet/store-pix-key";
import { createStoreBillingPixCharge } from "./create-store-billing";
import { startCouponPixPayout } from "./start-coupon-pix-payout";

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;
const LOAD = 300;
const databaseUrl = process.env.DATABASE_URL ?? "";

suite("PostgreSQL coupon payout and store billing concurrency", () => {
  if (enabled) {
    if (!databaseUrl) throw new Error("DATABASE_URL is required for coupon payment load tests");
    const parsed = new URL(databaseUrl);
    if (!["localhost", "127.0.0.1", "::1", "postgres"].includes(parsed.hostname)
      || parsed.pathname.replace(/^\//, "").split("?")[0] !== "superquina_test") {
      throw new Error("Refusing to run coupon payment load tests outside local superquina_test");
    }
  }

  const suffix = randomUUID();
  const userIds: string[] = [];
  const storeIds: string[] = [];
  const couponIds: string[] = [];
  const billingIds: string[] = [];
  let batchId = "";

  beforeAll(async () => {
    await authPrisma.$connect();
    const batch = await authPrisma.couponBatch.create({
      data: { sequenceNumber: 900_000 + Math.floor(Math.random() * 50_000), batchSize: 100_000, winnersPerBatch: 1, ruleVersion: 1 },
      select: { id: true },
    });
    batchId = batch.id;

    const adminId = `it-coupon-payout-admin-${suffix}`;
    const cashierId = `it-coupon-payout-cashier-${suffix}`;
    userIds.push(adminId, cashierId);
    await authPrisma.user.create({ data: { id: adminId, username: adminId, passwordHash: "integration-test", role: "STORE_ADMIN" } });
    const payoutStore = await authPrisma.store.create({
      data: { name: "Integration Coupon Payout Store", adminUserId: adminId, commissionRateBasisPoints: 1000, couponLimit: 1000, outstandingCouponCount: LOAD * 2 },
      select: { id: true },
    });
    storeIds.push(payoutStore.id);
    await authPrisma.user.create({
      data: { id: cashierId, username: cashierId, passwordHash: "integration-test", role: "CASHIER", storeId: payoutStore.id },
    });
    const storePix = "payout-store-" + suffix + "@example.test";
    await authPrisma.storePixKey.create({
      data: {
        storeId: payoutStore.id,
        keyCiphertext: encryptStorePixKey(storePix),
        keyMasked: "p***@example.test",
        keyType: "EMAIL",
        validatedAt: new Date(),
      },
    });

    const rows = Array.from({ length: LOAD * 2 }, (_, index) => ({
      publicCode: `it-coupon-payout-${suffix}-${index}`,
      idempotencyKey: `it-coupon-payout-idem-${suffix}-${index}`,
      storeId: payoutStore.id,
      issuedById: cashierId,
      batchId,
      purchaseAmountCents: 1000 + index,
      commissionRateBasisPoints: 1000,
      platformFeeCents: 100,
      status: index < LOAD ? "WINNER" as const : "STORE_CLAIMABLE" as const,
      customerRedemptionDeadline: index < LOAD
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : new Date(Date.now() - 24 * 60 * 60 * 1000),
    }));
    await authPrisma.coupon.createMany({ data: rows });
    const coupons = await authPrisma.coupon.findMany({
      where: { storeId: payoutStore.id },
      orderBy: { publicCode: "asc" },
      select: { id: true, status: true },
    });
    couponIds.push(...coupons.map((coupon) => coupon.id));

    providerMocks.createAsaasPixTransfer.mockImplementation(async (input: { externalReference: string }) => ({
      id: "it-transfer-" + input.externalReference.slice(-32),
      status: "PENDING",
    }));
    providerMocks.createAsaasStaticPixQrCode.mockImplementation(async (input: { externalReference: string }) => ({
      id: "it-qr-" + input.externalReference.slice(-32),
      payload: "000201-test",
      encodedImage: "aW50ZWdyYXRpb24=",
      externalReference: input.externalReference,
    }));
  });

  afterAll(async () => {
    if (billingIds.length) {
      await authPrisma.storeBillingCoupon.deleteMany({ where: { billingId: { in: billingIds } } });
      await authPrisma.storeBilling.deleteMany({ where: { id: { in: billingIds } } });
    }
    if (couponIds.length) {
      await authPrisma.couponPayout.deleteMany({ where: { couponId: { in: couponIds } } });
      await authPrisma.storeBillingCoupon.deleteMany({ where: { couponId: { in: couponIds } } });
      await authPrisma.coupon.deleteMany({ where: { id: { in: couponIds } } });
    }
    if (storeIds.length) {
      await authPrisma.storePixKey.deleteMany({ where: { storeId: { in: storeIds } } });
      await authPrisma.store.deleteMany({ where: { id: { in: storeIds } } });
    }
    if (userIds.length) await authPrisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (batchId) await authPrisma.couponBatch.deleteMany({ where: { id: batchId } });
    await authPrisma.$disconnect();
  });

  it("reserves 300 customer redemptions and 300 store claims concurrently without duplicate payouts", async () => {
    const payoutStore = await authPrisma.store.findFirstOrThrow({
      where: { id: { in: storeIds } },
      select: { id: true, adminUserId: true, users: { where: { role: "CASHIER" }, select: { id: true }, take: 1 } },
    });
    const customerCoupons = await authPrisma.coupon.findMany({
      where: { id: { in: couponIds }, status: "WINNER" },
      select: { id: true, purchaseAmountCents: true },
    });
    const storeCoupons = await authPrisma.coupon.findMany({
      where: { id: { in: couponIds }, status: "STORE_CLAIMABLE" },
      select: { id: true, purchaseAmountCents: true },
    });
    const customerResults = await Promise.allSettled(customerCoupons.map((coupon, index) =>
      startCouponPixPayout({
        couponId: coupon.id,
        storeId: payoutStore.id,
        actorId: payoutStore.users[0]!.id,
        kind: "CUSTOMER_REDEMPTION",
        customerPix: { pixKey: `customer-${suffix}-${index}@example.test`, pixKeyType: "EMAIL" },
      }),
    ));
    const storeResults = await Promise.allSettled(storeCoupons.map((coupon) =>
      startCouponPixPayout({
        couponId: coupon.id,
        storeId: payoutStore.id,
        actorId: payoutStore.adminUserId,
        kind: "STORE_EXPIRED_CLAIM",
      }),
    ));

    expect(customerResults.filter((result) => result.status === "rejected").map((result) => String((result as PromiseRejectedResult).reason))).toEqual([]);
    expect(storeResults.filter((result) => result.status === "rejected").map((result) => String((result as PromiseRejectedResult).reason))).toEqual([]);
    expect(customerResults).toHaveLength(LOAD);
    expect(storeResults).toHaveLength(LOAD);
    expect(await authPrisma.couponPayout.count({ where: { storeId: payoutStore.id, kind: "CUSTOMER_REDEMPTION" } })).toBe(LOAD);
    expect(await authPrisma.couponPayout.count({ where: { storeId: payoutStore.id, kind: "STORE_EXPIRED_CLAIM" } })).toBe(LOAD);
    expect(await authPrisma.couponPayout.count({ where: { storeId: payoutStore.id, status: "PROCESSING" } })).toBe(LOAD * 2);
    expect(providerMocks.createAsaasPixTransfer).toHaveBeenCalledTimes(LOAD * 2);
    expect(new Set(providerMocks.createAsaasPixTransfer.mock.calls.map(([input]) => input.externalReference)).size).toBe(LOAD * 2);
  }, 180_000);

  it("creates 300 independent store batch charges concurrently without mixing store balances", async () => {
    const storeBatch = await authPrisma.couponBatch.create({
      data: { sequenceNumber: 950_000 + Math.floor(Math.random() * 40_000), batchSize: 100_000, winnersPerBatch: 1, ruleVersion: 1 },
      select: { id: true },
    });
    const stores: Array<{ id: string; adminId: string; couponId: string; feeCents: number }> = [];
    try {
      for (let index = 0; index < LOAD; index += 1) {
        const adminId = `it-store-billing-admin-${suffix}-${index}`;
        userIds.push(adminId);
        await authPrisma.user.create({
          data: { id: adminId, username: adminId, passwordHash: "integration-test", role: "STORE_ADMIN" },
        });
        const store = await authPrisma.store.create({
          data: {
            name: `Integration Billing Store ${index}`,
            adminUserId: adminId,
            commissionRateBasisPoints: 1000,
            couponLimit: 10,
            outstandingCouponCount: 1,
          },
          select: { id: true },
        });
        storeIds.push(store.id);
        const feeCents = 25 + (index % 75);
        const coupon = await authPrisma.coupon.create({
          data: {
            publicCode: `it-store-billing-${suffix}-${index}`,
            idempotencyKey: `it-store-billing-idem-${suffix}-${index}`,
            storeId: store.id,
            issuedById: adminId,
            batchId: storeBatch.id,
            purchaseAmountCents: 1000,
            commissionRateBasisPoints: 1000,
            platformFeeCents: feeCents,
          },
          select: { id: true },
        });
        couponIds.push(coupon.id);
        stores.push({ id: store.id, adminId, couponId: coupon.id, feeCents });
      }

      const results = await Promise.allSettled(stores.map((store) => createStoreBillingPixCharge({ storeId: store.id })));
      const failures = results.filter((result) => result.status === "rejected");
      expect(failures.map((result) => String((result as PromiseRejectedResult).reason))).toEqual([]);
      const billings = results.map((result) => (result as PromiseFulfilledResult<Awaited<ReturnType<typeof createStoreBillingPixCharge>>>).value);
      billingIds.push(...billings.map((billing) => billing.id));
      expect(billings).toHaveLength(LOAD);
      expect(new Set(billings.map((billing) => billing.storeId)).size).toBe(LOAD);
      for (const store of stores) {
        const billing = billings.find((item) => item.storeId === store.id);
        expect(billing?.amountCents).toBe(store.feeCents);
        expect(await authPrisma.storeBillingCoupon.count({ where: { billingId: billing!.id, couponId: store.couponId } })).toBe(1);
      }
      expect(providerMocks.createAsaasStaticPixQrCode).toHaveBeenCalledTimes(LOAD);
    } finally {
      await authPrisma.storeBillingCoupon.deleteMany({ where: { billing: { storeId: { in: stores.map((store) => store.id) } } } });
      await authPrisma.storeBilling.deleteMany({ where: { storeId: { in: stores.map((store) => store.id) } } });
      await authPrisma.coupon.deleteMany({ where: { id: { in: stores.map((store) => store.couponId) } } });
      await authPrisma.store.deleteMany({ where: { id: { in: stores.map((store) => store.id) } } });
      await authPrisma.user.deleteMany({ where: { id: { in: stores.map((store) => store.adminId) } } });
      await authPrisma.couponBatch.deleteMany({ where: { id: storeBatch.id } });
    }
  }, 180_000);
});
