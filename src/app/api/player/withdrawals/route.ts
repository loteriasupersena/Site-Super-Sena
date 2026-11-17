import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { isPlausiblePixKey, maskPixKey } from "@/lib/wallet/pix-key";
import { createAsaasPixTransfer } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
const LIMIT_CENTS = 100000;

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length: number) => {
    const sum = cpf.slice(0, length).split("").reduce((total, n, i) => total + Number(n) * (length + 1 - i), 0);
    const result = (sum * 10) % 11;
    return result === 10 ? 0 : result;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}
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
  if (typeof body.pixKey !== "string" || typeof body.pixKeyConfirmation !== "string" ||
      typeof body.holderName !== "string" || typeof body.holderCpf !== "string" ||
      typeof body.pixKeyType !== "string" || body.pixKeyConfirmed !== true || body.holderConfirmed !== true) return null;
  const pixKey = body.pixKey.trim();
  const holderName = body.holderName.trim().replace(/\s+/g, " ");
  const holderCpf = body.holderCpf.replace(/\D/g, "");
  if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(body.pixKeyType) ||
      holderName.length < 5 || holderName.length > 160 || !validCpf(holderCpf) ||
      pixKey.length < 3 || pixKey.length > 200 || pixKey !== body.pixKeyConfirmation.trim() ||
      !isPlausiblePixKey(pixKey) || (body.pixKeyType === "CPF" && pixKey.replace(/\D/g, "") !== holderCpf)) return null;
  return { pixKey, pixKeyType: body.pixKeyType, holderName, holderCpf };
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "PLAYER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  try {
    const [ledger, withdrawals, reserved] = await Promise.all([
      authPrisma.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } }),
      authPrisma.withdrawal.findMany({
        where: { userId: user.id },
        select: { id: true, amountCents: true, status: true, providerRef: true, asaasTransferStatus: true, asaasTransferFailureReason: true, holderCpfMasked: true, pixKeyMasked: true, createdAt: true, updatedAt: true, statusHistory: { select: { toStatus: true, note: true, createdAt: true }, orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" }, take: 100,
      }),
      authPrisma.withdrawal.aggregate({
        where: { userId: user.id, status: { in: ["PENDING", "APPROVED", "PROCESSING", "FAILED"] } },
        _sum: { amountCents: true },
      }),
    ]);
    return NextResponse.json({
      availableCents: ledger._sum.amountCents ?? 0,
      reservedCents: reserved._sum.amountCents ?? 0,
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
  if (!input) return NextResponse.json({ error: "Informe nome completo, CPF válido, tipo de chave Pix e confirme a chave Pix." }, { status: 400, headers });

  try {
    const result = await authPrisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR UPDATE', user.id);
      const ledger = await tx.ledgerEntry.aggregate({ where: { userId: user.id }, _sum: { amountCents: true } });
      const available = ledger._sum.amountCents ?? 0;
      if (available <= 0) throw new Error("INSUFFICIENT_BALANCE");
      const amountCents = available;
      const admin = amountCents < LIMIT_CENTS ? await tx.user.findFirst({
        where: { role: "ADMIN", status: "ACTIVE", mustChangePassword: false },
        select: { id: true }, orderBy: { createdAt: "asc" },
      }) : null;
      if (amountCents < LIMIT_CENTS && !admin) throw new Error("AUTOMATIC_PAYOUT_ADMIN_MISSING");
      const id = "wdr_" + randomUUID().replace(/-/g, "");
      const externalReference = "wallet_withdrawal_" + id;
      const automatic = amountCents < LIMIT_CENTS;
      const withdrawal = await tx.withdrawal.create({ data: {
        id, userId: user.id, amountCents, pixKey: input.pixKey, pixKeyType: input.pixKeyType,
        holderName: input.holderName, holderCpfMasked: "***.***.***-" + input.holderCpf.slice(-2),
        pixKeyMasked: maskPixKey(input.pixKey), paymentReference: automatic ? externalReference : null,
        status: automatic ? "PROCESSING" : "PENDING", reviewedById: admin?.id ?? null,
        idempotencyKey: "withdrawal:" + randomUUID(),
        ...(automatic ? { transferRequestedAt: new Date(), asaasTransferStatus: "CREATING" } : {}),
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
        metadata: { amountCents, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType, holderCpfMasked: withdrawal.holderCpfMasked, status: withdrawal.status, automatic },
      } });
      return { id: withdrawal.id, amountCents, status: withdrawal.status, automatic, externalReference, availableCents: 0 };
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
        const status = typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 0;
        if (status >= 400 && status < 500) {
          await authPrisma.withdrawal.updateMany({ where: { id: result.id, status: "PROCESSING", asaasTransferId: null },
            data: { status: "FAILED", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas recusou a transferência. Revise os dados e solicite suporte." } });
          await authPrisma.withdrawalStatusHistory.create({ data: { withdrawalId: result.id, fromStatus: "PROCESSING", toStatus: "FAILED", note: "A Asaas recusou a transferência; o valor permanece reservado até análise e liberação." } });
          return NextResponse.json({ error: "A Asaas recusou a transferência. O valor permanece reservado para evitar perda de saldo; procure o suporte." }, { status: 502, headers });
        }
        return NextResponse.json({ success: true, status: "PROCESSING", message: "A resposta da Asaas está inconclusiva. O saque foi bloqueado contra duplicidade e aguarda conciliação." }, { status: 202, headers });
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
