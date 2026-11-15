import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { authPrisma, createSession, hashSessionToken, SESSION_COOKIE, CASHIER_APP_COOKIE } from "@/lib/auth/session";
import { clearLoginFailures, getLoginBlock, recordLoginFailure } from "@/lib/auth/login-rate-limit";

export const runtime = "nodejs";
const schema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(1024),
}).strict();

function getClientIp(request: NextRequest) {
  // These headers must be overwritten by the trusted edge/proxy, not passed through from clients.
  const candidates = [
    request.headers.get("cf-connecting-ip")?.trim(),
    request.headers.get("x-real-ip")?.trim(),
    request.headers.get("x-forwarded-for")?.split(",").map((value) => value.trim()).filter(Boolean)[0],
  ];
  return candidates.find((candidate): candidate is string => Boolean(candidate && isIP(candidate))) ?? null;
}

function secureCookie(request: NextRequest) {
  return request.nextUrl.protocol === "https:" || process.env.NODE_ENV === "production";
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  let originHost: string;
  try { originHost = new URL(origin).host; }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers: { "Cache-Control": "no-store" } }); }
  const requestHost = request.headers.get("host");
  if (!requestHost || originHost !== requestHost) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const clientIp = getClientIp(request) ?? (process.env.NODE_ENV === "production" ? null : "127.0.0.1");
  if (!clientIp) {
    return NextResponse.json({ error: "Não foi possível validar a conexão. Tente novamente." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const blocked = await getLoginBlock(authPrisma, parsed.data.username, clientIp);
  if (blocked) {
    const response = NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });
    response.headers.set("Retry-After", String(blocked.retryAfterSeconds));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const user = await authPrisma.user.findUnique({
    where: { username: parsed.data.username },
    select: { id: true, passwordHash: true, status: true, role: true },
  });
  const validPassword = await verifyPassword(parsed.data.password, user?.passwordHash ?? "");
  if (!user || user.status !== "ACTIVE" || !validPassword) {
    const failure = await recordLoginFailure(authPrisma, parsed.data.username, clientIp);
    if (failure.blocked) {
      const response = NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });
      response.headers.set("Retry-After", String(failure.retryAfterSeconds));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    return NextResponse.json({ error: "Usuário ou senha inválidos." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  // Crucial: reject every non-CASHIER profile before creating a session.
  if (user.role !== "CASHIER") {
    await recordLoginFailure(authPrisma, parsed.data.username);
    return NextResponse.json({ error: "Este aplicativo é exclusivo para cambistas." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  await clearLoginFailures(authPrisma, parsed.data.username, clientIp);
  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ authenticated: true, role: "CASHIER" });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: secureCookie(request), sameSite: "lax", path: "/", expires: expiresAt,
  });
  response.cookies.set(CASHIER_APP_COOKIE, hashSessionToken(token), {
    httpOnly: true, secure: secureCookie(request), sameSite: "lax", path: "/", expires: expiresAt,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
