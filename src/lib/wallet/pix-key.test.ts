import { describe, expect, it } from "vitest";
import { isPlausiblePixKey, maskPixKey } from "./pix-key";

describe("Pix key helpers", () => {
  it("accepts supported Pix key formats and rejects malformed values", () => {
    expect(isPlausiblePixKey("jogador@example.com")).toBe(true);
    expect(isPlausiblePixKey("+55 (11) 99999-9999")).toBe(true);
    expect(isPlausiblePixKey("123.456.789-01")).toBe(true);
    expect(isPlausiblePixKey("12345678000195")).toBe(true);
    expect(isPlausiblePixKey("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isPlausiblePixKey("not a pix key")).toBe(false);
  });

  it("masks email and numeric Pix keys without any encryption configuration", () => {
    expect(maskPixKey("jogador@example.com")).toBe("jo***@example.com");
    expect(maskPixKey("123456789012")).toBe("••••••9012");
  });
});
