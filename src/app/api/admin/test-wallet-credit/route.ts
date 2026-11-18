import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

async function requireAdmin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "ADMIN" || user.mustChangePassword) return { response: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  return { user };
}
function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return ["https:", "http:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host; }
  catch { return false; }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  try {
    const users = await authPrisma.user.findMany({
      where: { role: "PLAYER", ...(q ? { OR: [
        { username: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ] } : {}) },
      select: { id: true, username: true, fullName: true, status: true },
      orderBy: [{ status: "asc" }, { username: "asc" }],
      take: 100,
    });
    return NextResponse.json({ items: users }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar os jogadores." }, { status: 500, headers });
  }
}

const schema = z.object({
  userId: z.string().min(1).max(128),
  amountCents: z.number().int().min(1).max(1_000_000_00),
  reason: z.string().trim().min(8).max(300),
}).strict();

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400, headers }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Selecione um jogador, informe um valor válido e justifique o crédito." }, { status: 400, headers });

  const idempotencyKey = "admin-test-credit:" + randomUUID();
  try {
    const result = await authPrisma.$transaction(async (tx) => {
      const player = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, username: true, role: true, status: true } });
      if (!player || player.role !== "PLAYER") throw new Error("PLAYER_NOT_FOUND");
      if (player.status !== "ACTIVE") throw new Error("PLAYER_INACTIVE");
      const entry = await tx.ledgerEntry.create({ data: {
        userId: player.id,
        type: "ADJUSTMENT",
        amountCents: parsed.data.amountCents,
        currency: "BRL",
        idempotencyKey,
        description: "Crédito administrativo de teste: " + parsed.data.reason.trim(),
      } });
      await tx.auditEvent.create({ data: {
        actorId: auth.user.id,
        action: "PLAYER_TEST_WALLET_CREDIT",
        entityType: "LedgerEntry",
        entityId: entry.id,
        metadata: {
          userId: player.id,
          username: player.username,
          amountCents: parsed.data.amountCents,
          reason: parsed.data.reason.trim(),
          ledgerType: "ADJUSTMENT",
          testCredit: true,
        },
      } });
      return { player: player.username, amountCents: entry.amountCents, createdAt: entry.createdAt.toISOString() };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, credit: result }, { headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "A carteira foi atualizada simultaneamente. Tente novamente." }, { status: 409, headers });
    const code = error instanceof Error ? error.message : "";
    if (code === "PLAYER_NOT_FOUND") return NextResponse.json({ error: "Jogador não encontrado." }, { status: 404, headers });
    if (code === "PLAYER_INACTIVE") return NextResponse.json({ error: "A conta do jogador não está ativa." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível registrar o crédito de teste." }, { status: 500, headers });
  }
}
