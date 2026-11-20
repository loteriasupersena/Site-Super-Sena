import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const bodySchema = z.object({ reference: z.string().trim().max(300).optional() }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ withdrawalId: string }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  try {
    const parsed = new URL(origin);
    if (![ "https:", "http:" ].includes(parsed.protocol) || parsed.host.toLowerCase() !== host) throw new Error();
  } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers }); }

  const admin = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!admin) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (admin.role !== "ADMIN" || admin.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  const { withdrawalId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(withdrawalId)) return NextResponse.json({ error: "Saque não encontrado." }, { status: 404, headers });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Referência inválida." }, { status: 400, headers });

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Withdrawal" WHERE "id" = ${withdrawalId} FOR UPDATE`;
      const item = await tx.withdrawal.findUnique({ where: { id: withdrawalId }, select: {
        id: true, userId: true, amountCents: true, status: true, providerRef: true,
      } });
      if (!item) throw new Error("NOT_FOUND");
      if (![ "PENDING", "PROCESSING", "FAILED" ].includes(item.status)) throw new Error("INVALID_STATE");
      const paidAt = new Date();
      const changed = await tx.withdrawal.updateMany({
        where: { id: item.id, status: item.status },
        data: { status: "PAID", reviewedById: admin.id, providerRef: parsed.data.reference?.trim() || item.providerRef },
      });
      if (changed.count !== 1) throw new Error("INVALID_STATE");
      await tx.withdrawalStatusHistory.create({ data: {
        withdrawalId: item.id, fromStatus: item.status, toStatus: "PAID", actorId: admin.id,
        note: "Administrador confirmou o pagamento Pix realizado externamente." +
          (parsed.data.reference?.trim() ? " Referência: " + parsed.data.reference.trim() : ""),
      } });
      await tx.auditEvent.create({ data: {
        actorId: admin.id, action: "WITHDRAWAL_MANUAL_PIX_CONFIRMED",
        entityType: "Withdrawal", entityId: item.id,
        metadata: { userId: item.userId, amountCents: item.amountCents, reference: parsed.data.reference?.trim() || null, paidAt: paidAt.toISOString() },
      } });
      return { id: item.id, status: "PAID" as const, amountCents: item.amountCents, paidAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      success: true, withdrawal: result,
      message: "Pagamento Pix confirmado e registrado no histórico.",
    }, { status: 200, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Saque não encontrado." }, { status: 404, headers });
    if (code === "INVALID_STATE") return NextResponse.json({ error: "Este saque já foi encerrado ou atualizado. Atualize a lista." }, { status: 409, headers });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "O saque foi atualizado simultaneamente. Atualize a lista." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível confirmar o pagamento Pix." }, { status: 500, headers });
  }
}
