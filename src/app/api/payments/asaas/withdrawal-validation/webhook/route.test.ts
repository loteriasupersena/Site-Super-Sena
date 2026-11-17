import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAsaasTransfer: vi.fn(),
  withdrawalFindUnique: vi.fn(),
  withdrawalUpdateMany: vi.fn(),
  batchFindUnique: vi.fn(),
  batchUpdateMany: vi.fn(),
  requestFindUnique: vi.fn(),
  requestUpdateMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  authPrisma: {
    withdrawal: { findUnique: mocks.withdrawalFindUnique, updateMany: mocks.withdrawalUpdateMany },
    prizePaymentBatch: { findUnique: mocks.batchFindUnique, updateMany: mocks.batchUpdateMany },
    prizePaymentRequest: { findUnique: mocks.requestFindUnique, updateMany: mocks.requestUpdateMany },
  },
}));
vi.mock("@/modules/payments/asaas", () => ({
  getAsaasTransfer: mocks.getAsaasTransfer,
}));

import { POST } from "./route";

const token = "v".repeat(48);
const externalReference = "prize_batch_ppb_12345678";

function request(payload: unknown = { type: "TRANSFER", transfer: { id: "tr_123" } }, receivedToken = token) {
  return new NextRequest("https://example.test/api/payments/asaas/withdrawal-validation/webhook", {
    method: "POST",
    headers: { "asaas-access-token": receivedToken, "content-type": "application/json" },
    body: JSON.stringify(payload) ?? "{}",
  });
}

describe("Asaas withdrawal validation webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASAAS_WITHDRAWAL_VALIDATION_TOKEN = token;
    mocks.getAsaasTransfer.mockResolvedValue({
      id: "tr_123",
      status: "PENDING",
      externalReference,
      value: 1,
      operationType: "PIX",
      bankAccount: { pixAddressKey: "123.456.789-01" },
    });
    mocks.batchFindUnique.mockResolvedValue({
      id: "ppb_12345678",
      status: "PROCESSING",
      paymentReference: externalReference,
      asaasTransferId: null,
      netCents: 100,
      pixKey: "12345678901",
      pixKeyType: "CPF",
      reviewerId: "admin_12345678",
    });
    mocks.batchUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("approves only a recorded Pix transfer with matching amount and beneficiary", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.batchFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "ppb_12345678" },
    }));
    expect(mocks.batchUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { asaasTransferId: "tr_123", asaasTransferStatus: "PENDING" },
    }));
  });

  it("refuses a transfer whose value does not match the registered prize", async () => {
    mocks.getAsaasTransfer.mockResolvedValue({
      id: "tr_123", status: "PENDING", externalReference, value: 2,
      operationType: "PIX", bankAccount: { pixAddressKey: "12345678901" },
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.batchUpdateMany).not.toHaveBeenCalled();
  });

  it("refuses unknown operations instead of approving them", async () => {
    const response = await POST(request({ type: "BILL", bill: { id: "123" } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.getAsaasTransfer).not.toHaveBeenCalled();
  });

  it("refuses requests when the configured authentication token does not match", async () => {
    const response = await POST(request(undefined, "x".repeat(48)));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.getAsaasTransfer).not.toHaveBeenCalled();
  });
});
