import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function encryptionKey() {
  const raw = process.env.STORE_PIX_KEY_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error("STORE_PIX_KEY_ENCRYPTION_KEY_MISSING");
  const key = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("STORE_PIX_KEY_ENCRYPTION_KEY_INVALID");
  return key;
}

/** Authenticated encryption for stored Pix keys. Never log plaintext or ciphertext. */
export function encryptStorePixKey(value: string) {
  const plaintext = value.trim();
  if (!plaintext) throw new Error("STORE_PIX_KEY_EMPTY");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptStorePixKey(payload: string) {
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("STORE_PIX_KEY_CIPHERTEXT_INVALID");
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
    throw new Error("STORE_PIX_KEY_CIPHERTEXT_INVALID");
  }
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
