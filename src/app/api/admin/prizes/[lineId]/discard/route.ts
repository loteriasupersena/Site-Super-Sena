import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { getNumericPrizeReview } from "@/domain/numeric-prize-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch { return false; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ lineId: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Somente o administrador pode remover este prêmio." }, { status: 403, headers });

  const { lineId } = await context.params;
  let confirmation: { receiptCode?: string } = {};
  try { confirmation = await request.json(); } catch { return NextResponse.json({ error: "Confirme o código do recibo." }, { status: 400, headers }); }
  const confirmedReceiptCode = typeof confirmation.receiptCode === "string" ? confirmation.receiptCode.trim().toUpperCase() : "";
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(lineId)) return NextResponse.json({ error: "Prêmio não encontrado." }, { status: 404, headers });

  try {
    await authPrisma.$transaction(async (tx) => {
      const line = await tx.numericParticipationLine.findUnique({
        where: { id: lineId },
        include: {
          prizePayout: true,
          prizePaymentRequest: { include: { batch: true } },
          participation: { include: { round: true, purchase: true } },
        },
      });
      if (!line || line.prizeCents !== 100 || line.prizeCreditedAt || line.prizePayout || !confirmedReceiptCode || line.participation.purchase.receiptCode?.toUpperCase() !== confirmedReceiptCode) {
        throw new Error("PRIZE_NOT_ELIGIBLE");
      }
      if (line.participation.status !== "CONFIRMED" ||
          line.participation.round.status !== "COMPLETED" ||
          !line.participation.round.resultNumber ||
          line.participation.purchase.status !== "CONFIRMED") {
        throw new Error("PRIZE_NOT_ELIGIBLE");
      }
      const review = getNumericPrizeReview({
        numberValue: line.numberValue,
        tensCents: line.tensCents,
        hundredsCents: line.hundredsCents,
        milharCents: line.milharCents,
        quinaCents: line.quinaCents,
        senaCents: line.senaCents,
        ruleVersion: line.ruleVersion,
        ruleSnapshot: line.ruleSnapshot,
      }, line.participation.round.resultNumber);
      if (review !== null) {
        throw new Error("PRIZE_NOT_INCONSISTENT");
      }
      const paymentRequest = line.prizePaymentRequest;
      if (paymentRequest || line.prizePaymentBatchItems.length > 0) {
        paymentRequest.status === "PAID" ||
        paymentRequest.status === "PROCESSING" ||
        paymentRequest.providerTransferId ||
        paymentRequest.batch?.status === "PAID" ||
        paymentRequest.batch?.status === "PROCESSING" ||
        paymentRequest.batch?.providerTransferId
      )) {
        throw new Error("PAYMENT_IN_PROGRESS");
      }

      await tx.numericParticipationLine.update({
        where: { id: line.id },
        data: { prizeCents: null, prizeCreditedAt: null },
      });
      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: "ADMIN_DISCARDED_INCONSISTENT_TEST_PRIZE",
          entityType: "NumericParticipationLine",
          entityId: line.id,
          metadata: {
            previousPrizeCents: line.prizeCents,
            receiptCode: line.participation.purchase.receiptCode,
            reason: "Prêmio inconsistente de R$ 1,00 removido pelo administrador; aposta preservada.",
          } as Prisma.InputJsonValue,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ message: "Prêmio removido; aposta preservada." }, { status: 200, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "PRIZE_NOT_ELIGIBLE") {
      return NextResponse.json({ error: "Este registro não corresponde ao prêmio de teste elegível para remoção." }, { status: 409, headers });
    }
    if (error instanceof Error && error.message === "PRIZE_NOT_INCONSISTENT") {
      return NextResponse.json({ error: "O prêmio está consistente com a apuração e não pode ser removido por esta ação." }, { status: 409, headers });
    }
    if (error instanceof Error && error.message === "PAYMENT_IN_PROGRESS") {
      return NextResponse.json({ error: "Há uma solicitação ou vínculo de pagamento. A remoção foi bloqueada para preservar o histórico financeiro." }, { status: 409, headers });
    }
    return NextResponse.json({ error: "Não foi possível remover o prêmio." }, { status: 500, headers });
  }
}
