import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "CASHIER" || user.mustChangePassword) {
    return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  }

  const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = 20;
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1) {
    return NextResponse.json({ error: "Página inválida." }, { status: 400, headers });
  }

  try {
    const where = { cashierId: user.id };
    const [total, settlements] = await Promise.all([
      authPrisma.cashierSettlement.count({ where }),
      authPrisma.cashierSettlement.findMany({
        where,
        orderBy: [{ settledAt: "desc" }, { id: "desc" }],
        skip: (requestedPage - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, settledAt: true, cashSalesCents: true, pixSalesCents: true,
          totalSalesCents: true, salesCount: true, gamesCount: true,
          commissionCents: true, cashPrizePayoutCount: true, cashPrizePayoutCents: true,
          pendingCashSalesCount: true, pendingCashSalesCents: true,
        },
      }),
    ]);
    return NextResponse.json({
      settlements: settlements.map((item) => {
        const netBalanceCents = item.cashSalesCents - item.commissionCents - item.cashPrizePayoutCents;
        return {
          ...item,
          settledAt: item.settledAt.toISOString(),
          netBalanceCents,
          cashierOwesPlatformCents: Math.max(0, netBalanceCents),
          platformOwesCashierCents: Math.max(0, -netBalanceCents),
        };
      }),
      pagination: { page: requestedPage, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar o histórico de acertos." }, { status: 500, headers });
  }
}
