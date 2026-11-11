import { describe, expect, it } from "vitest";
import { drawNumber } from "./draw-number";

describe("drawNumber", () => {
  it("preserves leading zeroes", () => expect(drawNumber(() => 7)).toBe("000007"));
  it("supports the upper boundary", () => expect(drawNumber(() => 999_999)).toBe("999999"));
  it("uses exactly the one-million-value range", () => {
    let requestedRange = 0;
    drawNumber(maxExclusive => { requestedRange = maxExclusive; return 0; });
    expect(requestedRange).toBe(1_000_000);
  });
});
