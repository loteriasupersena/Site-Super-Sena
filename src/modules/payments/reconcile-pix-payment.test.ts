import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getVerifiedPixOrder: vi.fn(),
  classifyPixOrderStatus: vi.fn(),
  confirmPixPayment: vi.fn(),
}));
vi.mock("@/modules/payments/mercado-pago", () => ({
  getVerifiedPixOrder: mocks.getVerifiedPixOrder,
  classifyPixOrderStatus: mocks.classifyPixOrderStatus,
}));
vi.mock("@/modules/payments/confirm-payment", () => ({ confirmPixPayment: mocks.confirmPixPayment }));

import { reconcilePixPaymentFromProvider } from "./reconcile-pix-payment";

function makePrisma(provider = "MERCADO_PAGO") {
  return {
    payment: {
      findUnique: vi.fn().mockResolvedValue({
        id: "payment-1", purchaseId: "purchase-1", provider,
        providerPaymentId: "order-1", amountCents: 200, status: "PENDING",
        purchase: { totalCents: 200, status: "PENDING_PAYMENT" },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("reconcilePixPaymentFromProvider (Mercado Pago)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getVerifiedPixOrder.mockResolvedValue({
      orderId: "order-1", status: "processed", statusDetail: "accredited",
      externalReference: "superquina_purchase_purchase-1", currency: "BRL",
      amountCents: 200, paymentStatus: "processed", paymentAmountCents: 200,
      paymentMethodId: "pix", paymentMethodType: "bank_transfer",
    });
    mocks.classifyPixOrderStatus.mockReturnValue({
      providerStatus: "processed", normalizedStatus: "processed", approved: true,
    });
    mocks.confirmPixPayment.mockResolvedValue({ outcome: "confirmed" });
  });

  it("confirms only a canonical Mercado Pago Pix order matching reference and amount", async () => {
    const prisma = makePrisma();
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("confirmed");
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: { providerStatus: "processed", providerStatusDetail: "accredited" },
    });
    expect(mocks.confirmPixPayment).toHaveBeenCalledWith(prisma, {
      paymentId: "payment-1", providerStatus: "processed", providerStatusDetail: "accredited",
    });
  });

  it("leaves the purchase pending when Mercado Pago has not accredited the Pix", async () => {
    const prisma = makePrisma();
    mocks.classifyPixOrderStatus.mockReturnValue({
      providerStatus: "created", normalizedStatus: "created", approved: false,
    });
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("still_pending");
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });

  it("rejects an order with a mismatched amount or external reference", async () => {
    const prisma = makePrisma();
    mocks.getVerifiedPixOrder.mockResolvedValue({
      orderId: "order-1", status: "processed", statusDetail: "accredited",
      externalReference: "another-purchase", currency: "BRL", amountCents: 200,
      paymentStatus: "processed", paymentAmountCents: 200,
      paymentMethodId: "pix", paymentMethodType: "bank_transfer",
    });
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1"))
      .rejects.toThrow("Mercado Pago order does not match the pending Pix purchase");
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(mocks.confirmPixPayment).not.toHaveBeenCalled();
  });

  it("does not reconcile records from any other provider", async () => {
    const prisma = makePrisma("LEGACY");
    await expect(reconcilePixPaymentFromProvider(prisma as never, "payment-1")).resolves.toBe("not_pending");
    expect(mocks.getVerifiedPixOrder).not.toHaveBeenCalled();
  });
});
