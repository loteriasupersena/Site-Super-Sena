export function maskPixKey(value: string) {
  if (value.includes("@")) {
    const [local, domain] = value.split("@");
    return (local.length <= 2 ? local[0] ?? "*" : local.slice(0, 2) + "***") + "@" + domain;
  }
  return value.length <= 4 ? "••••" : "••••••" + value.slice(-4);
}

/** Basic format validation for the four common Pix key families. */
export function isPlausiblePixKey(value: string) {
  const key = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key)) return true;
  const digits = key.replace(/\D/g, "");
  if (/^\+?[0-9() .-]+$/.test(key) && digits.length >= 10 && digits.length <= 13) return true;
  if (/^[0-9.\/-]+$/.test(key) && (digits.length === 11 || digits.length === 14)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
}

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

export function parsePixKeyInput(value: unknown): { pixKey: string; pixKeyType: PixKeyType } | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.pixKey !== "string" || typeof body.pixKeyType !== "string") return null;
  const pixKey = body.pixKey.trim();
  const pixKeyType = body.pixKeyType;
  if (pixKey.length < 3 || pixKey.length > 200) return null;
  const digits = pixKey.replace(/\D/g, "");
  const valid = pixKeyType === "CPF"
    ? /^[0-9.\/-]+$/.test(pixKey) && digits.length === 11
    : pixKeyType === "CNPJ"
      ? /^[0-9.\/-]+$/.test(pixKey) && digits.length === 14
      : pixKeyType === "EMAIL"
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pixKey)
        : pixKeyType === "PHONE"
          ? /^\+?[0-9() .-]+$/.test(pixKey) && digits.length >= 10 && digits.length <= 13
          : pixKeyType === "EVP"
            ? /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pixKey)
            : false;
  return valid ? { pixKey, pixKeyType: pixKeyType as PixKeyType } : null;
}

/** Comparison only. Keep the original key for storage and the Asaas request. */
export function normalizePixKeyForComparison(value: string, type: PixKeyType) {
  if (type === "PHONE") {
    const digits = value.replace(/\D/g, "");
    return digits.startsWith("55") && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
  }
  if (type === "CPF" || type === "CNPJ") return value.replace(/\D/g, "");
  return value.trim().toLowerCase();
}
