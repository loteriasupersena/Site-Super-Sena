import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { getNumericPrizeReview, NUMERIC_PRIZE_CATEGORY_LABELS } from "@/domain/numeric-prize-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401 });
  if (user.role !== "ADMIN" || user.mustChangePassword) {
    return NextResponse.json({ error: "Acesso não permitido." }, { status: 403 });
  }

  try {
    const lines = await authPrisma.numericParticipationLine.findMany({
      where: {
        prizeCents: { gt: 0 },
        prizeCreditedAt: null,
        prizePayout: { is: null },
        prizePaymentRequest: { is: { status: { in: ["PENDING", "PROCESSING"] } } },
        participation: {
          is: {
            status: "CONFIRMED",
            round: { is: { status: "COMPLETED" } },
            purchase: { is: { status: "CONFIRMED", cashierId: { not: null }, playerId: null } },
          },
        },
      },
      select: {
        id: true, numberValue: true, tensCents: true,
        hundredsCents: true, milharCents: true, quinaCents: true, senaCents: true,
        ruleVersion: true, ruleSnapshot: true, prizeCents: true, prizeCreditedAt: true,
        prizePayout: { select: { channel: true, paidAt: true, reference: true } },
        prizePaymentRequest: { select: { id: true, status: true, updatedAt: true, providerTransferStatus: true, pixKey: true, pixKeyMasked: true, pixKeyType: true, holderName: true, holderCpfMasked: true, grossCents: true, administrativeFeeCents: true, transactionFeeCents: true, netCents: true, requestedAt: true, paymentReference: true, batch: { select: { id: true, pixKey: true, grossCents: true, administrativeFeeCents: true, transactionFeeCents: true, netCents: true } } } },
        participation: {
          select: {
            totalCents: true,
            round: { select: { code: true, resultNumber: true, resultAt: true } },
            purchase: {
              select: {
                totalCents: true, receiptCode: true, playerId: true, cashierId: true,
                player: { select: { username: true, fullName: true } },
                customer: { select: { name: true, phone: true } },
                cashier: { select: { username: true, fullName: true } },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return NextResponse.json({
      winners: lines.map((line) => {
        const round = line.participation.round;
        const review = getNumericPrizeReview({
          numberValue: line.numberValue,
          tensCents: line.tensCents,
          hundredsCents: line.hundredsCents, milharCents: line.milharCents, senaCents: line.senaCents,
          quinaCents: line.quinaCents, ruleVersion: line.ruleVersion,
          ruleSnapshot: line.ruleSnapshot,
        }, round.resultNumber);
        return {
          id: line.id,
          prizeCents: line.prizeCents ?? 0,
          prizeCategoryLabel: review ? NUMERIC_PRIZE_CATEGORY_LABELS[review.category] : null,
          calculationConsistent: Boolean(review?.calculationConsistent && review.calculatedPrizeCents === line.prizeCents),
          roundCode: round.code,
          receiptCode: line.participation.purchase.receiptCode,
          playerName: line.participation.purchase.player?.fullName
            ?? line.participation.purchase.player?.username
            ?? line.participation.purchase.customer?.name
            ?? "Cliente sem nome cadastrado",
          paid: false,
          paymentRequest: line.prizePaymentRequest ? {
            status: line.prizePaymentRequest.status,
            pixKey: line.prizePaymentRequest.pixKey ?? line.prizePaymentRequest.batch?.pixKey ?? null,
            pixKeyMasked: line.prizePaymentRequest.pixKeyMasked,
            pixKeyType: line.prizePaymentRequest.pixKeyType,
            netCents: line.prizePaymentRequest.netCents,
          } : null,
        };
      }),
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar a lista de ganhadores." }, {
      status: 500, headers: { "Cache-Control": "no-store" },
    });
  }
}
