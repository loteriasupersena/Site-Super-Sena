import { describe, expect, it } from "vitest";
import { calculatePlatformFeeCents, chooseDistinct } from "./issue-coupon";

describe("calculatePlatformFeeCents", () => {
  it("calculates the configured percentage in cents", () => {
    expect(calculatePlatformFeeCents(10000, 500)).toBe(500);
    expect(calculatePlatformFeeCents(12345, 250)).toBe(309);
  });

  it("rounds half up to the nearest cent", () => {
    expect(calculatePlatformFeeCents(1, 5000)).toBe(1);
    expect(calculatePlatformFeeCents(1, 4999)).toBe(0);
  });

  it("supports percentages above 100 percent when the configured fee fits the database integer", () => {
    expect(calculatePlatformFeeCents(10000, 15000)).toBe(15000);
  });

  it("rejects a fee that exceeds the database integer range", () => {
    expect(() => calculatePlatformFeeCents(2_147_483_647, 2_147_483_647))
      .toThrow("COUPON_PLATFORM_FEE_OUT_OF_RANGE");
  });
});


describe("chooseDistinct coupon winners", () => {
  it("selects the requested number of distinct coupons without replacement", () => {
    const members = Array.from({ length: 100 }, (_, index) => ({ id: String(index) }));
    const winners = chooseDistinct(members, 3);
    expect(winners).toHaveLength(3);
    expect(new Set(winners.map((winner) => winner.id)).size).toBe(3);
    expect(winners.every((winner) => members.some((member) => member.id === winner.id))).toBe(true);
  });

  it("rejects winner counts outside the batch size", () => {
    expect(() => chooseDistinct([{ id: "only" }], 2)).toThrow("COUPON_DRAW_WINNER_COUNT_INVALID");
    expect(() => chooseDistinct([{ id: "only" }], 0)).toThrow("COUPON_DRAW_WINNER_COUNT_INVALID");
  });
});
