import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  settlementFindFirst: vi.fn(),
  purchaseAggregate: vi.fn(),
  commissionAggregate: vi.fn(),
  userFindUnique: vi.fn(),
  lineCount: vi.fn(),
  payoutAggregate: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSessionUser: mocks.getSessionUser,
  SESSION_COOKIE: "superquina_session",
  authPrisma: {
    cashierSettlement: { findFirst: mocks.settlementFindFirst },
    purchase: { aggregate: mocks.purchaseAggregate },
    cashierCommission: { aggregate: mocks.commissionAggregate },
    user: { findUnique: mocks.userFindUnique },
    numericParticipationLine: { count: mocks.lineCount },
    numericPrizePayout: { aggregate: mocks.payoutAggregate },
  },
}));

import { GET } from "./route";

function request() {
  return new NextRequest("https://example.test/api/cashier/summary", {
    headers: { cookie: "superquina_session=session-token" },
  });
}

describe("GET cashier summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUser.mockResolvedValue({ id: "cashier-1", role: "CASHIER", mustChangePassword: false });
    mocks.settlementFindFirst.mockResolvedValue({ settledAt: new Date("2026-11-01T00:00:00.000Z") });
    mocks.purchaseAggregate
      .mockResolvedValueOnce({ _sum: { totalCents: 10000 } })
      .mockResolvedValueOnce({ _sum: { totalCents: 5000 } });
    mocks.commissionAggregate.mockResolvedValue({ _sum: { amountCents: 900 } });
    mocks.userFindUnique.mockResolvedValue({ commissionRateBasisPoints: 600 });
    mocks.lineCount.mockResolvedValue(7);
    mocks.payoutAggregate.mockResolvedValue({ _sum: { amountCents: 2500 }, _count: { _all: 2 } });
  });

  it("requires an authenticated cashier who has completed password setup", async () => {
    mocks.getSessionUser.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
    mocks.getSessionUser.mockResolvedValue({ id: "player-1", role: "PLAYER", mustChangePassword: false });
    expect((await GET(request())).status).toBe(403);
    mocks.getSessionUser.mockResolvedValue({ id: "cashier-1", role: "CASHIER", mustChangePassword: true });
    expect((await GET(request())).status).toBe(403);
    expect(mocks.settlementFindFirst).not.toHaveBeenCalled();
  });

  it("uses the same eligible sale rules for commission and games as the settlement", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      cashSalesCents: 10000,
      pixSalesCents: 5000,
      totalSalesCents: 15000,
      gamesCount: 7,
      commissionCents: 900,
      commissionRateBasisPoints: 600,
      cashPrizePayoutCents: 2500,
      cashPrizePayoutCount: 2,
    });

    const since = new Date("2026-11-01T00:00:00.000Z");
    const eligible = {
      cashierId: "cashier-1",
      status: "CONFIRMED",
      confirmedAt: { gt: since },
      OR: [
        { paymentMethod: "CASH" },
        { paymentMethod: "PIX", payment: { is: { status: "CONFIRMED" } } },
      ],
    };
    expect(mocks.commissionAggregate).toHaveBeenCalledWith({
      where: { cashierId: "cashier-1", purchase: { is: eligible } },
      _sum: { amountCents: true },
    });
    expect(mocks.lineCount).toHaveBeenCalledWith({
      where: { participation: { is: { status: "CONFIRMED", purchase: { is: eligible } } } },
    });
  });

  it("returns a no-store generic error if a financial query fails", async () => {
    mocks.commissionAggregate.mockRejectedValue(new Error("database detail"));
    const response = await GET(request());
    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    expect(await response.json()).toEqual({ error: "Não foi possível carregar o resumo financeiro." });
  });
});
