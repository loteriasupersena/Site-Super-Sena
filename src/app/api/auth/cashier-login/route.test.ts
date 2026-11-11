import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getLoginBlock: vi.fn(),
  recordLoginFailure: vi.fn(),
  clearLoginFailures: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  authPrisma: { user: { findUnique: vi.fn() } },
  createSession: vi.fn(),
  SESSION_COOKIE: "superquina_session",\n  CASHIER_APP_COOKIE: "super_sena_cashier_app",
}));
vi.mock("@/lib/auth/password", () => ({ verifyPassword: vi.fn() }));
vi.mock("@/lib/auth/login-rate-limit", () => ({
  getLoginBlock: mocks.getLoginBlock,
  recordLoginFailure: mocks.recordLoginFailure,
  clearLoginFailures: mocks.clearLoginFailures,
}));

import { POST } from "./route";
import { authPrisma, createSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";

const userLookup = vi.mocked(authPrisma.user.findUnique);
const sessionCreate = vi.mocked(createSession);
const passwordVerify = vi.mocked(verifyPassword);

function request(body: unknown, origin = "https://example.test") {
  return new NextRequest("https://example.test/api/auth/cashier-login", {
    method: "POST",
    headers: { "content-type": "application/json", origin, host: "example.test" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/cashier-login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLoginBlock.mockResolvedValue(null);
    mocks.recordLoginFailure.mockResolvedValue({ attempts: 1, blockedUntil: null, blocked: false, retryAfterSeconds: 0 });
    mocks.clearLoginFailures.mockResolvedValue(undefined);
    sessionCreate.mockResolvedValue({ token: "opaque-token", expiresAt: new Date("2035-01-01T00:00:00.000Z") });
  });

  it("rejects cross-origin requests", async () => {
    const response = await POST(request({ username: "cashier", password: "secret" }, "https://attacker.test"));
    expect(response.status).toBe(403);
    expect(userLookup).not.toHaveBeenCalled();
  });

  it.each(["PLAYER", "ADMIN"] as const)("rejects %s before creating a session", async (role) => {
    userLookup.mockResolvedValue({ id: "user-1", passwordHash: "encoded", status: "ACTIVE", role } as never);
    passwordVerify.mockResolvedValue(true);
    const response = await POST(request({ username: "account", password: "secret" }));
    expect(response.status).toBe(403);
    expect(sessionCreate).not.toHaveBeenCalled();
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("creates a session for an active CASHIER only", async () => {
    userLookup.mockResolvedValue({ id: "cashier-1", passwordHash: "encoded", status: "ACTIVE", role: "CASHIER" } as never);
    passwordVerify.mockResolvedValue(true);
    const response = await POST(request({ username: "cashier", password: "secret" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, role: "CASHIER" });
    expect(sessionCreate).toHaveBeenCalledWith("cashier-1");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
});
