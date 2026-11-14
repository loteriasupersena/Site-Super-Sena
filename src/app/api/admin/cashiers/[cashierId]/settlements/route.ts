import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { calculateCashierSettlement, CashierSettlementIntegrityError } from "@/modules/cashier-settlement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const finalizeSchema = z.object({ cutoffAt: z.string().datetime({ offset: true }) }).strict();

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      parsed.host.toLowerCase() === request.headers.get("host")?.trim().toLowerCase();
  } catch { return false; }
}

async function requireAdmin(request: NextRequest) {
  const admin = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!admin) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (admin.role !== "ADMIN" || admin.mustChangePassword) {
    return { response: NextResponse.json({ error: "Somente o administrador pode acessar o acerto." }, { status: 403, headers }) };
  }
  return { admin };
}

async function lockCashier(tx: Prisma.TransactionClient, cashierId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${cashierId} AND "role" = 'CASHIER' FOR UPDATE`;
  const cashier = await tx.user.findFirst({ where: { id: cashierId, role: "CASHIER" }, select: { id: true } });
  if (!cashier) throw new Error("CASHIER_NOT_FOUND");
  const last = await tx.cashierSettlement.findFirst({
    where: { cashierId }, orderBy: { settledAt: "desc" }, select: { settledAt: true },
  });
  return last?.settledAt ?? new Date(0);
}

async function databaseNow(tx: Prisma.TransactionClient) {
  const rows = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
  return rows[0]!.now;
}

// The preview is read-only. Its cutoff is sent back when the administrator
// confirms, so sales or payouts made after the preview remain in the next period.
export async function GET(request: NextRequest, context: { params: Promise<{ cashierId: string }> }) {
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  const { cashierId } = await context.params;
  try {
    const preview = await authPrisma.$transaction(async (tx) => {
      const since = await lockCashier(tx, cashierId);
      const cutoffAt = await databaseNow(tx);
      const calculation = await calculateCashierSettlement(tx, cashierId, since, cutoffAt);
      return {
        ...calculation,
        periodStartAt: since.getTime() === 0 ? null : since.toISOString(),
        cutoffAt: cutoffAt.toISOString(),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ preview }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "CASHIER_NOT_FOUND") {
      return NextResponse.json({ error: "Cambista não encontrado." }, { status: 404, headers });
    }
    if (error instanceof CashierSettlementIntegrityError) {
      return NextResponse.json({ error: "Apuração bloqueada: existe venda confirmada sem comissão ou com comissão inconsistente. Corrija os dados antes de continuar." }, { status: 409, headers });
    }
    return NextResponse.json({ error: "Não foi possível apurar o período. Atualize a página e tente novamente." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ cashierId: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const auth = await requireAdmin(request);
  if ("response" in auth) return auth.response;
  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: "Confirmação de apuração inválida." }, { status: 400, headers });
  }
  const parsed = finalizeSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Atualize a apuração antes de confirmar o acerto." }, { status: 400, headers });

  const { cashierId } = await context.params;
  const cutoffAt = new Date(parsed.data.cutoffAt);
  try {
    const settlement = await authPrisma.$transaction(async (tx) => {
      const since = await lockCashier(tx, cashierId);
      const now = await databaseNow(tx);
      if (cutoffAt <= since || cutoffAt > now) throw new Error("STALE_SETTLEMENT_PREVIEW");

      const calculation = await calculateCashierSettlement(tx, cashierId, since, cutoffAt);
      const snapshot = await tx.cashierSettlement.create({
        data: {
          cashierId, adminId: auth.admin.id, settledAt: cutoffAt,
          cashSalesCents: calculation.cashSalesCents,
          pixSalesCents: calculation.pixSalesCents,
          totalSalesCents: calculation.totalSalesCents,
          salesCount: calculation.salesCount,
          gamesCount: calculation.gamesCount,
          commissionCents: calculation.commissionCents,
          cashPrizePayoutCount: calculation.cashPrizePayoutCount,
          cashPrizePayoutCents: calculation.cashPrizePayoutCents,
        },
      });
      await tx.numericPrizePayout.updateMany({
        where: { cashierId, channel: "CASHIER_CASH", settlementId: null, paidAt: { gt: since, lte: cutoffAt } },
        data: { settlementId: snapshot.id },
      });
      await tx.auditEvent.create({
        data: {
          actorId: auth.admin.id, action: "CASHIER_SETTLEMENT_RECORDED",
          entityType: "CashierSettlement", entityId: snapshot.id,
          metadata: {
            cashierId,
            ...calculation,
            periodStartAt: since.getTime() === 0 ? null : since.toISOString(),
            settledAt: snapshot.settledAt.toISOString(),
            liquidationConfirmedByAdmin: true,
          },
        },
      });
      return { ...snapshot, ...calculation };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ settlement }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "CASHIER_NOT_FOUND") {
      return NextResponse.json({ error: "Cambista não encontrado." }, { status: 404, headers });
    }
    if (error instanceof Error && error.message === "STALE_SETTLEMENT_PREVIEW") {
      return NextResponse.json({ error: "Este período já foi fechado ou a apuração expirou. Faça uma nova apuração antes de confirmar." }, { status: 409, headers });
    }
    if (error instanceof CashierSettlementIntegrityError) {
      return NextResponse.json({ error: "Acerto bloqueado: existe venda confirmada sem comissão ou com comissão inconsistente. Corrija os dados antes de fechar." }, { status: 409, headers });
    }
    return NextResponse.json({ error: "Não foi possível registrar o acerto. Atualize a página e tente novamente." }, { status: 500, headers });
  }
}
