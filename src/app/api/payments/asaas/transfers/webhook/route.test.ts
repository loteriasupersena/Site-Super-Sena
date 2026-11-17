import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), webhookFindUnique: vi.fn(), webhookUpsert: vi.fn(),
  withdrawalFindUnique: vi.fn(), withdrawalUpdateMany: vi.fn(), ledgerCreate: vi.fn(),
  historyCreate: vi.fn(), auditCreate: vi.fn(), queryRaw: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/wallet/pix-key-crypto", () => ({ decryptPixKey: vi.fn(() => "52998224725") }));
vi.mock("@/modules/rounds/register-numeric-prize-payout", () => ({
  registerNumericPrizePayout: vi.fn(),
}));
import { POST } from "./route";

function tx() {
  return {
    webhookEvent: { findUnique: mocks.webhookFindUnique, upsert: mocks.webhookUpsert },
    withdrawal: { findUnique: mocks.withdrawalFindUnique, updateMany: mocks.withdrawalUpdateMany },
    ledgerEntry: { create: mocks.ledgerCreate },
    withdrawalStatusHistory: { create: mocks.historyCreate },
    auditEvent: { create: mocks.auditCreate },
    $queryRaw: mocks.queryRaw,
  };
}
function request(event = "TRANSFER_DONE", value = 50) {
  return new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
    method: "POST",
    headers: { "asaas-access-token": "a".repeat(40), "content-type": "application/json" },
    body: JSON.stringify({
      id: "evt-1", event,
      transfer: { id: "trf-1", status: "DONE", externalReference: "wallet_withdrawal_wdr_12345678", value, operationType: "PIX", bankAccount: { pixAddressKey: "52998224725" } },
    }),
  });
}
describe("Asaas wallet transfer webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASAAS_WEBHOOK_TOKEN = "a".repeat(40);
    mocks.webhookFindUnique.mockResolvedValue(null);
    mocks.webhookUpsert.mockResolvedValue({});
    mocks.queryRaw.mockResolvedValue([]);
    mocks.withdrawalFindUnique.mockResolvedValue({
      id: "wdr_12345678", status: "PROCESSING", amountCents: 5000,
      paymentReference: "wallet_withdrawal_wdr_12345678", asaasTransferId: null,
      reviewedById: "admin-1", userId: "player-1", pixKeyEncrypted: "encrypted", pixKeyType: "CPF",
    });
    mocks.withdrawalUpdateMany.mockResolvedValue({ count: 1 });
    mocks.ledgerCreate.mockResolvedValue({});
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("rejects a webhook with an invalid access token", async () => {
    const response = await POST(new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
      method: "POST", headers: { "asaas-access-token": "wrong" }, body: "{}",
    }));
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("marks a wallet withdrawal paid only after a matching PIX transfer confirmation", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, outcome: "WITHDRAWAL_PAID" });
    expect(mocks.withdrawalUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "wdr_12345678", status: { in: ["PROCESSING", "FAILED"] }, paymentReference: "wallet_withdrawal_wdr_12345678" },
      data: expect.objectContaining({ status: "PAID", asaasTransferId: "trf-1", providerRef: "trf-1" }),
    }));
    expect(mocks.ledgerCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      withdrawalId: "wdr_12345678", type: "WITHDRAWAL_PAID", amountCents: 0,
      idempotencyKey: "withdrawal-paid:wdr_12345678",
    }) });
    expect(mocks.historyCreate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "WITHDRAWAL_ASAAS_TRANSFER_CONFIRMED", entityId: "wdr_12345678",
    }) });
  });

  it("rejects a transfer sent to a different Pix beneficiary", async () => {
    const mismatched = request();
    const body = await mismatched.text();
    const changed = new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
      method: "POST",
      headers: { "asaas-access-token": "a".repeat(40), "content-type": "application/json" },
      body: body.replace('"pixAddressKey":"52998224725"', '"pixAddressKey":"11111111111"'),
    });
    const response = await POST(changed);
    expect(response.status).toBe(409);
    expect(mocks.withdrawalUpdateMany).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it("rejects a transfer with a mismatched amount", async () => {
    const response = await POST(request("TRANSFER_DONE", 49.99));
    expect(response.status).toBe(409);
    expect(mocks.withdrawalUpdateMany).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it("does not process a duplicate webhook event twice", async () => {
    mocks.webhookFindUnique.mockResolvedValue({ processedAt: new Date() });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "DUPLICATE" });
    expect(mocks.withdrawalUpdateMany).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });
});
