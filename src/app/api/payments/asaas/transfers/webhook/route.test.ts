import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getTransfer: vi.fn(),
  findPayout: vi.fn(),
  eventFind: vi.fn(),
  eventUpsert: vi.fn(),
  eventUpdate: vi.fn(),
  couponUpdateMany: vi.fn(),
  couponFind: vi.fn(),
  payoutUpdate: vi.fn(),\n  payoutFindInTx: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { couponPayout: { findUnique: mocks.findPayout }, $transaction: mocks.transaction },
}));
vi.mock("@/modules/payments/asaas", () => ({ getAsaasTransfer: mocks.getTransfer }));
vi.mock("@/lib/wallet/store-pix-key", () => ({ decryptStorePixKey: () => "customer@example.test" }));

import { POST } from "./route";

describe("Asaas coupon transfer webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "t".repeat(40));
    mocks.getTransfer.mockResolvedValue({
      id: "transfer-1", status: "PENDING", externalReference: "coupon-payout-1",
      operationType: "PIX", value: 25, bankAccount: { pixAddressKey: "customer@example.test" },
    });
    mocks.findPayout.mockResolvedValue({
      id: "payout-1", couponId: "coupon-1", storeId: "store-1", requestedById: "cashier-1",
      kind: "CUSTOMER_REDEMPTION", status: "PROCESSING", amountCents: 2500,
      providerTransferId: "transfer-1", pixKeyCiphertext: "ciphertext", pixKeyType: "EMAIL",
      coupon: { status: "WINNER" },
    });
    mocks.eventFind.mockResolvedValue(null);
    mocks.eventUpsert.mockResolvedValue({});
    mocks.eventUpdate.mockResolvedValue({});
    mocks.couponUpdateMany.mockResolvedValue({ count: 1 });
    mocks.couponFind.mockResolvedValue({ status: "REDEEMED" });
    mocks.payoutUpdate.mockResolvedValue({});\n    mocks.payoutFindInTx.mockResolvedValue({ status: "PROCESSING" });
    mocks.auditCreate.mockResolvedValue({});
    const tx = {
      asaasWebhookEvent: { findUnique: mocks.eventFind, upsert: mocks.eventUpsert, update: mocks.eventUpdate },
      coupon: { updateMany: mocks.couponUpdateMany, findUnique: mocks.couponFind },
      couponPayout: { update: mocks.payoutUpdate, findUnique: mocks.payoutFindInTx },
      auditEvent: { create: mocks.auditCreate },
    };
    mocks.transaction.mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  });

  function request(payload: unknown, token = "t".repeat(40)) {
    return new Request("https://example.test/api/payments/asaas/transfers/webhook", {
      method: "POST", headers: { "content-type": "application/json", "asaas-access-token": token },
      body: JSON.stringify(payload),
    }) as never;
  }
  const notification = (event = "TRANSFER_PENDING") => ({
    id: "evt-1", event, transfer: { id: "transfer-1", externalReference: "coupon-payout-1" },
  });

  it("keeps a payout processing while the provider transfer is pending", async () => {
    const response = await POST(request(notification()));
    expect(response.status).toBe(200);
    expect(mocks.payoutUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payout-1" },
      data: expect.objectContaining({ status: "PROCESSING", providerStatus: "PENDING" }),
    }));
    expect(mocks.couponUpdateMany).not.toHaveBeenCalled();
  });

  it("marks the coupon and payout paid only after canonical DONE and matching Pix destination", async () => {
    mocks.getTransfer.mockResolvedValueOnce({
      id: "transfer-1", status: "DONE", externalReference: "coupon-payout-1",
      operationType: "PIX", value: 25, bankAccount: { pixAddressKey: "customer@example.test" },
      transactionReceiptUrl: "https://receipt.example.test/1",
    });
    const response = await POST(request(notification("TRANSFER_DONE")));
    expect(response.status).toBe(200);
    expect(mocks.couponUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "coupon-1", storeId: "store-1", status: "WINNER" },
      data: expect.objectContaining({ status: "REDEEMED" }),
    }));
    expect(mocks.payoutUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "PAID", providerStatus: "DONE", providerTransferId: "transfer-1" }),
    }));
  });

  it("does not mark paid when the provider destination differs", async () => {
    mocks.getTransfer.mockResolvedValueOnce({
      id: "transfer-1", status: "DONE", externalReference: "coupon-payout-1",
      operationType: "PIX", value: 25, bankAccount: { pixAddressKey: "wrong@example.test" },
    });
    const response = await POST(request(notification("TRANSFER_DONE")));
    expect(response.status).toBe(409);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a transfer amount mismatch", async () => {
    mocks.getTransfer.mockResolvedValueOnce({
      id: "transfer-1", status: "DONE", externalReference: "coupon-payout-1",
      operationType: "PIX", value: 24.99, bankAccount: { pixAddressKey: "customer@example.test" },
    });
    const response = await POST(request(notification("TRANSFER_DONE")));
    expect(response.status).toBe(409);
    expect(mocks.payoutUpdate).not.toHaveBeenCalled();
  });

  it("acknowledges an already processed event without applying it again", async () => {
    mocks.eventFind.mockResolvedValueOnce({ processedAt: new Date() });
    const response = await POST(request(notification()));
    expect(response.status).toBe(200);
    expect(mocks.payoutUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("does not replay side effects when another event already paid the payout", async () => {
    // The outer lookup is intentionally stale; the transaction sees the committed state.
    mocks.payoutFindInTx.mockResolvedValueOnce({ status: "PAID" });
    const response = await POST(request(notification("TRANSFER_DONE")));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "ALREADY_PAID" });
    expect(mocks.couponUpdateMany).not.toHaveBeenCalled();
    expect(mocks.payoutUpdate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects an invalid webhook token", async () => {
    const response = await POST(request(notification(), "invalid"));
    expect(response.status).toBe(401);
    expect(mocks.getTransfer).not.toHaveBeenCalled();
  });
});
