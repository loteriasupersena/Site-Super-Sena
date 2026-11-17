import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  paymentFindFirst: vi.fn(),
  getAsaasPayment: vi.fn(),
  recordUnexpectedExternalRefund: vi.fn(),
  webhookEventUpsert: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: {
    payment: { findFirst: mocks.paymentFindFirst },
    webhookEvent: { upsert: mocks.webhookEventUpsert },
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

function request(payload: unknown = {
  id: "evt-refund-1",
  event: "PAYMENT_REFUNDED",
  payment: { id: "pay-1" },
}) {
  return new NextRequest("https://example.test/api/payments/asaas/webhook", {
    method: "POST",
    headers: {
      "asaas-access-token": "a".repeat(40),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload) ?? "{}",
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
    mocks.webhookEventUpsert.mockResolvedValue({});
  });

  it("acknowledges unsupported events before requiring payment-specific fields", async () => {
    const response = await POST(request({ event: "PAYMENT_CREATED" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, ignored: true });
    expect(mocks.getAsaasPayment).not.toHaveBeenCalled();
    expect(mocks.webhookEventUpsert).not.toHaveBeenCalled();
  });

  it("quarantines a supported event with a missing payment id and acknowledges delivery", async () => {
    const response = await POST(request({ id: "evt-without-payment", event: "PAYMENT_RECEIVED" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, quarantined: true });
    expect(mocks.webhookEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ eventType: "PAYMENT_RECEIVED", processingError: "missing_payment_id" }),
    }));
    expect(mocks.getAsaasPayment).not.toHaveBeenCalled();
  });

  it("quarantines invalid JSON without repeatedly penalizing the Asaas queue", async () => {
    const invalid = new NextRequest("https://example.test/api/payments/asaas/webhook", {
      method: "POST",
      headers: { "asaas-access-token": "a".repeat(40), "content-type": "application/json" },
      body: "{invalid",
    });
    const response = await POST(invalid);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ received: true, quarantined: true });
    expect(mocks.webhookEventUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ eventType: "INVALID_PAYLOAD", processingError: "invalid_json" }),
    }));
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
