export function hasSameOrigin(request: { headers: Headers }): boolean {
  const origin = request.headers.get("origin");
  const requestHost = request.headers.get("host");
  if (!origin || !requestHost) return false;

  try {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:") return false;
    return parsedOrigin.host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}
