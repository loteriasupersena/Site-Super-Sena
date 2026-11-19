import { describe, expect, it } from "vitest";
import { isPlausiblePixKey, maskPixKey, normalizePixKeyForComparison, parsePixKeyInput } from "./pix-key";

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
  
  it("validates Pix keys against their selected type for both withdrawal flows", () => {
    expect(parsePixKeyInput({ pixKey: "529.982.247-25", pixKeyType: "CPF" })).toEqual({ pixKey: "529.982.247-25", pixKeyType: "CPF" });
    expect(parsePixKeyInput({ pixKey: "+55 (77) 99831-5360", pixKeyType: "PHONE" })).not.toBeNull();
    expect(parsePixKeyInput({ pixKey: "jogador@example.com", pixKeyType: "EMAIL" })).not.toBeNull();
    expect(parsePixKeyInput({ pixKey: "123e4567-e89b-42d3-a456-426614174000", pixKeyType: "EVP" })).not.toBeNull();
    expect(parsePixKeyInput({ pixKey: "jogador@example.com", pixKeyType: "CPF" })).toBeNull();
    expect(parsePixKeyInput({ pixKey: "123", pixKeyType: "UNKNOWN" })).toBeNull();
  });

  it("normalizes Brazilian phone country code only for comparison", () => {
    expect(normalizePixKeyForComparison("77998315360", "PHONE")).toBe("77998315360");
    expect(normalizePixKeyForComparison("+5577998315360", "PHONE")).toBe("77998315360");
    expect(normalizePixKeyForComparison("55ABC", "EVP")).toBe("55abc");
  });
});
