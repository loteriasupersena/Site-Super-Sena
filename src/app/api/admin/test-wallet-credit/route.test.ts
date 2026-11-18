import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(), userFindMany: vi.fn(), userFindUnique: vi.fn(),
  ledgerCreate: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  SESSION_COOKIE: "superquina_session",
  authPrisma: {
    user: { findMany: mocks.userFindMany },
    $transaction: mocks.transaction,
  },
}));
import { GET, POST } from "./route";

function getRequest(query = "") {
  return new NextRequest("https://example.test/api/admin/test-wallet-credit" + query, {
    headers: { cookie: "superquina_session=session-token" },
  });
}
function postRequest(body: unknown, origin = "https://example.test") {
  return new NextRequest("https://example.test/api/admin/test-wallet-credit", {
    method: "POST",
    headers: {
      origin, host: "example.test", "content-type": "application/json",
      cookie: "superquina_session=session-token",
    },
    body: JSON.stringify(body),
  });
}
const payload = {
  userId: "player-1", amountCents: 5000, reason: "Saldo para teste controlado",
  idempotencyKey: "d9428888-122b-4f2a-8c1b-7c8c8a1e2f00",
};
function tx() {
  return {
    user: { findUnique: mocks.userFindUnique },
    ledgerEntry: { create: mocks.ledgerCreate },
    auditEvent: { create: mocks.auditCreate },
  };
}

describe("admin test wallet credit API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({
      id: "admin-1", role: "ADMIN", status: "ACTIVE", mustChangePassword: false,
    });
    mocks.userFindMany.mockResolvedValue([]);
    mocks.userFindUnique.mockResolvedValue({
      id: "player-1", username: "player", role: "PLAYER", status: "ACTIVE",
    });
    mocks.ledgerCreate.mockResolvedValue({
      id: "ledger-1", amountCents: 5000, createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    mocks.auditCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback(tx()));
  });

  it("requires an authenticated administrator for player search and credit", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await GET(getRequest())).status).toBe(401);
    expect((await POST(postRequest(payload))).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "player-1", role: "PLAYER", mustChangePassword: false });
    expect((await GET(getRequest())).status).toBe(403);
    expect((await POST(postRequest(payload))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks administrators who must change their password", async () => {
    mocks.getSessionUser.mockResolvedValue({
      id: "admin-1", role: "ADMIN", mustChangePassword: true,
    });
    expect((await POST(postRequest(payload))).status).toBe(403);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects cross-origin requests and malformed credit values", async () => {
    expect((await POST(postRequest(payload, "https://attacker.test"))).status).toBe(403);
    for (const invalid of [
      { ...payload, amountCents: 0 },
      { ...payload, amountCents: 100_000_001 },
      { ...payload, amountCents: 1.5 },
      { ...payload, reason: "curto" },
      { ...payload, extra: true },
      { ...payload, idempotencyKey: "invalid" },
    ]) {
      expect((await POST(postRequest(invalid))).status).toBe(400);
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("searches only player accounts and applies the server-side query", async () => {
    mocks.userFindMany.mockResolvedValue([{ id: "player-1", username: "player", fullName: null, status: "ACTIVE" }]);
    const response = await GET(getRequest("?q=player"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { role: "PLAYER", OR: [
        { username: { contains: "player", mode: "insensitive" } },
        { fullName: { contains: "player", mode: "insensitive" } },
      ] },
      take: 100,
    }));
    expect(await response.json()).toMatchObject({ items: [{ id: "player-1" }] });
  });

  it("refuses inactive players without creating a ledger entry", async () => {
    mocks.userFindUnique.mockResolvedValue({ ...await mocks.userFindUnique(), status: "BLOCKED" });
    const response = await POST(postRequest(payload));
    expect(response.status).toBe(409);
    expect(mocks.ledgerCreate).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("records a positive ADJUSTMENT and its audit event in one transaction", async () => {
    const response = await POST(postRequest(payload));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true, credit: { player: "player", amountCents: 5000 },
    });
    expect(mocks.ledgerCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      userId: "player-1", type: "ADJUSTMENT", amountCents: 5000, currency: "BRL",
      idempotencyKey: "admin-test-credit:" + payload.idempotencyKey,
    }) });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      actorId: "admin-1", action: "PLAYER_TEST_WALLET_CREDIT",
      entityType: "LedgerEntry", entityId: "ledger-1",
      metadata: expect.objectContaining({
        userId: "player-1", amountCents: 5000, ledgerType: "ADJUSTMENT", testCredit: true,
      }),
    }) });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});
