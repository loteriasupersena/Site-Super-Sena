import { describe, expect, it } from "vitest";
import { allocateNumberStake } from "./allocate-number-stake";

describe("allocateNumberStake", () => {
  it("splits R$1.00 equally across five categories", () => {
    expect(allocateNumberStake(100)).toEqual({ tensCents: 20, hundredsCents: 20, milharCents: 20, quinaCents: 20, senaCents: 20 });
  });
  it("assigns every remainder cent only to Dezena", () => {
    expect(allocateNumberStake(101)).toEqual({ tensCents: 21, hundredsCents: 20, milharCents: 20, quinaCents: 20, senaCents: 20 });
    expect(allocateNumberStake(103)).toEqual({ tensCents: 23, hundredsCents: 20, milharCents: 20, quinaCents: 20, senaCents: 20 });
  });
  it("splits R$3.00 equally", () => {
    expect(allocateNumberStake(300)).toEqual({ tensCents: 60, hundredsCents: 60, milharCents: 60, quinaCents: 60, senaCents: 60 });
  });
  it("preserves every cent and sends the remainder to Dezena", () => {
    for (let totalCents = 100; totalCents <= 1_000; totalCents += 1) {
      const allocation = allocateNumberStake(totalCents), base = Math.floor(totalCents / 5);
      expect(Object.values(allocation).reduce((sum, value) => sum + value, 0)).toBe(totalCents);
      expect(allocation.tensCents).toBe(base + totalCents % 5);
      expect([allocation.hundredsCents, allocation.milharCents, allocation.quinaCents, allocation.senaCents]).toEqual([base, base, base, base]);
    }
  });
  it.each([0, 99, 100.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid total %s", value => expect(() => allocateNumberStake(value)).toThrow(/at least 100 cents/i));
});
