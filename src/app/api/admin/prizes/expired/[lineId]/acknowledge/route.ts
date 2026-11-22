import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

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

export async function POST(request: NextRequest, context: { params: Promise<{ lineId: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  const { lineId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(lineId)) return NextResponse.json({ error: "Prêmio não encontrado." }, { status: 404, headers });

  try {
    const result = await authPrisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "NumericParticipationLine" WHERE "id" = ${lineId} FOR UPDATE`;
      const line = await tx.numericParticipationLine.findUnique({
        where: { id: lineId },
        select: {
          id: true, prizeCents: true, prizeExpiredAt: true, prizeExpiryReviewedAt: true,
          prizeCreditedAt: true,
          prizePayout: { select: { id: true } },
          prizePaymentRequest: { select: { id: true, requestedAt: true, status: true } },
          participation: { select: {
            round: { select: { code: true, resultPublishedAt: true } },
            purchase: { select: { receiptCode: true, status: true } },
          } },
        },
      });
      if (!line || !line.prizeExpiredAt || line.prizeExpiryReviewedAt || line.prizeCreditedAt || line.prizePayout ||
          line.participation.purchase.status !== "CONFIRMED") throw new Error("NOT_REVIEWABLE");
      const deadline = line.participation.round.resultPublishedAt
        ? line.participation.round.resultPublishedAt.getTime() + 7 * 24 * 60 * 60 * 1000 : null;
      if (line.prizePaymentRequest && deadline !== null && line.prizePaymentRequest.requestedAt.getTime() <= deadline) {
        throw new Error("CLAIMED_IN_TIME");
      }
      const reviewedAt = new Date();
      const changed = await tx.numericParticipationLine.updateMany({
        where: { id: line.id, prizeExpiredAt: { not: null }, prizeExpiryReviewedAt: null, prizeCreditedAt: null },
        data: { prizeExpiryReviewedAt: reviewedAt },
      });
      if (changed.count !== 1) throw new Error("NOT_REVIEWABLE");
      await tx.auditEvent.create({ data: {
        actorId: user.id, action: "ADMIN_ACKNOWLEDGED_EXPIRED_PRIZE",
        entityType: "NumericParticipationLine", entityId: line.id,
        metadata: {
          receiptCode: line.participation.purchase.receiptCode,
          roundCode: line.participation.round.code,
          prizeCents: line.prizeCents,
          expiredAt: line.prizeExpiredAt.toISOString(),
          reviewedAt: reviewedAt.toISOString(),
          note: "Baixa administrativa de prêmio expirado; aposta e recibo preservados.",
        },
      } });
      return { id: line.id, reviewedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, result, message: "Baixa administrativa registrada. A aposta e o recibo foram preservados." }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "CLAIMED_IN_TIME") return NextResponse.json({ error: "Este prêmio foi solicitado dentro do prazo e não pode receber baixa por expiração." }, { status: 409, headers });
    if (code === "NOT_REVIEWABLE") return NextResponse.json({ error: "Este prêmio não está disponível para baixa administrativa." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível registrar a baixa administrativa." }, { status: 500, headers });
  }
}
