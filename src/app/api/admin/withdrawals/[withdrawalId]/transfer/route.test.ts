import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(), transaction: vi.fn(), queryRaw: vi.fn(), findUnique: vi.fn(),
  updateMany: vi.fn(), historyCreate: vi.fn(), auditCreate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { $transaction: mocks.transaction },
  getSessionUser: mocks.getSessionUser, SESSION_COOKIE: "superquina_session",
}));
import { POST } from "./route";

function request(body: unknown = {}) {
  return new NextRequest("https://example.test/api/admin/withdrawals/withdrawal-1/transfer", {
    method: "POST",
    headers: { origin: "https://example.test", host: "example.test", cookie: "superquina_session=session-token", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function tx() {
  return {
    $queryRaw: mocks.queryRaw,
    withdrawal: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
    withdrawalStatusHistory: { create: mocks.historyCreate },
    auditEvent: { create: mocks.auditCreate },
  };
}

describe("administrator manual Pix withdrawal confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", mustChangePassword: false });
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
    mocks.queryRaw.mockResolvedValue([{ id: "withdrawal-1" }]);
    mocks.findUnique.mockResolvedValue({ id: "withdrawal-1", userId: "player-1", amountCents: 2500, status: "PENDING", providerRef: null });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
  });

  it("marks a withdrawal paid only after an authenticated admin confirms the external Pix", async () => {
    const response = await POST(request({ reference: "E2E-PIX-123" }), { params: Promise.resolve({ withdrawalId: "withdrawal-1" }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, withdrawal: { id: "withdrawal-1", status: "PAID", amountCents: 2500 } });
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: { id: "withdrawal-1", status: "PENDING" },
      data: { status: "PAID", reviewedById: "admin-1", providerRef: "E2E-PIX-123" },
    });
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      fromStatus: "PENDING", toStatus: "PAID", actorId: "admin-1",
    }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: "admin-1", action: "WITHDRAWAL_MANUAL_PIX_CONFIRMED",
    }) });
  });

  it("does not confirm a withdrawal that is already closed", async () => {
    mocks.findUnique.mockResolvedValue({ id: "withdrawal-1", userId: "player-1", amountCents: 2500, status: "PAID", providerRef: null });
    const response = await POST(request(), { params: Promise.resolve({ withdrawalId: "withdrawal-1" }) });
    expect(response.status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it("requires an administrator", async () => {
    mocks.getSessionUser.mockResolvedValue({ id: "player-1", role: "PLAYER", mustChangePassword: false });
    const response = await POST(request(), { params: Promise.resolve({ withdrawalId: "withdrawal-1" }) });
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
