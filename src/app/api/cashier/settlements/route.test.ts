import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  settlementCount: vi.fn(),
  settlementFindMany: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  SESSION_COOKIE: "superquina_session",
  authPrisma: {
    cashierSettlement: {
      count: mocks.settlementCount,
      findMany: mocks.settlementFindMany,
    },
  },
}));

import { GET } from "./route";

function request(page = "1") {
  return new NextRequest("https://example.test/api/cashier/settlements?page=" + page, {
    headers: { cookie: "superquina_session=session-token" },
  });
}

describe("GET cashier settlement history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "cashier-1", role: "CASHIER", mustChangePassword: false });
    mocks.settlementCount.mockResolvedValue(1);
    mocks.settlementFindMany.mockResolvedValue([{
      id: "settlement-1",
      settledAt: new Date("2026-11-13T12:00:00.000Z"),
      cashSalesCents: 50000,
      pixSalesCents: 30000,
      totalSalesCents: 80000,
      salesCount: 4,
      gamesCount: 8,
      commissionCents: 8000,
      cashPrizePayoutCount: 2,
      cashPrizePayoutCents: 5000,
      pendingCashSalesCount: 1,
      pendingCashSalesCents: 12000,
    }]);
  });

  it("requires an authenticated cashier", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "player-1", role: "PLAYER", mustChangePassword: false });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.settlementFindMany).not.toHaveBeenCalled();
  });

  it("returns only the cashier's history with the final settlement balance", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      settlements: [{
        id: "settlement-1",
        totalSalesCents: 80000,
        pendingCashSalesCount: 1,
        pendingCashSalesCents: 12000,
        netBalanceCents: 37000,
        cashierOwesPlatformCents: 37000,
        platformOwesCashierCents: 0,
      }],
      pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    expect(mocks.settlementFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { cashierId: "cashier-1" },
      orderBy: [{ settledAt: "desc" }, { id: "desc" }],
    }));
  });

  it("rejects invalid page numbers", async () => {
    expect((await GET(request("0"))).status).toBe(400);
    expect(mocks.settlementFindMany).not.toHaveBeenCalled();
  });
});
