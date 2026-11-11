import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "./allocate-number-stake";

describe("allocateNumberStake", () => {
  it("splits R$1.00 across six categories and assigns the remainder to unit", () => {
    expect(allocateNumberStake(100)).toEqual({ unitCents: 20, tensCents: 16, hundredsCents: 16, quadraCents: 16, quinaCents: 16, senaCents: 16 });
  });
  it("splits R$3.00 equally", () => {
    expect(allocateNumberStake(300)).toEqual({ unitCents: 50, tensCents: 50, hundredsCents: 50, quadraCents: 50, quinaCents: 50, senaCents: 50 });
  });
  it("preserves every cent", () => {
    for (let totalCents = 100; totalCents <= 1_000; totalCents += 1) {
      const allocation = allocateNumberStake(totalCents), base = Math.floor(totalCents / 6);
      expect(Object.values(allocation).reduce((sum, value) => sum + value, 0)).toBe(totalCents);
      expect(allocation.unitCents).toBe(base + totalCents % 6);
      expect([allocation.tensCents, allocation.hundredsCents, allocation.quadraCents, allocation.quinaCents, allocation.senaCents]).toEqual([base, base, base, base, base]);
    }
  });
  it.each([0, 99, 100.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid total %s", value => expect(() => allocateNumberStake(value)).toThrow(/at least 100 cents/i));
});
