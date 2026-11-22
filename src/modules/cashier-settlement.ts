import { Prisma } from "@/generated/prisma/client";
import { calculateCommissionCents } from "@/domain/cashier-commission";

export type CashierSettlementCalculation = {
  cashSalesCents: number;
  pixSalesCents: number;
  totalSalesCents: number;
  salesCount: number;
  gamesCount: number;
  commissionCents: number;
  // Legacy snapshot columns remain zero for schema compatibility. Historical
  // settlements retain their original values, but new cashier settlements
  // never include prize payouts.
  cashPrizePayoutCount: number;
  cashPrizePayoutCents: number;
  pendingCashSalesCount: number;
  pendingCashSalesCents: number;
  netBalanceCents: number;
  cashierOwesPlatformCents: number;
  platformOwesCashierCents: number;
};

export class CashierSettlementIntegrityError extends Error {
  constructor() {
    super("CASHIER_COMMISSION_INTEGRITY_ERROR");
    this.name = "CashierSettlementIntegrityError";
  }
}

export async function calculateCashierSettlement(
  tx: Prisma.TransactionClient,
  cashierId: string,
  since: Date,
  cutoff: Date,
): Promise<CashierSettlementCalculation> {
  const eligible = {
    cashierId,
    status: "CONFIRMED" as const,
    confirmedAt: { gt: since, lte: cutoff },
  };
  const eligibleForFinancials = {
    ...eligible,
    OR: [
      { paymentMethod: "CASH" as const },
      { paymentMethod: "PIX" as const, payment: { is: { status: "CONFIRMED" as const } } },
    ],
  };

  const [cash, pix, commissions, games, pendingCashSales, eligibleSales] = await Promise.all([
    tx.purchase.aggregate({
      where: { ...eligible, paymentMethod: "CASH" },
      _sum: { totalCents: true }, _count: { _all: true },
    }),
    tx.purchase.aggregate({
      where: { ...eligible, paymentMethod: "PIX", payment: { is: { status: "CONFIRMED" } } },
      _sum: { totalCents: true }, _count: { _all: true },
    }),
    tx.cashierCommission.aggregate({
      where: { cashierId, purchase: { is: eligibleForFinancials } },
      _sum: { amountCents: true },
    }),
    tx.numericParticipationLine.count({
      where: { participation: { is: { status: "CONFIRMED", purchase: { is: eligibleForFinancials } } } },
    }),
    tx.purchase.aggregate({
      where: {
        cashierId, paymentMethod: "CASH", createdAt: { lte: cutoff },
        OR: [
          { status: "PENDING_PAYMENT" },
          { status: "CONFIRMED", confirmedAt: { gt: cutoff } },
        ],
      },
      _sum: { totalCents: true }, _count: { _all: true },
    }),
    tx.purchase.findMany({
      where: eligibleForFinancials,
      select: {
        id: true, totalCents: true,
        commission: { select: { cashierId: true, rateBasisPoints: true, amountCents: true } },
      },
    }),
  ]);

  const commissionsAreConsistent = eligibleSales.every((sale) => {
    const commission = sale.commission;
    if (!commission || commission.cashierId !== cashierId) return false;
    try {
      return commission.amountCents === calculateCommissionCents(sale.totalCents, commission.rateBasisPoints);
    } catch {
      return false;
    }
  });
  if (!commissionsAreConsistent) throw new CashierSettlementIntegrityError();

  const cashSalesCents = cash._sum.totalCents ?? 0;
  const pixSalesCents = pix._sum.totalCents ?? 0;
  const commissionCents = commissions._sum.amountCents ?? 0;
  // PIX is already held by the platform. Only cash sales less the cashier's
  // commission participate in the physical transfer between cash boxes.
  const netBalanceCents = cashSalesCents - commissionCents;

  return {
    cashSalesCents,
    pixSalesCents,
    totalSalesCents: cashSalesCents + pixSalesCents,
    salesCount: cash._count._all + pix._count._all,
    gamesCount: games,
    commissionCents,
    cashPrizePayoutCount: 0,
    cashPrizePayoutCents: 0,
    pendingCashSalesCount: pendingCashSales._count._all,
    pendingCashSalesCents: pendingCashSales._sum.totalCents ?? 0,
    netBalanceCents,
    cashierOwesPlatformCents: Math.max(0, netBalanceCents),
    platformOwesCashierCents: Math.max(0, -netBalanceCents),
  };
}
