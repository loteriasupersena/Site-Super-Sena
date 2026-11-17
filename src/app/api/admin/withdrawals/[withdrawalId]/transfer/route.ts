import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { decryptPixKey } from "@/lib/wallet/pix-key-crypto";
import { createAsaasPixTransfer } from "@/modules/payments/asaas";

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
        id: true, status: true, amountCents: true, pixKeyEncrypted: true, pixKeyType: true,
        asaasTransferId: true, paymentReference: true, userId: true,
      } });
      if (!item) throw new Error("NOT_FOUND");
      if (item.amountCents < 100000 || !["PENDING", "FAILED"].includes(item.status) || item.asaasTransferId) throw new Error("INVALID_STATE");
      if (!item.pixKeyEncrypted || !item.pixKeyType) throw new Error("BENEFICIARY_DATA_MISSING");
      const externalReference = "wallet_withdrawal_" + item.id;
      const changed = await tx.withdrawal.updateMany({ where: { id: item.id, status: item.status, asaasTransferId: null }, data: {
        status: "PROCESSING", reviewedById: admin.id, paymentReference: externalReference,
        transferRequestedAt: new Date(), asaasTransferStatus: "CREATING", asaasTransferFailureReason: null,
      } });
      if (changed.count !== 1) throw new Error("INVALID_STATE");
      await tx.withdrawalStatusHistory.create({ data: { withdrawalId: item.id, fromStatus: item.status, toStatus: "PROCESSING", actorId: admin.id, note: "Administrador autorizou a transferência Pix pela Asaas." } });
      await tx.auditEvent.create({ data: { actorId: admin.id, action: "WITHDRAWAL_ASAAS_TRANSFER_REQUESTED", entityType: "Withdrawal", entityId: item.id, metadata: { amountCents: item.amountCents, externalReference } } });
      return { id: item.id, amountCents: item.amountCents, pixKey: decryptPixKey(item.pixKeyEncrypted), pixKeyType: item.pixKeyType, externalReference };
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
    const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
    if (status >= 400 && status < 500) {
      await authPrisma.withdrawal.updateMany({ where: { id: transferData.id, status: "PROCESSING", asaasTransferId: null },
        data: { status: "FAILED", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas recusou a transferência. Revise os dados Pix." } });
      await authPrisma.withdrawalStatusHistory.create({ data: { withdrawalId: transferData.id, fromStatus: "PROCESSING", toStatus: "FAILED", actorId: admin.id, note: "A Asaas recusou a transferência; o saldo permanece reservado." } });
      return NextResponse.json({ error: "A Asaas recusou a transferência. O saldo permanece reservado." }, { status: 502, headers });
    }
    return NextResponse.json({ success: true, status: "PROCESSING", message: "Resultado inconclusivo. O saque está bloqueado contra duplicidade e aguarda conciliação." }, { status: 202, headers });
  }
}
