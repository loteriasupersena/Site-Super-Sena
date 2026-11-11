import { describe, expect, it } from "vitest";
import { normalizeNumber } from "./normalize-number";

describe("normalizeNumber", () => {
  it.each(["000000", "000001", "012345", "999999"])("accepts %s without dropping leading zeroes", value => expect(normalizeNumber(value)).toBe(value));
  it.each(["12345", "1234567", "12A456", " 12 456 "])("rejects invalid value %s", value => expect(() => normalizeNumber(value)).toThrow());
});
