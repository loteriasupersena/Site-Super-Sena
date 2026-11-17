import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  getAsaasPayment: vi.fn(),
  recordUnexpectedExternalRefund: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: {
    payment: { findFirst: mocks.paymentFindFirst },
  },
}));
vi.mock("@/modules/payments/asaas", () => ({
  getAsaasPayment: mocks.getAsaasPayment,
}));
vi.mock("@/modules/payments/confirm-payment", () => ({
  confirmPixPayment: vi.fn(),
}));
vi.mock("@/modules/payments/record-unexpected-refund", () => ({
  recordUnexpectedExternalRefund: mocks.recordUnexpectedExternalRefund,
}));

import { POST } from "./route";

function request() {
  return new NextRequest("https://example.test/api/payments/asaas/webhook", {
    method: "POST",
    headers: {
      "asaas-access-token": "a".repeat(40),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      id: "evt-refund-1",
      event: "PAYMENT_REFUNDED",
      payment: { id: "pay-1" },
    }),
  });
}

describe("Asaas payment webhook refund validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASAAS_WEBHOOK_TOKEN = "a".repeat(40);
    mocks.getAsaasPayment.mockResolvedValue({
      id: "pay-1",
      billingType: "PIX",
      status: "PENDING",
      pixQrCodeId: "qr-1",
    });
    mocks.paymentFindFirst.mockResolvedValue(null);
  });

  it("does not process a refund notification until Asaas confirms REFUNDED", async () => {
    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: "Estorno ainda não está confirmado no Asaas.",
    });
    expect(mocks.paymentFindFirst).not.toHaveBeenCalled();
    expect(mocks.recordUnexpectedExternalRefund).not.toHaveBeenCalled();
  });

  it("continues reconciliation when the canonical Asaas status is REFUNDED", async () => {
    mocks.getAsaasPayment.mockResolvedValue({
      id: "pay-1",
      billingType: "PIX",
      status: "REFUNDED",
      pixQrCodeId: "qr-1",
    });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(mocks.paymentFindFirst).toHaveBeenCalledOnce();
    expect(mocks.recordUnexpectedExternalRefund).not.toHaveBeenCalled();
  });
});
