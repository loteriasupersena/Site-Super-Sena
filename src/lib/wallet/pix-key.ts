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
