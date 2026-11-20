import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { maskPixKey, parsePixKeyInput } from "@/lib/wallet/pix-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return ["https:", "http:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host; }
  catch { return false; }
}
function parseInput(value: unknown) {
  return parsePixKeyInput(value);
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "PLAYER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  try {
    const [ledger, withdrawals] = await Promise.all([
      authPrisma.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } }),
      authPrisma.withdrawal.findMany({
        where: { userId: user.id },
        select: { id: true, amountCents: true, status: true, providerRef: true, pixKeyMasked: true, createdAt: true, updatedAt: true, statusHistory: { select: { toStatus: true, note: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
    ]);
    return NextResponse.json({
      availableCents: ledger._sum.amountCents ?? 0,
      withdrawals: withdrawals.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), statusHistory: item.statusHistory.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })) })),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a carteira." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "PLAYER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const input = parseInput(payload);
  if (!input) return NextResponse.json({ error: "Informe o tipo e a chave Pix." }, { status: 400, headers });

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE', user.id);
      const ledger = await tx.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } });
      const available = ledger._sum.amountCents ?? 0;
      if (available <= 0) throw new Error("INSUFFICIENT_BALANCE");
      const amountCents = available;
      const id = "wdr_" + randomUUID().replace(/-/g, "");
      const withdrawal = await tx.withdrawal.create({ data: {
        id, userId: user.id, amountCents, pixKey: input.pixKey, pixKeyType: input.pixKeyType,
        pixKeyMasked: maskPixKey(input.pixKey), paymentReference: null,
        status: "PENDING", reviewedById: null,
        idempotencyKey: "withdrawal:" + randomUUID(),
      } });
      await tx.ledgerEntry.create({ data: {
        userId: user.id, withdrawalId: withdrawal.id, type: "WITHDRAWAL_RESERVE",
        amountCents: -amountCents, currency: "BRL",
        idempotencyKey: "withdrawal-reserve:" + withdrawal.id,
        description: "Reserva de saldo para solicitação de saque " + withdrawal.id,
      } });
      await tx.withdrawalStatusHistory.create({ data: {
        withdrawalId: withdrawal.id, fromStatus: null, toStatus: "PENDING",
        actorId: user.id, note: "Solicitação de saque recebida e aguardando pagamento manual pela administração.",
      } });
      await tx.auditEvent.create({ data: {
        actorId: user.id, action: "WITHDRAWAL_REQUESTED", entityType: "Withdrawal", entityId: withdrawal.id,
        metadata: { amountCents, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType, status: withdrawal.status, payoutMode: "ADMIN_MANUAL" },
      } });
      return { id: withdrawal.id, amountCents, status: withdrawal.status, availableCents: 0 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      success: true,
      withdrawal: { id: result.id, amountCents: result.amountCents, status: "PENDING", availableCents: 0 },
      message: "Solicitação de saque recebida. O pagamento Pix será realizado e confirmado pela administração.",
    }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "A carteira foi atualizada simultaneamente. Atualize o saldo e tente novamente." }, { status: 409, headers });
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "Não há saldo disponível para sacar." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível solicitar o saque." }, { status: 500, headers });
  }
}
