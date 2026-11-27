import { describe, expect, it } from "vitest";
import { calculatePlatformFeeCents } from "./issue-coupon";

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
