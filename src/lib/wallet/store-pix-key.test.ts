import { beforeEach, describe, expect, it, vi } from "vitest";
import { decryptStorePixKey, encryptStorePixKey } from "./store-pix-key";

describe("store Pix key encryption", () => {
  beforeEach(() => {
    vi.stubEnv("STORE_PIX_KEY_ENCRYPTION_KEY", "11".repeat(32));
  });

  it("round-trips without storing the plaintext", () => {
    const secret = "joao@example.com";
    const ciphertext = encryptStorePixKey(secret);
    expect(ciphertext).not.toContain(secret);
    expect(decryptStorePixKey(ciphertext)).toBe(secret);
  });

  it("uses a fresh nonce for every encryption", () => {
    const a = encryptStorePixKey("key");
    const b = encryptStorePixKey("key");
    expect(a).not.toBe(b);
    expect(decryptStorePixKey(a)).toBe("key");
    expect(decryptStorePixKey(b)).toBe("key");
  });

  it("rejects tampered ciphertext", () => {
    const ciphertext = encryptStorePixKey("secret");
    const parts = ciphertext.split(".");
    parts[2] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptStorePixKey(parts.join("."))).toThrow();
  });
});
