import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAsaasPayment: vi.fn(),
  listAsaasPaymentsByQrCode: vi.fn(),
  confirmPixPayment: vi.fn(),
  recordUnexpectedExternalRefund: vi.fn(),
  cancelPendingPixPurchase: vi.fn(),
}));

vi.mock("@/modules/payments/asaas", () => ({
  getAsaasPayment: mocks.getAsaasPayment,
  listAsaasPaymentsByQrCode: mocks.listAsaasPaymentsByQrCode,
}));
vi.mock("@/modules/payments/confirm-payment", () => ({ confirmPixPayment: mocks.confirmPixPayment }));
vi.mock("@/modules/payments/record-unexpected-refund", () => ({ recordUnexpectedExternalRefund: mocks.recordUnexpectedExternalRefund }));
vi.mock("@/modules/payments/cancel-pending-pix-purchase", () => ({ cancelPendingPixPurchase: mocks.cancelPendingPixPurchase }));

import { reconcilePixPaymentFromProvider } from "./reconcile-pix-payment";

function makePrisma() {
  return {
    payment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "payment-1",
        purchaseId: "purchase-1",
        provider: "ASAAS",
        providerPaymentId: null,
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
    mocks.listAsaasPaymentsByQrCode.mockResolvedValue([]);
    mocks.getAsaasPayment.mockResolvedValue({
      id: "pay-1",
      status: "RECEIVED",
      billingType: "PIX",
      value: 2,
      externalReference: "superquina_purchase_purchase-1",
      pixQrCodeId: "qr-1",
    });
    mocks.confirmPixPayment.mockResolvedValue({ outcome: "confirmed" });
  });

  it("keeps the purchase pending while Asaas has no received payment", async () => {
    const prisma = makePrisma();
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("still_pending");
    expect(mocks.getAsaasPayment).not.toHaveBeenCalled();
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });

  it("confirms only a canonical received Pix with matching QR, reference and amount", async () => {
    const prisma = makePrisma();
    mocks.listAsaasPaymentsByQrCode.mockResolvedValue([{ id: "pay-1", status: "RECEIVED" }]);

    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("confirmed");
    expect(mocks.getAsaasPayment).toHaveBeenCalledWith("pay-1");
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

  it("rejects a received payment with a mismatched amount", async () => {
    const prisma = makePrisma();
    mocks.listAsaasPaymentsByQrCode.mockResolvedValue([{ id: "pay-1", status: "RECEIVED" }]);
    mocks.getAsaasPayment.mockResolvedValue({
      id: "pay-1",
      status: "RECEIVED",
      billingType: "PIX",
      value: 1.99,
      externalReference: "superquina_purchase_purchase-1",
      pixQrCodeId: "qr-1",
    });

    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1"))
      .rejects.toThrow("Asaas payment does not match the pending Pix purchase");
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });

  it("does not reprocess an already confirmed purchase", async () => {
    const prisma = makePrisma();
    prisma.payment.findUnique.mockResolvedValue({
      id: "payment-1",
      purchaseId: "purchase-1",
      provider: "ASAAS",
      providerPaymentId: "pay-1",
      providerQrCodeId: "qr-1",
      amountCents: 200,
      status: "CONFIRMED",
      purchase: { totalCents: 200, status: "CONFIRMED" },
    });

    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("already_confirmed");
    expect(mocks.listAsaasPaymentsByQrCode).not.toHaveBeenCalled();
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });
});
