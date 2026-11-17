import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listAsaasPaymentsByQrCode: vi.fn(),
  getAsaasPayment: vi.fn(),
  confirmPixPayment: vi.fn(),
}));

vi.mock("@/modules/payments/asaas", () => ({
  listAsaasPaymentsByQrCode: mocks.listAsaasPaymentsByQrCode,
  getAsaasPayment: mocks.getAsaasPayment,
}));
vi.mock("@/modules/payments/confirm-payment", () => ({
  confirmPixPayment: mocks.confirmPixPayment,
}));

import { reconcilePixPaymentFromProvider } from "./reconcile-pix-payment";

function makePrisma(provider = "ASAAS") {
  return {
    payment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "payment-1",
        purchaseId: "purchase-1",
        provider,
        providerQrCodeId: "qr-1",
        amountCents: 200,
        status: "PENDING",
        purchase: { totalCents: 200, status: "PENDING_PAYMENT" },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("reconcilePixPaymentFromProvider (Asaas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listAsaasPaymentsByQrCode.mockResolvedValue([{ id: "pay-1", status: "RECEIVED" }]);
    mocks.getAsaasPayment.mockResolvedValue({
      id: "pay-1",
      status: "RECEIVED",
      billingType: "PIX",
      pixQrCodeId: "qr-1",
      externalReference: "superquina_purchase_purchase-1",
      value: 2,
    });
    mocks.confirmPixPayment.mockResolvedValue({ outcome: "confirmed" });
  });

  it("confirms only a canonical Asaas Pix payment matching QR, reference and amount", async () => {
    const prisma = makePrisma();
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("confirmed");
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { providerPaymentId: "pay-1", providerStatus: "RECEIVED", providerStatusDetail: "received" },
    });
    expect(mocks.confirmPixPayment).toHaveBeenCalledWith(prisma, {
      paymentId: "payment-1",
      providerStatus: "RECEIVED",
      providerStatusDetail: "received",
    });
  });

  it("leaves the purchase pending when Asaas has not received the Pix", async () => {
    const prisma = makePrisma();
    mocks.listAsaasPaymentsByQrCode.mockResolvedValue([{ id: "pay-1", status: "PENDING" }]);
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("still_pending");
    expect(mocks.getAsaasPayment).not.toHaveBeenCalled();
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });

  it("rejects a payment with a mismatched amount or external reference", async () => {
    const prisma = makePrisma();
    mocks.getAsaasPayment.mockResolvedValue({
      id: "pay-1", status: "RECEIVED", billingType: "PIX", pixQrCodeId: "qr-1",
      externalReference: "another-purchase", value: 2,
    });
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1"))
      .rejects.toThrow("Asaas payment does not match the pending Pix purchase");
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });

  it("does not reconcile records from any other provider", async () => {
    const prisma = makePrisma("LEGACY");
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("not_pending");
    expect(mocks.listAsaasPaymentsByQrCode).not.toHaveBeenCalled();
  });
});
