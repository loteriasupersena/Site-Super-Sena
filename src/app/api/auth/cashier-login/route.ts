import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPassword } from "@/lib/auth/password";
import { authPrisma, createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { clearLoginFailures, getLoginBlock, recordLoginFailure } from "@/lib/auth/login-rate-limit";

export const runtime = "nodejs";
const schema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(1024),
}).strict();

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

  const blocked = await getLoginBlock(authPrisma, parsed.data.username);
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
    const failure = await recordLoginFailure(authPrisma, parsed.data.username);
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

  await clearLoginFailures(authPrisma, parsed.data.username);
  const { token, expiresAt } = await createSession(user.id);
  const response = NextResponse.json({ authenticated: true, role: "CASHIER" });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: secureCookie(request), sameSite: "lax", path: "/", expires: expiresAt,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
