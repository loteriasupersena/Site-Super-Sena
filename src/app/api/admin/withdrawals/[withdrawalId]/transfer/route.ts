import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { createAsaasPixTransfer, findAsaasTransfersByExternalReference } from "@/modules/payments/asaas";
import { reconcileAsaasTransferFromPlatform } from "@/modules/payments/reconcile-asaas-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function POST(request: NextRequest, context: { params: Promise<{ withdrawalId: string }> }) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  try { const parsed = new URL(origin); if (!["https:", "http:"].includes(parsed.protocol) || parsed.host.toLowerCase() !== host) throw new Error(); }
  catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers }); }
  const admin = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!admin) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (admin.role !== "ADMIN" || admin.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  const { withdrawalId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(withdrawalId)) return NextResponse.json({ error: "Saque não encontrado." }, { status: 404, headers });

  let transferData;
  try {
    transferData = await authPrisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Withdrawal" WHERE "id" = ${withdrawalId} FOR UPDATE`;
      const item = await tx.withdrawal.findUnique({ where: { id: withdrawalId }, select: {
        id: true, status: true, amountCents: true, pixKey: true, pixKeyType: true,
        asaasTransferId: true, paymentReference: true, userId: true,
      } });
      if (!item) throw new Error("NOT_FOUND");
      if (item.amountCents < 100000 || !["PENDING", "FAILED"].includes(item.status) || item.asaasTransferId) throw new Error("INVALID_STATE");
      if (!item.pixKey || !item.pixKeyType) throw new Error("BENEFICIARY_DATA_MISSING");
      const externalReference = "wallet_withdrawal_" + item.id;
      const transferRequestedAt = new Date();
      const changed = await tx.withdrawal.updateMany({ where: { id: item.id, status: item.status, asaasTransferId: null }, data: {
        status: "PROCESSING", reviewedById: admin.id, paymentReference: externalReference,
        transferRequestedAt, asaasTransferStatus: "CREATING", asaasTransferFailureReason: null,
      } });
      if (changed.count !== 1) throw new Error("INVALID_STATE");
      await tx.withdrawalStatusHistory.create({ data: { withdrawalId: item.id, fromStatus: item.status, toStatus: "PROCESSING", actorId: admin.id, note: "Administrador autorizou a transferência Pix pela Asaas." } });
      await tx.auditEvent.create({ data: { actorId: admin.id, action: "WITHDRAWAL_ASAAS_TRANSFER_REQUESTED", entityType: "Withdrawal", entityId: item.id, metadata: { amountCents: item.amountCents, externalReference } } });
      return { id: item.id, amountCents: item.amountCents, pixKey: item.pixKey, pixKeyType: item.pixKeyType, externalReference, transferRequestedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Saque não encontrado." }, { status: 404, headers });
    if (code === "INVALID_STATE") return NextResponse.json({ error: "Este saque não está disponível para envio ou já possui uma transferência iniciada." }, { status: 409, headers });
    if (code === "BENEFICIARY_DATA_MISSING") return NextResponse.json({ error: "Dados Pix completos indisponíveis." }, { status: 409, headers });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "O saque foi atualizado simultaneamente. Atualize a lista." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível reservar o saque para transferência." }, { status: 500, headers });
  }

  try {
    const transfer = await createAsaasPixTransfer({ amountCents: transferData.amountCents, pixKey: transferData.pixKey,
      pixKeyType: transferData.pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP", externalReference: transferData.externalReference });
    await authPrisma.withdrawal.updateMany({ where: { id: transferData.id, status: "PROCESSING", paymentReference: transferData.externalReference },
      data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING" } });
    return NextResponse.json({ success: true, status: "PROCESSING", message: "Transferência enviada à Asaas. O saque será concluído somente após o webhook." }, { status: 202, headers });
  } catch (error) {
    // A failed POST can still have created a transfer at the provider.
    // Recover only from one exact externalReference match; ambiguous/unavailable
    // lookups keep the reservation in PROCESSING and block another Pix.
    try {
      const matches = await findAsaasTransfersByExternalReference({
        externalReference: transferData.externalReference,
        requestedAt: transferData.transferRequestedAt,
      });
      if (matches.length === 1 && matches[0]?.id) {
        const transferId = matches[0].id;
        const linked = await authPrisma.withdrawal.updateMany({
          where: { id: transferData.id, status: "PROCESSING", paymentReference: transferData.externalReference, asaasTransferId: null },
          data: { asaasTransferId: transferId, asaasTransferStatus: matches[0].status ?? "PENDING" },
        });
        if (linked.count !== 1) {
          return NextResponse.json({
            success: true, status: "PROCESSING",
            message: "A transferência foi localizada, mas não foi possível vinculá-la com segurança. O saldo permanece reservado para conciliação.",
          }, { status: 202, headers });
        }
        const outcome = await reconcileAsaasTransferFromPlatform({
          transferId,
          externalReference: transferData.externalReference,
        });
        return NextResponse.json({
          success: true, status: outcome === "WITHDRAWAL_FAILED" ? "FAILED" : "PROCESSING",
          message: outcome === "WITHDRAWAL_FAILED"
            ? "A Asaas confirmou que a transferência falhou; o saldo foi devolvido à carteira."
            : "A transferência foi localizada e está em conciliação. O saldo permanece reservado até confirmação.",
        }, { status: 202, headers });
      }
    } catch {
      // Never release funds when provider reconciliation cannot be completed.
    }
    return NextResponse.json({
      success: true, status: "PROCESSING",
      message: "Não foi possível confirmar se a Asaas criou a transferência. O saldo permanece reservado e o saque bloqueado contra duplicidade para conciliação.",
    }, { status: 202, headers });
  }
}
