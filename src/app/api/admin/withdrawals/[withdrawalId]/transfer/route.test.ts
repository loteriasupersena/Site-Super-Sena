import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(),
  withdrawalFindUnique: vi.fn(), withdrawalUpdateMany: vi.fn(),
  historyCreate: vi.fn(), auditCreate: vi.fn(),
  createAsaasPixTransfer: vi.fn(), findTransfers: vi.fn(), reconcileTransfer: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { $transaction: mocks.transaction, withdrawal: { updateMany: mocks.withdrawalUpdateMany }, withdrawalStatusHistory: { create: mocks.historyCreate } },
  getSessionUser: mocks.getSessionUser, SESSION_COOKIE: "superquina_session",
}));
vi.mock("@/modules/payments/asaas", () => ({ createAsaasPixTransfer: mocks.createAsaasPixTransfer, findAsaasTransfersByExternalReference: mocks.findTransfers }));
vi.mock("@/modules/payments/reconcile-asaas-transfer", () => ({ reconcileAsaasTransferFromPlatform: mocks.reconcileTransfer }));
import { POST } from "./route";

function tx() {
  return {
    $queryRaw: mocks.queryRaw,
    withdrawal: { findUnique: mocks.withdrawalFindUnique, updateMany: mocks.withdrawalUpdateMany },
    withdrawalStatusHistory: { create: mocks.historyCreate },
    auditEvent: { create: mocks.auditCreate },
  };
}
function request() {
  return new NextRequest("https://example.test/api/admin/withdrawals/wdr_12345678/transfer", {
    method: "POST", headers: { origin: "https://example.test", host: "example.test", cookie: "superquina_session=session-token" }, body: "{}",
  });
}
const context = { params: Promise.resolve({ withdrawalId: "wdr_12345678" }) };

describe("admin Asaas wallet transfer authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", mustChangePassword: false });
    mocks.queryRaw.mockResolvedValue([]);
    mocks.withdrawalFindUnique.mockResolvedValue({
      id: "wdr_12345678", status: "PENDING", amountCents: 100000,
      pixKey: "52998224725", pixKeyType: "CPF", asaasTransferId: null,
      paymentReference: null, userId: "player-1",
    });
    mocks.withdrawalUpdateMany.mockResolvedValue({ count: 1 });
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.createAsaasPixTransfer.mockResolvedValue({ id: "trf-1", status: "PENDING" });
    mocks.findTransfers.mockResolvedValue([]);
    mocks.reconcileTransfer.mockResolvedValue("WITHDRAWAL_PROCESSING");
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("requires an administrator", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "player-1", role: "PLAYER", mustChangePassword: false });
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("sends an eligible R$ 1,000 withdrawal through Asaas exactly once", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(202);
    expect(mocks.createAsaasPixTransfer).toHaveBeenCalledWith({
      amountCents: 100000, pixKey: "52998224725", pixKeyType: "CPF",
      externalReference: "wallet_withdrawal_wdr_12345678",
    });
    expect(mocks.withdrawalUpdateMany).toHaveBeenCalledTimes(2);
    expect(mocks.historyCreate).toHaveBeenCalledOnce();
    expect(mocks.auditCreate).toHaveBeenCalledOnce();
  });

  it("keeps the reserved withdrawal processing after an ambiguous Asaas rejection", async () => {
    mocks.createAsaasPixTransfer.mockRejectedValueOnce(Object.assign(new Error("rejected"), { status: 400 }));
    mocks.findTransfers.mockResolvedValueOnce([]);
    const response = await POST(request(), context);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ success: true, status: "PROCESSING" });
    expect(mocks.findTransfers).toHaveBeenCalledWith(expect.objectContaining({
      externalReference: "wallet_withdrawal_wdr_12345678",
      requestedAt: expect.any(Date),
    }));
    expect(mocks.withdrawalUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("recovers one matching transfer after a failed Asaas creation response", async () => {
    mocks.createAsaasPixTransfer.mockRejectedValueOnce(Object.assign(new Error("timeout"), { status: 503 }));
    mocks.findTransfers.mockResolvedValueOnce([{ id: "trf-recovered", status: "PENDING" }]);
    mocks.reconcileTransfer.mockResolvedValueOnce("WITHDRAWAL_PROCESSING");
    const response = await POST(request(), context);
    expect(response.status).toBe(202);
    expect(mocks.reconcileTransfer).toHaveBeenCalledWith({
      transferId: "trf-recovered",
      externalReference: "wallet_withdrawal_wdr_12345678",
    });
    expect(mocks.withdrawalUpdateMany.mock.calls.some(([args]) =>
      args.where.id === "wdr_12345678" &&
      args.where.status === "PROCESSING" &&
      args.where.paymentReference === "wallet_withdrawal_wdr_12345678" &&
      args.where.asaasTransferId === null &&
      args.data.asaasTransferId === "trf-recovered"
    )).toBe(true);
  });

  it("does not reconcile a recovered transfer when its database link was not acquired", async () => {
    mocks.createAsaasPixTransfer.mockRejectedValueOnce(Object.assign(new Error("timeout"), { status: 503 }));
    mocks.findTransfers.mockResolvedValueOnce([{ id: "trf-recovered", status: "PENDING" }]);
    mocks.withdrawalUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const response = await POST(request(), context);
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ success: true, status: "PROCESSING" });
    expect(mocks.reconcileTransfer).not.toHaveBeenCalled();
  });

  it("does not send withdrawals below the R$ 1,000 threshold", async () => {
    mocks.withdrawalFindUnique.mockResolvedValue({ ...await mocks.withdrawalFindUnique(), amountCents: 99999 });
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(mocks.createAsaasPixTransfer).not.toHaveBeenCalled();
  });

  it("does not create a second transfer when an Asaas transfer ID already exists", async () => {
    mocks.withdrawalFindUnique.mockResolvedValue({ ...await mocks.withdrawalFindUnique(), asaasTransferId: "trf-existing" });
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(mocks.createAsaasPixTransfer).not.toHaveBeenCalled();
  });
});
