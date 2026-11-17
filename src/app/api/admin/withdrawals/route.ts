import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { decryptPixKey, maskPixKey } from "@/lib/wallet/pix-key-crypto";
import { z } from "zod";
import { reconcileAsaasTransferFromPlatform } from "@/modules/payments/reconcile-asaas-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

async function requireAdmin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "ADMIN" || user.mustChangePassword) return { response: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  return { user };
}
function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return ["https:", "http:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host; }
  catch { return false; }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const include = {
      user: { select: { id: true, username: true } },
      reviewedBy: { select: { username: true } },
      statusHistory: { select: { fromStatus: true, toStatus: true, note: true, createdAt: true, actor: { select: { username: true } } }, orderBy: { createdAt: "asc" as const } },
    };
    const staleTransfers = await authPrisma.withdrawal.findMany({
      where: { status: "PROCESSING", asaasTransferId: { not: null }, updatedAt: { lt: new Date(Date.now() - 10_000) } },
      select: { id: true, asaasTransferId: true, paymentReference: true },
      take: 50, orderBy: { updatedAt: "asc" },
    });
    await Promise.all(staleTransfers.map(async (item) => {
      if (!item.asaasTransferId || !item.paymentReference) return;
      const claim = await authPrisma.withdrawal.updateMany({
        where: { id: item.id, status: "PROCESSING", updatedAt: { lt: new Date(Date.now() - 10_000) } },
        data: { updatedAt: new Date() },
      });
      if (claim.count !== 1) return;
      try { await reconcileAsaasTransferFromPlatform({ transferId: item.asaasTransferId, externalReference: item.paymentReference }); }
      catch { /* preserve pending state; the next poll or webhook retries */ }
    }));

    const [pendingWithdrawals, historicalWithdrawals] = await Promise.all([
      authPrisma.withdrawal.findMany({ where: { status: { in: ["PENDING", "FAILED"] } }, include, orderBy: { createdAt: "asc" } }),
      authPrisma.withdrawal.findMany({ where: { status: { in: ["APPROVED", "PROCESSING", "PAID", "REJECTED"] } }, include, orderBy: { createdAt: "desc" }, take: 200 }),
    ]);
    const withdrawals = [...pendingWithdrawals, ...historicalWithdrawals];
    let keyConfigError = false;
    const items = withdrawals.map(item => {
      let pixKey: string | null = null;
      let holderName: string | null = null;
      if (["PENDING", "APPROVED", "PROCESSING"].includes(item.status) || (item.status === "FAILED" && !item.asaasTransferId)) {
        try {
          pixKey = decryptPixKey(item.pixKeyEncrypted);
          holderName = item.holderNameEncrypted ? decryptPixKey(item.holderNameEncrypted) : null;
        } catch { keyConfigError = true; }
      }
      let pixKeyMasked = item.pixKeyMasked ?? "Chave indisponível";
      if (!item.pixKeyMasked) { try { pixKeyMasked = maskPixKey(decryptPixKey(item.pixKeyEncrypted)); } catch { /* keep fallback */ } }
      return {
        id: item.id, username: item.user.username, amountCents: item.amountCents, status: item.status,
        asaasTransferId: item.asaasTransferId, asaasTransferStatus: item.asaasTransferStatus,
        asaasTransferFailureReason: item.asaasTransferFailureReason, holderCpfMasked: item.holderCpfMasked, holderName,
        pixKey, pixKeyMasked, providerRef: item.providerRef, createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(), reviewedBy: item.reviewedBy?.username ?? null,
        statusHistory: item.statusHistory.map(event => ({ fromStatus: event.fromStatus, toStatus: event.toStatus,
          note: event.note, createdAt: event.createdAt.toISOString(), actor: event.actor?.username ?? "Sistema" })),
      };
    });
    if (keyConfigError && withdrawals.some(item => ["PENDING", "APPROVED", "PROCESSING"].includes(item.status) || (item.status === "FAILED" && !item.asaasTransferId))) {
      return NextResponse.json({ error: "Configure WALLET_PIX_ENCRYPTION_KEY para abrir as chaves Pix pendentes. Os saques continuam preservados." }, { status: 503, headers });
    }
    return NextResponse.json({ items }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar os saques." }, { status: 500, headers });
  }
}

const actionSchema = z.object({
  withdrawalId: z.string().min(1).max(128),
  action: z.literal("reject"),
  note: z.string().trim().min(4).max(500),
}).strict();

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400, headers }); }
  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Informe a solicitação e uma observação de auditoria válida." }, { status: 400, headers });
  try {
    const result = await authPrisma.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "Withdrawal" WHERE "id" = $1 FOR UPDATE', parsed.data.withdrawalId);
      if (!rows.length) throw new Error("NOT_FOUND");
      const withdrawal = await tx.withdrawal.findUnique({ where: { id: parsed.data.withdrawalId }, include: { user: { select: { username: true } } } });
      if (!withdrawal) throw new Error("NOT_FOUND");
      if (!["PENDING", "FAILED"].includes(withdrawal.status) || (withdrawal.asaasTransferId && withdrawal.status !== "FAILED")) throw new Error("INVALID_STATE");
      await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: "REJECTED", reviewedById: auth.user.id } });
      await tx.ledgerEntry.create({ data: {
        userId: withdrawal.userId, withdrawalId: withdrawal.id, type: "WITHDRAWAL_RELEASE",
        amountCents: withdrawal.amountCents, currency: "BRL", idempotencyKey: "withdrawal-release:" + withdrawal.id,
        description: "Liberação de valor reservado após decisão administrativa do saque " + withdrawal.id,
      } });
      await tx.withdrawalStatusHistory.create({ data: { withdrawalId: withdrawal.id, fromStatus: withdrawal.status,
        toStatus: "REJECTED", actorId: auth.user.id, note: parsed.data.note.trim() } });
      await tx.auditEvent.create({ data: { actorId: auth.user.id, action: "WITHDRAWAL_VALUE_RELEASED",
        entityType: "Withdrawal", entityId: withdrawal.id,
        metadata: { userId: withdrawal.userId, username: withdrawal.user.username, amountCents: withdrawal.amountCents,
          note: parsed.data.note.trim(), releasedCents: withdrawal.amountCents } } });
      return { id: withdrawal.id, status: "REJECTED", username: withdrawal.user.username, amountCents: withdrawal.amountCents };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ success: true, withdrawal: result }, { headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "O saque foi atualizado simultaneamente. Atualize a lista." }, { status: 409, headers });
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Solicitação de saque não encontrada." }, { status: 404, headers });
    if (code === "INVALID_STATE") return NextResponse.json({ error: "Este saque não pode ser liberado porque já possui transferência ativa ou foi encerrado." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível concluir a operação do saque." }, { status: 500, headers });
  }
}
