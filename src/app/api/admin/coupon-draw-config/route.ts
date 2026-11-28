import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const CONFIG_ID = "global";
const headers = { "Cache-Control": "no-store, private" };
const schema = z.object({
  batchSize: z.number().int().min(1).max(100_000),
  winnersPerBatch: z.number().int().min(1).max(100_000),
}).strict();

async function admin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { error: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "ADMIN" || user.mustChangePassword) {
    return { error: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  }
  return { user };
}

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const access = await admin(request);
  if ("error" in access) return access.error;
  try {
    const [config, queue] = await Promise.all([
      authPrisma.couponDrawConfig.findUnique({ where: { id: CONFIG_ID } }),
      authPrisma.couponQueueState.findUnique({ where: { id: "global" } }),
    ]);
    if (!config || !queue?.currentBatchId) throw new Error("Coupon draw config or queue unavailable");
    const activeBatch = await authPrisma.couponBatch.findUnique({ where: { id: queue.currentBatchId } });
    if (!activeBatch) throw new Error("Active coupon batch unavailable");
    return NextResponse.json({
      config: { batchSize: config.batchSize, winnersPerBatch: config.winnersPerBatch, version: config.version, updatedAt: config.updatedAt.toISOString() },
      activeBatch: {
        sequenceNumber: activeBatch.sequenceNumber,
        batchSize: activeBatch.batchSize,
        winnersPerBatch: activeBatch.winnersPerBatch,
        ruleVersion: activeBatch.ruleVersion,
        issuedCoupons: queue.currentBatchCount,
      },
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as regras dos cupons." }, { status: 500, headers });
  }
}

export async function PUT(request: NextRequest) {
  const access = await admin(request);
  if ("error" in access) return access.error;
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.winnersPerBatch > parsed.data.batchSize) {
    return NextResponse.json({ error: "Informe lotes entre 1 e 100.000 cupons e ganhadores entre 1 e o tamanho do lote." }, { status: 400, headers });
  }

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CouponDrawConfig" WHERE "id" = ${CONFIG_ID} FOR UPDATE`;
      const previous = await tx.couponDrawConfig.findUnique({ where: { id: CONFIG_ID } });
      if (!previous) throw new Error("COUPON_DRAW_CONFIG_UNAVAILABLE");
      const updated = await tx.couponDrawConfig.update({
        where: { id: CONFIG_ID },
        data: {
          batchSize: parsed.data.batchSize,
          winnersPerBatch: parsed.data.winnersPerBatch,
          version: { increment: 1 },
          updatedById: access.user.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: access.user.id,
          action: "COUPON_DRAW_RULE_UPDATED",
          entityType: "CouponDrawConfig",
          entityId: CONFIG_ID,
          metadata: {
            oldValue: { batchSize: previous.batchSize, winnersPerBatch: previous.winnersPerBatch, version: previous.version },
            newValue: { batchSize: updated.batchSize, winnersPerBatch: updated.winnersPerBatch, version: updated.version },
            appliesTo: "next_batch",
          },
        },
      });
      return updated;
    });
    return NextResponse.json({
      config: { batchSize: result.batchSize, winnersPerBatch: result.winnersPerBatch, version: result.version, updatedAt: result.updatedAt.toISOString() },
      message: "Regra salva. Ela será aplicada somente ao próximo lote aberto.",
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível salvar a regra. Nenhuma alteração foi confirmada." }, { status: 500, headers });
  }
}
