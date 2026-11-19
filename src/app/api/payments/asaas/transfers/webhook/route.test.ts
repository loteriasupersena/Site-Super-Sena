import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), webhookFindUnique: vi.fn(), webhookUpsert: vi.fn(),
  withdrawalFindUnique: vi.fn(), withdrawalUpdateMany: vi.fn(), ledgerCreate: vi.fn(),
  historyCreate: vi.fn(), auditCreate: vi.fn(), queryRaw: vi.fn(), withdrawalUpdate: vi.fn(), asaasFetch: vi.fn(),
  batchFindUnique: vi.fn(), batchUpdate: vi.fn(), batchUpdateOne: vi.fn(), prizeRequestUpdateMany: vi.fn(), registerPayout: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { $transaction: mocks.transaction },
}));
vi.mock("@/modules/rounds/register-numeric-prize-payout", () => ({
  registerNumericPrizePayout: mocks.registerPayout,
}));
import { POST } from "./route";

function tx() {
  return {
    webhookEvent: { findUnique: mocks.webhookFindUnique, upsert: mocks.webhookUpsert },
    withdrawal: { findUnique: mocks.withdrawalFindUnique, updateMany: mocks.withdrawalUpdateMany, update: mocks.withdrawalUpdate },
    ledgerEntry: { create: mocks.ledgerCreate },
    withdrawalStatusHistory: { create: mocks.historyCreate },
    auditEvent: { create: mocks.auditCreate },
    prizePaymentBatch: { findUnique: mocks.batchFindUnique, updateMany: mocks.batchUpdate, update: mocks.batchUpdateOne },
    prizePaymentRequest: { updateMany: mocks.prizeRequestUpdateMany },
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

function batchRequest() {
  return new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
    method: "POST",
    headers: { "asaas-access-token": "a".repeat(40), "content-type": "application/json" },
    body: JSON.stringify({
      id: "evt-batch-1", event: "TRANSFER_DONE",
      transfer: { id: "trf-batch-1", status: "DONE", externalReference: "prize_batch_ppb_12345678", value: 50, operationType: "PIX", bankAccount: { pixAddressKey: "11999999999" } },
    }),
  });
}

describe("Asaas wallet transfer webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.asaasFetch);
    mocks.asaasFetch.mockResolvedValue(new Response(JSON.stringify({
      id: "trf-1", status: "DONE", externalReference: "wallet_withdrawal_wdr_12345678",
      value: 50, operationType: "PIX", bankAccount: { pixAddressKey: "52998224725" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    mocks.withdrawalUpdate.mockResolvedValue({});
    process.env.ASAAS_WEBHOOK_TOKEN = "a".repeat(40);
    process.env.ASAAS_API_KEY = "asaas-test-key";
    mocks.webhookFindUnique.mockResolvedValue(null);
    mocks.webhookUpsert.mockResolvedValue({});
    mocks.queryRaw.mockResolvedValue([]);
    mocks.withdrawalFindUnique.mockResolvedValue({
      id: "wdr_12345678", status: "PROCESSING", amountCents: 5000,
      paymentReference: "wallet_withdrawal_wdr_12345678", asaasTransferId: null,
      reviewedById: "admin-1", userId: "player-1", pixKey: "52998224725", pixKeyType: "CPF",
    });
    mocks.withdrawalUpdateMany.mockResolvedValue({ count: 1 });
    mocks.ledgerCreate.mockResolvedValue({});
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.batchUpdate.mockResolvedValue({ count: 1 });
    mocks.batchUpdateOne.mockResolvedValue({});
    mocks.prizeRequestUpdateMany.mockResolvedValue({ count: 1 });
    mocks.registerPayout.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("rejects a webhook with an invalid access token", async () => {
    const response = await POST(new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
      method: "POST", headers: { "asaas-access-token": "wrong" }, body: "{}",
    }));
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });


  it("settles an automatic prize batch after Asaas confirms TRANSFER_DONE without a reviewer", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-batch-1", status: "DONE", externalReference: "prize_batch_ppb_12345678",
      value: 50, operationType: "PIX", bankAccount: { pixAddressKey: "11999999999" },
      transactionReceiptUrl: "https://asaas.test/receipt/1",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    mocks.batchFindUnique.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING",
      paymentReference: "prize_batch_ppb_12345678", asaasTransferId: "trf-batch-1",
      netCents: 5000, pixKey: "11999999999", pixKeyType: "PHONE",
      requests: [{ id: "ppr_12345678", participationLineId: "line-1", status: "PROCESSING" }],
    });

    const response = await POST(batchRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, outcome: "BATCH_PAID" });
    expect(mocks.registerPayout).toHaveBeenCalledWith(expect.anything(), {
      lineId: "line-1", actorId: null, channel: "PLATFORM_PIX",
      reference: "prize_batch_ppb_12345678", expectedRequestStatus: "PROCESSING",
    });
    expect(mocks.batchUpdate).toHaveBeenCalledWith({
      where: { id: "ppb_12345678", status: "PROCESSING", OR: [{ asaasTransferId: null }, { asaasTransferId: "trf-batch-1" }] },
      data: expect.objectContaining({ status: "PAID", asaasTransferId: "trf-batch-1" }),
    });
    expect(mocks.prizeRequestUpdateMany).toHaveBeenCalledWith({
      where: { batchId: "ppb_12345678", status: "PAID" },
      data: expect.objectContaining({ asaasTransferId: "trf-batch-1", pixKey: null }),
    });
  });


  it("releases a failed physical-prize request and makes it eligible for a new receipt request", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-batch-1", status: "FAILED", externalReference: "prize_batch_ppb_12345678",
      value: 50, operationType: "PIX", failReason: "bank rejected transfer",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    mocks.batchFindUnique.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING",
      paymentReference: "prize_batch_ppb_12345678", asaasTransferId: "trf-batch-1",
      netCents: 5000,
      requests: [{ id: "ppr_12345678", participationLineId: "line-1", status: "PROCESSING" }],
    });

    const failedRequest = new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
      method: "POST",
      headers: { "asaas-access-token": "a".repeat(40), "content-type": "application/json" },
      body: JSON.stringify({
        id: "evt-batch-failed", event: "TRANSFER_FAILED",
        transfer: { id: "trf-batch-1", status: "FAILED", externalReference: "prize_batch_ppb_12345678", value: 50, operationType: "PIX" },
      }),
    });
    const response = await POST(failedRequest);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, outcome: "FAILED" });
    expect(mocks.batchUpdateOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ppb_12345678" },
      data: expect.objectContaining({ status: "FAILED", asaasTransferId: "trf-batch-1" }),
    }));
    expect(mocks.prizeRequestUpdateMany).toHaveBeenCalledWith({
      where: { batchId: "ppb_12345678" },
      data: expect.objectContaining({
        status: "REJECTED", batchId: null, asaasTransferId: "trf-batch-1",
        asaasTransferFailureReason: "bank rejected transfer",
      }),
    });
  });


  it("rolls back settlement when not every request row is linked", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-batch-1", status: "DONE", externalReference: "prize_batch_ppb_12345678",
      value: 50, operationType: "PIX", bankAccount: { pixAddressKey: "11999999999" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    mocks.batchFindUnique.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING",
      paymentReference: "prize_batch_ppb_12345678", asaasTransferId: "trf-batch-1",
      netCents: 5000, pixKey: "11999999999", pixKeyType: "PHONE",
      requests: [
        { id: "ppr_1", participationLineId: "line-1", status: "PROCESSING" },
        { id: "ppr_2", participationLineId: "line-2", status: "PROCESSING" },
      ],
    });
    mocks.prizeRequestUpdateMany.mockResolvedValueOnce({ count: 1 });

    const response = await POST(batchRequest());

    expect(response.status).toBe(503);
    expect(mocks.registerPayout).toHaveBeenCalledTimes(2);
    expect(mocks.batchUpdate).toHaveBeenCalledOnce();
    expect(mocks.prizeRequestUpdateMany).toHaveBeenCalledOnce();
  });

  it("settles a prize batch from the confirmed Asaas result without revalidating the Pix key", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-batch-1", status: "DONE", externalReference: "prize_batch_ppb_12345678",
      value: 50, operationType: "PIX", bankAccount: { pixAddressKey: "11111111111" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    mocks.batchFindUnique.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING",
      paymentReference: "prize_batch_ppb_12345678", asaasTransferId: null,
      netCents: 5000, pixKey: "11999999999", pixKeyType: "PHONE",
      requests: [{ id: "ppr_12345678", participationLineId: "line-1", status: "PROCESSING" }],
    });

    const response = await POST(batchRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, outcome: "BATCH_PAID" });
    expect(mocks.registerPayout).toHaveBeenCalledOnce();
    expect(mocks.batchUpdate).toHaveBeenCalledOnce();
  });

  it("marks a wallet withdrawal paid only after a confirmed PIX transfer result", async () => {
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

  it("uses the current Asaas state instead of an intermediate notification", async () => {
    const response = await POST(request("TRANSFER_PENDING"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "WITHDRAWAL_PAID" });
    expect(mocks.asaasFetch).toHaveBeenCalledWith(
      "https://api.asaas.com/v3/transfers/trf-1",
      expect.objectContaining({ method: "GET", cache: "no-store" }),
    );
  });

  it("does not mark failed when the latest Asaas state is still intermediate", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-1", status: "IN_BANK_PROCESSING",
      externalReference: "wallet_withdrawal_wdr_12345678",
      value: 50, operationType: "PIX",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const response = await POST(request("TRANSFER_FAILED"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "WITHDRAWAL_PROCESSING" });
    expect(mocks.withdrawalUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "wdr_12345678", status: { in: ["PROCESSING", "APPROVED"] }, paymentReference: "wallet_withdrawal_wdr_12345678" },
      data: expect.objectContaining({ status: "PROCESSING" }),
    }));
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it("does not trust webhook payload when the Asaas lookup fails", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    const response = await POST(request("TRANSFER_DONE"));
    expect(response.status).toBe(503);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.withdrawalUpdateMany).not.toHaveBeenCalled();
  });

  it("marks a withdrawal paid from the confirmed Asaas result without revalidating the Pix key", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-1", status: "DONE", externalReference: "wallet_withdrawal_wdr_12345678",
      value: 50, operationType: "PIX", bankAccount: { pixAddressKey: "11111111111" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const mismatched = request();
    const body = await mismatched.text();
    const changed = new NextRequest("https://example.test/api/payments/asaas/transfers/webhook", {
      method: "POST",
      headers: { "asaas-access-token": "a".repeat(40), "content-type": "application/json" },
      body: body.replace('"pixAddressKey":"52998224725"', '"pixAddressKey":"11111111111"'),
    });
    const response = await POST(changed);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, outcome: "WITHDRAWAL_PAID" });
    expect(mocks.withdrawalUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.ledgerCreate).toHaveBeenCalledOnce();
  });

  it("rejects a transfer with a mismatched amount", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-1", status: "DONE", externalReference: "wallet_withdrawal_wdr_12345678",
      value: 49.99, operationType: "PIX", bankAccount: { pixAddressKey: "52998224725" },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const response = await POST(request("TRANSFER_DONE", 49.99));
    expect(response.status).toBe(409);
    expect(mocks.withdrawalUpdateMany).not.toHaveBeenCalled();
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
  });

  it("releases the reserved balance exactly once after Asaas confirms a terminal failure", async () => {
    mocks.asaasFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-1", status: "FAILED", externalReference: "wallet_withdrawal_wdr_12345678",
      value: 50, operationType: "PIX", failReason: "bank rejected transfer",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const response = await POST(request("TRANSFER_FAILED"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, outcome: "WITHDRAWAL_FAILED" });
    expect(mocks.withdrawalUpdateMany).toHaveBeenCalledWith({
      where: { id: "wdr_12345678", status: { in: ["PROCESSING", "APPROVED"] }, paymentReference: "wallet_withdrawal_wdr_12345678" },
      data: expect.objectContaining({ status: "FAILED", asaasTransferId: "trf-1" }),
    });
    expect(mocks.ledgerCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "player-1", withdrawalId: "wdr_12345678", type: "WITHDRAWAL_RELEASE",
      amountCents: 5000, idempotencyKey: "withdrawal-release:wdr_12345678",
    }) });
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      fromStatus: "PROCESSING", toStatus: "FAILED",
      note: expect.stringContaining("saldo reservado devolvido à carteira"),
    }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "WITHDRAWAL_ASAAS_TRANSFER_FAILED", entityId: "wdr_12345678",
    }) });
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
