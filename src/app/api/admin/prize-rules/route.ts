import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIXED_PRIZES_CENTS = {
  unit: 600,
  tens: 2_000,
  hundreds: 20_000,
  milhar: 200_000,
  quina: 2_000_000,
  sena: 20_000_000,
} as const;

async function admin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { error: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  if (user.role !== "ADMIN" || user.mustChangePassword) {
    return { error: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers: { "Cache-Control": "no-store" } }) };
  }
  return { user };
}

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const access = await admin(request);
  if ("error" in access) return access.error;
  return NextResponse.json({
    gamePriceCents: 600,
    categoryStakeCents: 100,
    prizesCents: FIXED_PRIZES_CENTS,
    updatedAt: null,
  }, { headers: { "Cache-Control": "no-store, private" } });
}

export async function PUT(request: NextRequest) {
  const access = await admin(request);
  if ("error" in access) return access.error;
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({
    error: "Os valores dos prêmios são fixos e não podem ser alterados pelo painel.",
  }, { status: 409, headers: { "Cache-Control": "no-store" } });
}
