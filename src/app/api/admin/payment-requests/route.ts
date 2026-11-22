import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { getNumericPrizeReview, NUMERIC_PRIZE_CATEGORY_LABELS } from "@/domain/numeric-prize-review";
import { maskPixKey } from "@/lib/wallet/pix-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });

  try {
    const [lines, withdrawals] = await Promise.all([
      authPrisma.numericParticipationLine.findMany({
        where: {
          prizeCents: { gt: 0 }, prizeExpiredAt: null, prizeCreditedAt: null, prizePayout: { is: null },
          prizePaymentRequest: { is: { status: { in: ["PENDING", "PROCESSING"] } } },
          participation: { is: {
            status: "CONFIRMED",
            round: { is: { status: "COMPLETED" } },
            purchase: { is: { status: "CONFIRMED", cashierId: { not: null }, playerId: null } },
          } },
        },
        select: {
          id: true, numberValue: true, tensCents: true, hundredsCents: true, milharCents: true,
          quinaCents: true, senaCents: true, ruleVersion: true, ruleSnapshot: true, prizeCents: true,
          prizePaymentRequest: { select: {
            status: true, pixKey: true, pixKeyMasked: true, pixKeyType: true, netCents: true, grossCents: true,
            requestedAt: true, holderName: true, holderCpfMasked: true,
            batch: { select: { pixKey: true } },
          } },
          participation: { select: {
            round: { select: { code: true, resultNumber: true, resultPublishedAt: true } },
            purchase: { select: {
              receiptCode: true,
              player: { select: { username: true, fullName: true } },
              customer: { select: { name: true } },
              cashier: { select: { username: true, fullName: true } },
            } },
          } },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      authPrisma.withdrawal.findMany({
        where: { status: { in: ["PENDING", "APPROVED", "FAILED", "PROCESSING"] } },
        include: { user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const now = Date.now();
    const prizeItems = lines.flatMap(line => {
      const request = line.prizePaymentRequest;
      if (!request) return [];
      const publishedAt = line.participation.round.resultPublishedAt;
      if (publishedAt) {
        const deadline = publishedAt.getTime() + 7 * 24 * 60 * 60 * 1000;
        if (now >= deadline && request.requestedAt.getTime() > deadline) return [];
      }
      const round = line.participation.round;
      const review = getNumericPrizeReview({
        numberValue: line.numberValue, tensCents: line.tensCents, hundredsCents: line.hundredsCents,
        milharCents: line.milharCents, quinaCents: line.quinaCents, senaCents: line.senaCents,
        ruleVersion: line.ruleVersion, ruleSnapshot: line.ruleSnapshot,
      }, round.resultNumber);
      const purchase = line.participation.purchase;
      return [{
        id: line.id,
        source: "RECIBO" as const,
        sourceLabel: "Prêmio de recibo",
        recipient: purchase.customer?.name ?? purchase.cashier?.fullName ?? purchase.cashier?.username ?? "Cliente de recibo",
        amountCents: request.netCents,
        grossCents: request.grossCents ?? line.prizeCents ?? 0,
        status: request.status,
        pixKey: request.pixKey ?? request.batch?.pixKey ?? null,
        pixKeyMasked: request.pixKeyMasked || "Chave indisponível",
        pixKeyType: request.pixKeyType,
        holderName: request.holderName,
        holderCpfMasked: request.holderCpfMasked,
        reference: purchase.receiptCode,
        detail: "Rodada " + round.code + " · " + (review ? NUMERIC_PRIZE_CATEGORY_LABELS[review.category] : "Prêmio"),
        calculationConsistent: Boolean(review?.calculationConsistent && review.calculatedPrizeCents === line.prizeCents),
        createdAt: request.requestedAt.toISOString(),
      }];
    });

    const withdrawalItems = withdrawals.map(item => ({
      id: item.id,
      source: "CARTEIRA" as const,
      sourceLabel: "Saque da carteira digital",
      recipient: item.user.username,
      amountCents: item.amountCents,
      grossCents: item.amountCents,
      status: item.status,
      pixKey: item.pixKey,
      pixKeyMasked: item.pixKeyMasked ?? (item.pixKey ? maskPixKey(item.pixKey) : "Chave indisponível"),
      pixKeyType: item.pixKeyType,
      holderName: item.holderName,
      holderCpfMasked: item.holderCpfMasked,
      reference: null,
      detail: "Saque da carteira digital",
      calculationConsistent: true,
      createdAt: item.createdAt.toISOString(),
    }));
    const items = [...prizeItems, ...withdrawalItems].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return NextResponse.json({ items, count: items.length }, { headers });
  } catch (error) {
    console.error("[admin-payment-requests] failed", error);
    return NextResponse.json({ error: "Não foi possível carregar as solicitações de pagamento." }, { status: 500, headers });
  }
}
