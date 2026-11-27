import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
type RouteContext = { params: Promise<{ storeId: string }> };

const updateSchema = z.object({
  commissionRateBasisPoints: z.number().int().min(0).max(2147483647),
}).strict();

async function requireAdmin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "ADMIN" || user.mustChangePassword) return { response: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  return { user };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  try {
    const parsedOrigin = new URL(origin);
    if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.host.toLowerCase() !== host.toLowerCase()) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
    }
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  }

  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  const { storeId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(storeId)) return NextResponse.json({ error: "Loja não encontrada." }, { status: 404, headers });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Informe um percentual válido, não negativo e com até duas casas decimais." }, { status: 400, headers });

  try {
    const updated = await authPrisma.$transaction(async (tx) => {
      const previous = await tx.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true, commissionRateBasisPoints: true },
      });
      if (!previous) throw new Error("NOT_FOUND");
      const store = await tx.store.update({
        where: { id: storeId },
        data: { commissionRateBasisPoints: parsed.data.commissionRateBasisPoints },
        select: { id: true, name: true, commissionRateBasisPoints: true },
      });
      await tx.auditEvent.create({ data: {
        actorId: auth.user.id,
        action: "STORE_COMMISSION_UPDATED",
        entityType: "Store",
        entityId: store.id,
        metadata: {
          storeName: store.name,
          commissionRateBasisPointsBefore: previous.commissionRateBasisPoints,
          commissionRateBasisPointsAfter: store.commissionRateBasisPoints,
        },
      } });
      return store;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      store: { ...updated, commissionPercent: updated.commissionRateBasisPoints / 100 },
    }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return NextResponse.json({ error: "Loja não encontrada." }, { status: 404, headers });
    return NextResponse.json({ error: "Não foi possível atualizar o percentual da loja." }, { status: 500, headers });
  }
}
