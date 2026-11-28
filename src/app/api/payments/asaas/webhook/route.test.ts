import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPayment: vi.fn(),
  findBilling: vi.fn(),
  eventFind: vi.fn(),
  eventUpsert: vi.fn(),
  eventUpdate: vi.fn(),
  billingUpdateMany: vi.fn(),
  billingFindForCounter: vi.fn(),
  storeUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: {
    storeBilling: { findUnique: mocks.findBilling },
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/modules/payments/asaas", () => ({ getAsaasPayment: mocks.getPayment }));

import { POST } from "./route";

describe("Asaas store billing webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "t".repeat(40));
    mocks.getPayment.mockResolvedValue({
      id: "pay-1", status: "RECEIVED", billingType: "PIX",
      value: 125.5, externalReference: "store-billing-store1-2026-11",
    });
    mocks.findBilling.mockResolvedValue({
      id: "billing-1", amountCents: 12550, status: "PENDING",
      providerPaymentId: null, externalReference: "store-billing-store1-2026-11",
    });
    mocks.eventFind.mockResolvedValue(null);
    mocks.eventUpsert.mockResolvedValue({});
    mocks.eventUpdate.mockResolvedValue({});
    mocks.billingUpdateMany.mockResolvedValue({ count: 1 });
    mocks.billingFindForCounter.mockResolvedValue({ storeId: "store-1", _count: { couponLinks: 3 } });
    mocks.storeUpdateMany.mockResolvedValue({ count: 1 });
    const tx = {
      asaasWebhookEvent: {
        findUnique: mocks.eventFind,
        upsert: mocks.eventUpsert,
        update: mocks.eventUpdate,
      },
      storeBilling: { updateMany: mocks.billingUpdateMany, findUnique: mocks.billingFindForCounter },
      store: { updateMany: mocks.storeUpdateMany },
    };
    type WebhookTransaction = {
      asaasWebhookEvent: {
        findUnique: typeof mocks.eventFind;
        upsert: typeof mocks.eventUpsert;
        update: typeof mocks.eventUpdate;
      };
      storeBilling: {
        updateMany: typeof mocks.billingUpdateMany;
        findUnique: typeof mocks.billingFindForCounter;
      };
      store: { updateMany: typeof mocks.storeUpdateMany };
    };
    mocks.transaction.mockImplementation(async (callback: (tx: WebhookTransaction) => unknown) =>
      callback(tx as WebhookTransaction),
    );
  });

  function request(payload: unknown, token = "t".repeat(40)) {
    return new Request("https://example.test/api/payments/asaas/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "asaas-access-token": token },
      body: JSON.stringify(payload),
    }) as never;
  }

  it("marks the exact matching store invoice paid using canonical provider data", async () => {
    const response = await POST(request({
      id: "evt-1", event: "PAYMENT_RECEIVED", payment: { id: "pay-1" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.billingUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "billing-1", status: { not: "PAID" } },
      data: expect.objectContaining({
        status: "PAID", providerPaymentId: "pay-1", lastProviderStatus: "RECEIVED",
      }),
    }));
    expect(mocks.storeUpdateMany).toHaveBeenCalledWith({
      where: { id: "store-1", outstandingCouponCount: { gte: 3 } },
      data: { outstandingCouponCount: { decrement: 3 } },
    });
    expect(mocks.eventUpdate).toHaveBeenCalled();
  });

  it("rejects an incorrect Pix token", async () => {
    const response = await POST(request({
      id: "evt-1", event: "PAYMENT_RECEIVED", payment: { id: "pay-1" },
    }, "wrong"));
    expect(response.status).toBe(401);
    expect(mocks.getPayment).not.toHaveBeenCalled();
  });

  it("rejects amount mismatches without changing billing", async () => {
    mocks.getPayment.mockResolvedValueOnce({
      id: "pay-1", status: "RECEIVED", billingType: "PIX",
      value: 125.49, externalReference: "store-billing-store1-2026-11",
    });
    const response = await POST(request({
      id: "evt-1", event: "PAYMENT_RECEIVED", payment: { id: "pay-1" },
    }));
    expect(response.status).toBe(422);
    expect(mocks.billingUpdateMany).not.toHaveBeenCalled();
  });

  it("ignores unrelated Asaas events", async () => {
    const response = await POST(request({
      id: "evt-2", event: "PAYMENT_CREATED", payment: { id: "pay-1" },
    }));
    expect(response.status).toBe(200);
    expect(mocks.getPayment).not.toHaveBeenCalled();
  });
});
