import { describe, expect, it } from "vitest";
import { encodeThermalReceipt, type EscPosProfile, type ThermalReceiptForEncoding } from "./encode-thermal-receipt";

const receipt: ThermalReceiptForEncoding = {
  receiptCode: "SQ-1234567890ABCDEF",
  paymentStatus: "CONFIRMED",
  issuedAt: "2026-11-05T12:30:00.000Z",
  paymentMethod: "PIX",
  totalCents: 1234,
  currency: "BRL",
  customerLabel: "João da Silva",
  cashierLabel: null,
  entries: [{
    numberValue: "001234",
    roundCode: "R-01",
    resultAt: "2026-11-05T13:00:00.000Z",
    stakeCents: 1234,
    unitCents: 209, tensCents: 205, hundredsCents: 205, quadraCents: 205, quinaCents: 205, senaCents: 205,
  }],
};

const profile: EscPosProfile = { paperWidthMm: 58, columns: 32 };

describe("encodeThermalReceipt", () => {
  it("encodes a confirmed receipt as ESC/POS bytes and preserves leading zeroes", () => {
    const bytes = encodeThermalReceipt(receipt, profile);
    const text = String.fromCharCode(...bytes);
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
    expect(text).toContain("00123");
    expect(text).toContain("R$ 12,34");
    expect(text).toContain("Unidade:");
    expect(text).toContain("Quadra:");
    expect(text).toContain("Quina:");
    expect(text).toContain("Sena:");
    expect(text).toContain("SQ-1234567890ABCDEF");
    expect(text).toContain("Joao da Silva");
    expect(Array.from(bytes.slice(-3))).toEqual([0x0a, 0x0a, 0x0a]);
  });

  it("selects the configured ESC/POS font mode", () => {
    const bytes = encodeThermalReceipt(receipt, { ...profile, fontMode: "B" });
    expect(Array.from(bytes.slice(2, 5))).toEqual([0x1b, 0x4d, 0x01]);
  });

  it("uses an explicitly configured character map and code page", () => {
    const bytes = encodeThermalReceipt(receipt, {
      ...profile,
      codePageCommand: 3,
      characterMap: { "ã": 0xe3, "õ": 0xf5 },
    });
    expect(Array.from(bytes)).toContain(0x03);
    expect(Array.from(bytes)).toContain(0xe3);
  });

  it("does not send a cutter command unless the profile opts in", () => {
    const bytes = encodeThermalReceipt(receipt, profile);
    const fullCut = [0x1d, 0x56, 0x00];
    expect(Array.from(bytes).some((_, index) =>
      fullCut.every((value, offset) => bytes[index + offset] === value),
    )).toBe(false);
  });

  it("sends the configured partial-cut command only when requested", () => {
    const bytes = encodeThermalReceipt(receipt, { ...profile, cutMode: "partial" });
    expect(Array.from(bytes.slice(-5))).toEqual([0x0a, 0x0a, 0x1d, 0x56, 0x01]);
    expect(bytes[bytes.length - 1]).toBe(0x01);
  });

  it("rejects non-BRL, invalid and unconfirmed receipts", () => {
    expect(() => encodeThermalReceipt({ ...receipt, currency: "USD" }, profile)).toThrow("Unsupported currency");
    expect(() => encodeThermalReceipt({ ...receipt, totalCents: -1 }, profile)).toThrow("Invalid total");
    expect(() => encodeThermalReceipt({ ...receipt, paymentStatus: "PENDING_PAYMENT" } as unknown as ThermalReceiptForEncoding, profile))
      .toThrow("Only confirmed receipts can be encoded");
  });

  it("rejects oversized entry lists and invalid profile widths", () => {
    expect(() => encodeThermalReceipt({
      ...receipt,
      entries: Array.from({ length: 101 }, (_, index) => ({ ...receipt.entries[0]!, numberValue: String(index) })),
    }, profile)).toThrow("Invalid receipt entries");
    expect(() => encodeThermalReceipt(receipt, { ...profile, columns: 200 })).toThrow("Invalid columns");
  });
});
