import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { isPlausiblePixKey, maskPixKey } from "@/lib/wallet/pix-key";
import { createAsaasPixTransfer, findAsaasTransfersByExternalReference } from "@/modules/payments/asaas";
import { reconcileAsaasTransferFromPlatform } from "@/modules/payments/reconcile-asaas-transfer";
import { WALLET_WITHDRAWAL_ADMIN_APPROVAL_THRESHOLD_CENTS } from "@/domain/payout-threshold";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return ["https:", "http:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host; }
  catch { return false; }
}
function parseInput(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.pixKey !== "string" ||
      typeof body.pixKeyConfirmation !== "string" ||
      typeof body.pixKeyType !== "string") return null;
  const pixKey = body.pixKey.trim();
  if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(body.pixKeyType) ||
      pixKey.length < 3 || pixKey.length > 200 ||
      pixKey !== body.pixKeyConfirmation.trim() ||
      !isPlausiblePixKey(pixKey)) return null;
  return { pixKey, pixKeyType: body.pixKeyType };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "PLAYER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  try {
    const [ledger, withdrawals] = await Promise.all([
      authPrisma.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } }),
      authPrisma.withdrawal.findMany({
        where: { userId: user.id },
        select: { id: true, amountCents: true, status: true, providerRef: true, asaasTransferStatus: true, asaasTransferFailureReason: true, pixKeyMasked: true, createdAt: true, updatedAt: true, statusHistory: { select: { toStatus: true, note: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
    ]);
    return NextResponse.json({
      availableCents: ledger._sum.amountCents ?? 0,
      withdrawals: withdrawals.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString(), statusHistory: item.statusHistory.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })) })),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a carteira." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "PLAYER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const input = parseInput(payload);
  if (!input) return NextResponse.json({ error: "Informe o tipo da chave Pix, a chave e confirme a chave." }, { status: 400, headers });

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE', user.id);
      const ledger = await tx.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } });
      const available = ledger._sum.amountCents ?? 0;
      if (available <= 0) throw new Error("INSUFFICIENT_BALANCE");
      const amountCents = available;
      const admin = amountCents < WALLET_WITHDRAWAL_ADMIN_APPROVAL_THRESHOLD_CENTS ? await tx.user.findFirst({
        where: { role: "ADMIN", status: "ACTIVE", mustChangePassword: false },
        select: { id: true }, orderBy: { createdAt: "asc" },
      }) : null;
      if (amountCents < WALLET_WITHDRAWAL_ADMIN_APPROVAL_THRESHOLD_CENTS && !admin) throw new Error("AUTOMATIC_PAYOUT_ADMIN_MISSING");
      const id = "wdr_" + randomUUID().replace(/-/g, "");
      const externalReference = "wallet_withdrawal_" + id;
      const automatic = amountCents < WALLET_WITHDRAWAL_ADMIN_APPROVAL_THRESHOLD_CENTS;
      const transferRequestedAt = automatic ? new Date() : null;
      const withdrawal = await tx.withdrawal.create({ data: {
        id, userId: user.id, amountCents, pixKey: input.pixKey, pixKeyType: input.pixKeyType,
        pixKeyMasked: maskPixKey(input.pixKey), paymentReference: automatic ? externalReference : null,
        status: automatic ? "PROCESSING" : "PENDING", reviewedById: admin?.id ?? null,
        idempotencyKey: "withdrawal:" + randomUUID(),
        ...(automatic ? { transferRequestedAt, asaasTransferStatus: "CREATING" } : {}),
      } });
      await tx.ledgerEntry.create({ data: {
        userId: user.id, withdrawalId: withdrawal.id, type: "WITHDRAWAL_RESERVE",
        amountCents: -amountCents, currency: "BRL",
        idempotencyKey: "withdrawal-reserve:" + withdrawal.id,
        description: "Reserva de saldo para solicitação de saque " + withdrawal.id,
      } });
      await tx.withdrawalStatusHistory.create({ data: {
        withdrawalId: withdrawal.id, fromStatus: null, toStatus: automatic ? "PROCESSING" : "PENDING",
        actorId: user.id, note: automatic ? "Saque abaixo de R$ 1.000,00 enviado automaticamente à Asaas; aguardando confirmação bancária." : "Saque de R$ 1.000,00 ou mais aguardando aprovação administrativa.",
      } });
      await tx.auditEvent.create({ data: {
        actorId: user.id, action: "WITHDRAWAL_REQUESTED", entityType: "Withdrawal", entityId: withdrawal.id,
        metadata: { amountCents, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType, status: withdrawal.status, automatic },
      } });
      return { id: withdrawal.id, amountCents, status: withdrawal.status, automatic, externalReference, transferRequestedAt, availableCents: 0 };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (result.automatic) {
      try {
        const transfer = await createAsaasPixTransfer({
          amountCents: result.amountCents, pixKey: input.pixKey,
          pixKeyType: input.pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
          externalReference: result.externalReference,
        });
        await authPrisma.withdrawal.updateMany({
          where: { id: result.id, status: "PROCESSING", paymentReference: result.externalReference },
          data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING" },
        });
        return NextResponse.json({ success: true, withdrawal: { id: result.id, amountCents: result.amountCents, status: "PROCESSING", availableCents: 0 }, message: "Transferência enviada à Asaas. O saque só será marcado como pago após a confirmação do webhook." }, { status: 202, headers });
      } catch (error) {
        // A POST failure is not proof that Asaas did not create the transfer.
        // Search by the exact idempotent reference before changing the reserved balance.
        try {
          const matches = await findAsaasTransfersByExternalReference({
            externalReference: result.externalReference,
            requestedAt: result.transferRequestedAt ?? new Date(),
          });
          if (matches.length === 1 && matches[0]?.id) {
            const transferId = matches[0].id;
            const linked = await authPrisma.withdrawal.updateMany({
              where: { id: result.id, status: "PROCESSING", paymentReference: result.externalReference, asaasTransferId: null },
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
              externalReference: result.externalReference,
            });
            return NextResponse.json({
              success: true, status: outcome === "WITHDRAWAL_FAILED" ? "FAILED" : "PROCESSING",
              message: outcome === "WITHDRAWAL_FAILED"
                ? "A Asaas confirmou que a transferência falhou; o saldo foi devolvido à carteira."
                : "A transferência foi localizada e está em conciliação. O saldo permanece reservado até confirmação.",
            }, { status: 202, headers });
          }
        } catch {
          // An unavailable or incomplete lookup must never release the reservation.
        }
        return NextResponse.json({
          success: true, status: "PROCESSING",
          message: "Não foi possível confirmar se a Asaas criou a transferência. O saldo permanece reservado e o saque bloqueado contra duplicidade para conciliação.",
        }, { status: 202, headers });
      }
    }
    return NextResponse.json({ success: true, withdrawal: { id: result.id, amountCents: result.amountCents, status: "PENDING", availableCents: 0 }, message: "Saque de R$ 1.000,00 ou mais recebido e encaminhado para aprovação administrativa." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "A carteira foi atualizada simultaneamente. Atualize o saldo e tente novamente." }, { status: 409, headers });
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") return NextResponse.json({ error: "Não há saldo disponível para sacar." }, { status: 409, headers });
    if (error instanceof Error && error.message === "AUTOMATIC_PAYOUT_ADMIN_MISSING") return NextResponse.json({ error: "Não foi possível preparar o registro interno do pagamento automático." }, { status: 503, headers });
    return NextResponse.json({ error: "Não foi possível solicitar o saque." }, { status: 500, headers });
  }
}
