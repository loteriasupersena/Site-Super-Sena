import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: { params: Promise<{ requestId: string }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
  try {
    const parsed = new URL(origin);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.host.toLowerCase() !== host) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
    }
  } catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 403 }); }

  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401 });
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403 });
  const { requestId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  try {
    const result = await authPrisma.$transaction(async (tx) => {
      const item = await tx.prizePaymentRequest.findUnique({ where: { id: requestId }, select: { id: true, purchaseId: true, participationLineId: true } });
      if (!item) throw new Error("NOT_FOUND");
      const reviewedAt = new Date();
      const changed = await tx.prizePaymentRequest.updateMany({
        where: { id: item.id, status: "PENDING" },
        data: { status: "REJECTED", reviewedAt, reviewerId: user.id, note: "Solicitação recusada pela administração." },
      });
      if (changed.count !== 1) throw new Error("NOT_PENDING");
      const updated = { id: item.id, status: "REJECTED" as const, reviewedAt };
      await tx.auditEvent.create({ data: {
        actorId: user.id, action: "PRIZE_PIX_REQUEST_REJECTED", entityType: "PrizePaymentRequest", entityId: item.id,
        metadata: { purchaseId: item.purchaseId, participationLineId: item.participationLineId, status: "REJECTED" },
      } });
      return updated;
    });
    return NextResponse.json({ success: true, request: result }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
    if (code === "NOT_PENDING") return NextResponse.json({ error: "Esta solicitação já foi processada." }, { status: 409 });
    return NextResponse.json({ error: "Não foi possível recusar a solicitação." }, { status: 500 });
  }
}
