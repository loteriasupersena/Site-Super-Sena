import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  withdrawalFindUnique: vi.fn(),
  prizeRequestFindUnique: vi.fn(),
  batchFindUnique: vi.fn(),
  auditCreate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: {
    withdrawal: { findUnique: mocks.withdrawalFindUnique },
    prizePaymentRequest: { findUnique: mocks.prizeRequestFindUnique },
    prizePaymentBatch: { findUnique: mocks.batchFindUnique },
    auditEvent: { create: mocks.auditCreate },
  },
}));
import { POST } from "./route";

function makeRequest(value = 10, pixAddressKey = "52998224725") {
  return new NextRequest("https://example.test/api/payments/asaas/transfers/validate", {
    method: "POST",
    headers: { "asaas-access-token": "v".repeat(40), "content-type": "application/json" },
    body: JSON.stringify({
      type: "TRANSFER",
      transfer: {
        id: "trf-123",
        status: "PENDING",
        value,
        operationType: "PIX",
        bankAccount: { pixAddressKey },
      },
    }),
  });
}

describe("Asaas transfer validation webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASAAS_TRANSFER_VALIDATION_TOKEN = "v".repeat(40);
    mocks.withdrawalFindUnique.mockResolvedValue({
      id: "wdr_12345678", status: "PROCESSING", amountCents: 1000,
      pixKey: "529.982.247-25", pixKeyType: "CPF",
    });
    mocks.prizeRequestFindUnique.mockResolvedValue(null);
    mocks.batchFindUnique.mockResolvedValue(null);
    mocks.auditCreate.mockResolvedValue({});
  });

  it("approves a registered transfer with matching amount and Pix beneficiary", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("refuses a transfer with a different beneficiary", async () => {
    const response = await POST(makeRequest(10, "11111111111"));
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("REFUSED");
  });

  it("refuses an unknown transfer", async () => {
    mocks.withdrawalFindUnique.mockResolvedValue(null);
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("REFUSED");
  });
});
