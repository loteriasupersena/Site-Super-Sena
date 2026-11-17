import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(),
  withdrawalFindUnique: vi.fn(), withdrawalUpdateMany: vi.fn(),
  historyCreate: vi.fn(), auditCreate: vi.fn(), decryptPixKey: vi.fn(),
  createAsaasPixTransfer: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { $transaction: mocks.transaction, withdrawal: { updateMany: mocks.withdrawalUpdateMany }, withdrawalStatusHistory: { create: mocks.historyCreate } },
  getSessionUser: mocks.getSessionUser, SESSION_COOKIE: "superquina_session",
}));
vi.mock("@/lib/wallet/pix-key-crypto", () => ({ decryptPixKey: mocks.decryptPixKey }));
vi.mock("@/modules/payments/asaas", () => ({ createAsaasPixTransfer: mocks.createAsaasPixTransfer }));
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
      pixKeyEncrypted: "encrypted", pixKeyType: "CPF", asaasTransferId: null,
      paymentReference: null, userId: "player-1",
    });
    mocks.withdrawalUpdateMany.mockResolvedValue({ count: 1 });
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.decryptPixKey.mockReturnValue("52998224725");
    mocks.createAsaasPixTransfer.mockResolvedValue({ id: "trf-1", status: "PENDING" });
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
