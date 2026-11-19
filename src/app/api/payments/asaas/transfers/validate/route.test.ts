import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), batchFind: vi.fn(), batchUpdate: vi.fn(),
  requestFind: vi.fn(), requestUpdate: vi.fn(), withdrawalFind: vi.fn(),
  withdrawalUpdate: vi.fn(), auditCreate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { $transaction: mocks.transaction, auditEvent: { create: mocks.auditCreate } },
}));
vi.mock("@/modules/payments/asaas", () => ({
  getAsaasTransfer: vi.fn().mockResolvedValue({
    id: "trf_12345678", externalReference: "prize_batch_ppb_12345678",
    value: 1, operationType: "PIX",
  }),
}));
import { POST } from "./route";

function makeRequest(overrides: Record<string, unknown> = {}, token = "v".repeat(40)) {
  return new NextRequest("https://loteriasupersena.com.br/api/payments/asaas/transfers/validate", {
    method: "POST",
    headers: { "asaas-access-token": token, "content-type": "application/json" },
    body: JSON.stringify({
      type: "TRANSFER",
      transfer: {
        id: "trf_12345678", externalReference: "prize_batch_ppb_12345678",
        value: 1, operationType: "PIX", bankAccount: { pixAddressKey: "11999999999" },
        ...overrides,
      },
    }),
  });
}
function tx() {
  return {
    prizePaymentBatch: { findFirst: mocks.batchFind, updateMany: mocks.batchUpdate },
    prizePaymentRequest: { findFirst: mocks.requestFind, updateMany: mocks.requestUpdate },
    withdrawal: { findFirst: mocks.withdrawalFind, updateMany: mocks.withdrawalUpdate },
    auditEvent: { create: mocks.auditCreate },
  };
}
describe("Asaas withdrawal validation endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ASAAS_WITHDRAWAL_VALIDATION_TOKEN = "v".repeat(40);
    delete process.env.ASAAS_WEBHOOK_TOKEN;
    delete process.env.ASAAS_WITHDRAWAL_VALIDATION_TEST_MODE;
    mocks.batchFind.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING", paymentReference: "prize_batch_ppb_12345678",
      asaasTransferId: null, netCents: 100, pixKey: "11999999999", pixKeyType: "PHONE",
    });
    mocks.batchUpdate.mockResolvedValue({ count: 1 });
    mocks.requestFind.mockResolvedValue(null);
    mocks.requestUpdate.mockResolvedValue({ count: 1 });
    mocks.withdrawalFind.mockResolvedValue(null);
    mocks.withdrawalUpdate.mockResolvedValue({ count: 1 });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("approves a registered batch with matching transfer ID reference, amount and Pix key", async () => {
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "ppb_12345678", status: "PROCESSING" }),
      data: expect.objectContaining({ asaasTransferId: "trf_12345678" }),
    }));
  });

  it("recovers externalReference from Asaas when callback arrives before transfer ID is linked", async () => {
    mocks.batchFind.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING", paymentReference: "prize_batch_ppb_12345678",
      asaasTransferId: null, netCents: 100, pixKey: "11999999999", pixKeyType: "PHONE",
    });

    const response = await POST(makeRequest({ externalReference: undefined }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.batchFind).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ OR: expect.arrayContaining([
        { paymentReference: "prize_batch_ppb_12345678" },
        { asaasTransferId: "trf_12345678" },
      ]) }),
    }));
  });

  it("approves a registered transfer by ID when Asaas omits externalReference", async () => {
    mocks.batchFind.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING", paymentReference: "prize_batch_ppb_12345678",
      asaasTransferId: "trf_12345678", netCents: 100, pixKey: "11999999999", pixKeyType: "PHONE",
    });

    const response = await POST(makeRequest({ externalReference: undefined }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.batchFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [
        { paymentReference: "prize_batch_ppb_12345678" },
        { asaasTransferId: "trf_12345678" },
      ] },
      select: expect.any(Object),
    }));
  });

  it("approves a registered transfer when Asaas sends pixAddressKey as null", async () => {
    mocks.batchFind.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING", paymentReference: "prize_batch_ppb_12345678",
      asaasTransferId: "trf_12345678", netCents: 100, pixKey: "11999999999", pixKeyType: "PHONE",
    });

    const response = await POST(makeRequest({
      externalReference: undefined,
      bankAccount: { pixAddressKey: null },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ asaasTransferId: "trf_12345678" }),
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          beneficiaryKeyComparedFromPayload: false,
          beneficiaryValidatedAgainstStoredRequest: true,
        }),
      }),
    }));
  });

  it("refuses an unknown transfer", async () => {
    mocks.batchFind.mockResolvedValue(null);
    const response = await POST(makeRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
  });

  it("refuses a mismatched amount", async () => {
    mocks.batchFind.mockResolvedValueOnce({ ...await mocks.batchFind(), netCents: 200 });
    const response = await POST(makeRequest());
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
  });

  it("approves a Brazilian phone Pix key when Asaas returns the +55 country prefix", async () => {
    mocks.batchFind.mockResolvedValue({
      id: "ppb_12345678", status: "PROCESSING", paymentReference: "prize_batch_ppb_12345678",
      asaasTransferId: null, netCents: 100, pixKey: "77998315360", pixKeyType: "PHONE",
    });
    const response = await POST(makeRequest({
      bankAccount: { pixAddressKey: "+5577998315360" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
  });

  it("refuses a mismatched Pix beneficiary", async () => {
    const response = await POST(makeRequest({ bankAccount: { pixAddressKey: "11988887777" } }));
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
  });

  it("relaxes only wallet withdrawal beneficiary/admin checks in explicit homologation mode", async () => {
    process.env.ASAAS_WITHDRAWAL_VALIDATION_TEST_MODE = "true";
    mocks.batchFind.mockResolvedValue(null);
    mocks.withdrawalFind.mockResolvedValue({
      id: "wdr_12345678", status: "PROCESSING",
      paymentReference: "prize_batch_ppb_12345678", asaasTransferId: null,
      amountCents: 100, pixKey: null, pixKeyType: null, reviewedById: null,
    });

    const response = await POST(makeRequest({ bankAccount: { pixAddressKey: "+5577998315360" } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "APPROVED" });
    expect(mocks.withdrawalUpdate).toHaveBeenCalled();
    expect(mocks.auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        metadata: expect.objectContaining({ homologationTestMode: true }),
      }),
    }));
  });

  it("still refuses an unknown transfer and mismatched amount in homologation mode", async () => {
    process.env.ASAAS_WITHDRAWAL_VALIDATION_TEST_MODE = "true";
    mocks.batchFind.mockResolvedValue(null);
    mocks.withdrawalFind.mockResolvedValue(null);
    const unknown = await POST(makeRequest());
    expect(await unknown.json()).toMatchObject({ status: "REFUSED" });

    mocks.withdrawalFind.mockResolvedValue({
      id: "wdr_12345678", status: "PROCESSING",
      paymentReference: "prize_batch_ppb_12345678", asaasTransferId: null,
      amountCents: 200, pixKey: null, pixKeyType: null, reviewedById: null,
    });
    const wrongAmount = await POST(makeRequest());
    expect(await wrongAmount.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.withdrawalUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid authentication token", async () => {
    const response = await POST(makeRequest({}, "invalid"));
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("refuses non-transfer operations", async () => {
    const request = new NextRequest("https://loteriasupersena.com.br/api/payments/asaas/transfers/validate", {
      method: "POST", headers: { "asaas-access-token": "v".repeat(40), "content-type": "application/json" },
      body: JSON.stringify({ type: "BILL", transfer: {} }),
    });
    const response = await POST(request);
    expect(await response.json()).toMatchObject({ status: "REFUSED" });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
