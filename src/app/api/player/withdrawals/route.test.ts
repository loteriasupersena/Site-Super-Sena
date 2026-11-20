import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(), aggregate: vi.fn(), findMany: vi.fn(), transaction: vi.fn(),
  queryRaw: vi.fn(), withdrawalCreate: vi.fn(), ledgerCreate: vi.fn(), historyCreate: vi.fn(), auditCreate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { ledgerEntry: { aggregate: mocks.aggregate }, withdrawal: { findMany: mocks.findMany }, $transaction: mocks.transaction },
  getSessionUser: mocks.getSessionUser, SESSION_COOKIE: "superquina_session",
}));
vi.mock("@/lib/wallet/pix-key", () => ({
  maskPixKey: vi.fn(() => "••••4000"),
  parsePixKeyInput: vi.fn((value: { pixKey: string; pixKeyType: string }) => value),
}));
import { GET, POST } from "./route";

function request(body?: unknown, origin = "https://example.test") {
  return new NextRequest("https://example.test/api/player/withdrawals", {
    ...(body === undefined ? {} : { method: "POST", headers: { origin, host: "example.test", "content-type": "application/json", cookie: "superquina_session=session-token" }, body: JSON.stringify(body) }),
    ...(body === undefined ? { headers: { cookie: "superquina_session=session-token" } } : {}),
  });
}
function tx() {
  return {
    $queryRawUnsafe: mocks.queryRaw,
    ledgerEntry: { aggregate: mocks.aggregate, create: mocks.ledgerCreate },
    withdrawal: { create: mocks.withdrawalCreate },
    withdrawalStatusHistory: { create: mocks.historyCreate },
    auditEvent: { create: mocks.auditCreate },
  };
}

describe("player withdrawals API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "player-1", username: "player", role: "PLAYER", status: "ACTIVE", mustChangePassword: false });
    mocks.aggregate.mockResolvedValue({ _sum: { amountCents: 5000 } });
    mocks.findMany.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.withdrawalCreate.mockResolvedValue({ id: "withdrawal-1", amountCents: 5000, status: "PENDING", createdAt: new Date("2026-01-01T00:00:00Z") });
    mocks.ledgerCreate.mockResolvedValue({});
    mocks.historyCreate.mockResolvedValue({});
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("requires the player's own authenticated role", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", mustChangePassword: false });
    expect((await GET(request())).status).toBe(403);
  });

  it("reserves the full available balance and leaves the Pix for administrator payment", async () => {
    const response = await POST(request({ pixKey: "52998224725", pixKeyType: "CPF" }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      success: true, withdrawal: { id: "withdrawal-1", amountCents: 5000, availableCents: 0, status: "PENDING" },
    });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.queryRaw).toHaveBeenCalledOnce();
    expect(mocks.withdrawalCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "player-1", pixKey: "52998224725", pixKeyType: "CPF", status: "PENDING", paymentReference: null,
    }) });
    expect(mocks.withdrawalCreate.mock.calls[0][0].data).not.toHaveProperty("holderName");
    expect(mocks.withdrawalCreate.mock.calls[0][0].data).not.toHaveProperty("holderCpfMasked");
    expect(mocks.withdrawalCreate.mock.calls[0][0].data).not.toHaveProperty("pixKeyEncrypted");
    expect(mocks.ledgerCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "player-1", withdrawalId: "withdrawal-1", type: "WITHDRAWAL_RESERVE",
      amountCents: -5000, idempotencyKey: "withdrawal-reserve:withdrawal-1",
    }) });
    expect(mocks.historyCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      toStatus: "PENDING", actorId: "player-1",
    }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: "player-1", action: "WITHDRAWAL_REQUESTED", entityType: "Withdrawal",
    }) });
  });

  it("rejects a withdrawal when no balance is available", async () => {
    mocks.aggregate.mockResolvedValue({ _sum: { amountCents: 0 } });
    const response = await POST(request({ pixKey: "52998224725", pixKeyType: "CPF" }));
    expect(response.status).toBe(409);
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
    expect(mocks.withdrawalCreate).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(request({ pixKey: "52998224725", pixKeyType: "CPF" }, "https://attacker.test"));
    expect(response.status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
