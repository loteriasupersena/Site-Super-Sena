import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  SESSION_COOKIE: "superquina_session",
  authPrisma: {},
}));

import { GET, PUT } from "./route";

function request(method = "GET", body?: unknown) {
  return new NextRequest("https://example.test/api/admin/prize-rules", {
    method,
    headers: {
      cookie: "superquina_session=session-token",
      ...(method === "PUT" ? { origin: "https://example.test", host: "example.test", "content-type": "application/json" } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe("admin fixed prize rules API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", mustChangePassword: false });
  });

  it("rejects unauthenticated and non-admin users", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await GET(request())!).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "player", role: "PLAYER", mustChangePassword: false });
    expect((await GET(request())!).status).toBe(403);
  });

  it("returns the fixed game price and six prize values", async () => {
    const response = await GET(request())!;
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      gamePriceCents: 600,
      categoryStakeCents: 100,
      prizesCents: { unit: 600, tens: 2000, hundreds: 20000, milhar: 200000, quina: 2000000, sena: 20000000 },
      updatedAt: null,
    });
  });

  it("does not allow prize values to be changed", async () => {
    const response = await PUT(request("PUT", { unit: 6, tens: 20 }))!;
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Os valores dos prêmios são fixos e não podem ser alterados pelo painel.",
    });
  });

  it("rejects cross-origin attempts to change the prize table", async () => {
    const response = await PUT(new NextRequest("https://example.test/api/admin/prize-rules", {
      method: "PUT",
      headers: { host: "example.test", origin: "https://attacker.test", cookie: "superquina_session=session-token" },
    }))!;
    expect(response.status).toBe(403);
  });
});
