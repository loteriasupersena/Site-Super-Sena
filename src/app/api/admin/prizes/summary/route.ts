import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { getNumericPrizeReview, NUMERIC_PRIZE_CATEGORY_LABELS } from "@/domain/numeric-prize-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "ADMIN" || user.mustChangePassword) {
    return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  }

  try {
    // A base é a apuração confirmada, não a fila de solicitações Pix.
    // Assim, prêmios sem solicitação também entram na obrigação pendente.
    const lines = await authPrisma.numericParticipationLine.findMany({
      where: {
        prizeCents: { gt: 0 },
        prizeExpiredAt: null,
        prizeCreditedAt: null,
        prizePayout: { is: null },
        participation: {
          is: {
            status: "CONFIRMED",
            round: { is: { status: "COMPLETED", resultNumber: { not: null } } },
            purchase: { is: { status: "CONFIRMED" } },
          },
        },
      },
      select: {
        id: true, numberValue: true, tensCents: true,
        hundredsCents: true, milharCents: true, quinaCents: true, senaCents: true,
        ruleVersion: true, ruleSnapshot: true, prizeCents: true,
        prizePaymentRequest: { select: { status: true, netCents: true, requestedAt: true } },
        participation: { select: { round: { select: { resultNumber: true, resultPublishedAt: true } }, purchase: { select: { receiptCode: true } } } },
      },
    });

    const groups = new Map<string, { category: string; count: number; grossCents: number; dueCents: number; unrequestedCount: number; requestedCount: number }>();
    const reviewItems: { id: string; prizeCents: number; category: string; receiptCode: string | null }[] = [];
    let totalGrossCents = 0;
    let totalDueCents = 0;
    let unrequestedCount = 0;
    let requestedCount = 0;
    let inconsistentCount = 0;

    for (const line of lines) {
      const publishedAt = line.participation.round.resultPublishedAt;
      const expiredAt = publishedAt ? publishedAt.getTime() + 7 * 24 * 60 * 60 * 1000 : null;
      if (expiredAt !== null && Date.now() >= expiredAt && (!line.prizePaymentRequest?.requestedAt || line.prizePaymentRequest.requestedAt.getTime() > expiredAt)) continue;
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
      const category = review ? NUMERIC_PRIZE_CATEGORY_LABELS[review.category] : "Não classificado";
      const grossCents = line.prizeCents ?? 0;
      const requestIsPaid = line.prizePaymentRequest?.status === "PAID";
      if (requestIsPaid) continue;
      const dueCents = line.prizePaymentRequest ? line.prizePaymentRequest.netCents : grossCents;
      const hasRequest = Boolean(line.prizePaymentRequest);
      if (hasRequest) requestedCount += 1;
      else unrequestedCount += 1;
      const inconsistent = !review?.calculationConsistent || review.calculatedPrizeCents !== grossCents;
      if (inconsistent) inconsistentCount += 1;
      if (grossCents === 100 && inconsistent) {
        reviewItems.push({ id: line.id, prizeCents: grossCents, category, receiptCode: line.participation.purchase.receiptCode });
      }

      const current = groups.get(category) ?? { category, count: 0, grossCents: 0, dueCents: 0, unrequestedCount: 0, requestedCount: 0 };
      current.count += 1;
      current.grossCents += grossCents;
      current.dueCents += dueCents;
      if (hasRequest) current.requestedCount += 1;
      else current.unrequestedCount += 1;
      groups.set(category, current);
      totalGrossCents += grossCents;
      totalDueCents += dueCents;
    }

    const order = ["Dezena", "Centena", "Milhar", "Quina", "Sena"];
    const breakdown = [...groups.values()].sort((a, b) => {
      const ai = order.indexOf(a.category);
      const bi = order.indexOf(b.category);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

    return NextResponse.json({
      count: breakdown.reduce((total, item) => total + item.count, 0),
      totalGrossCents,
      totalDueCents,
      unrequestedCount,
      requestedCount,
      inconsistentCount,
      reviewItems,
      breakdown,
      updatedAt: new Date().toISOString(),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível calcular as premiações pendentes." }, { status: 500, headers });
  }
}
