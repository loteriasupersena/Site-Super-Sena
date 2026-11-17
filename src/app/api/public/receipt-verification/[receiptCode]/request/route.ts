import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";
import { encryptPixKey, isPlausiblePixKey, maskPixKey } from "@/lib/wallet/pix-key-crypto";
import { getNumericPrizeReview } from "@/domain/numeric-prize-review";
import { createAsaasPixTransfer } from "@/modules/payments/asaas";
import { calculatePrizeFeeBatch, PRIZE_FEE_THRESHOLD_CENTS } from "@/domain/prize-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

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
function parsePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.participationLineId !== "string" || !body.participationLineId ||
      typeof body.pixKey !== "string" || typeof body.pixKeyConfirmation !== "string" ||
      typeof body.holderName !== "string" || typeof body.holderCpf !== "string" ||
      typeof body.pixKeyType !== "string" || body.pixKeyConfirmed !== true || body.holderConfirmed !== true) return null;
  const pixKey = body.pixKey.trim();
  const holderName = body.holderName.trim().replace(/\s+/g, " ");
  const holderCpf = body.holderCpf.replace(/\D/g, "");
  if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(body.pixKeyType) ||
      holderName.length < 5 || holderName.length > 160 || !validCpf(holderCpf) ||
      pixKey.length < 3 || pixKey.length > 200 || pixKey !== body.pixKeyConfirmation.trim() ||
      !isPlausiblePixKey(pixKey) || (body.pixKeyType === "CPF" && pixKey.replace(/\D/g, "") !== holderCpf)) return null;
  return { participationLineId: body.participationLineId, pixKey, pixKeyType: body.pixKeyType, holderName, holderCpf };
}
function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return ["https:", "http:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host; }
  catch { return false; }
}

export async function POST(request: NextRequest, context: { params: Promise<{ receiptCode: string }> }) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const { receiptCode: raw } = await context.params;
  const receiptCode = raw.replace(/\s/g, "").toUpperCase();
  if (!/^SQ-[A-Z0-9]{8,32}$/.test(receiptCode)) return NextResponse.json({ error: "Código de recibo inválido." }, { status: 400, headers });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const input = parsePayload(body);
  if (!input) return NextResponse.json({ error: "Informe os dados válidos do titular e confirme a chave Pix." }, { status: 400, headers });

  try {
    const batch = await authPrisma.$transaction(async tx => {
      const purchase = await tx.purchase.findUnique({ where: { receiptCode }, select: {
        id: true, status: true, paymentMethod: true, confirmedAt: true, cashierId: true, playerId: true,
        payment: { select: { status: true, confirmedAt: true } },
      } });
      if (!purchase || !purchase.cashierId || purchase.playerId !== null) throw new Error("PHYSICAL_RECEIPT_ONLY");
      const confirmed = purchase.status === "CONFIRMED" && !!purchase.confirmedAt &&
        (purchase.paymentMethod === "CASH" || purchase.paymentMethod === "WALLET" ||
          (purchase.payment?.status === "CONFIRMED" && !!purchase.payment.confirmedAt));
      if (!confirmed) throw new Error("PAYMENT_NOT_CONFIRMED");

      const selected = await tx.numericParticipationLine.findFirst({ where: {
        id: input.participationLineId,
        participation: { purchaseId: purchase.id, status: "CONFIRMED", round: { status: "COMPLETED", resultNumber: { not: null } } },
      }, select: { id: true } });
      if (!selected) throw new Error("PRIZE_NOT_FOUND");

      const openBatch = await tx.prizePaymentBatch.findFirst({ where: {
        purchaseId: purchase.id, status: { in: ["PENDING", "PROCESSING"] },
      }, select: { id: true } });
      if (openBatch) throw new Error("BATCH_ALREADY_EXISTS");

      const candidates = await tx.numericParticipationLine.findMany({ where: {
        participation: { purchaseId: purchase.id, status: "CONFIRMED", round: { status: "COMPLETED", resultNumber: { not: null } } },
        prizeCents: { gt: 0 }, prizeCreditedAt: null, prizePayout: null,
      }, select: {
        id: true, numberValue: true, prizeCents: true, prizeCreditedAt: true,
        unitCents: true, tensCents: true, hundredsCents: true, milharCents: true, quinaCents: true, senaCents: true,
        ruleVersion: true, ruleSnapshot: true,
        participation: { select: { round: { select: { resultNumber: true } } } },
        prizePaymentRequest: { select: { id: true, status: true, batchId: true } },
      }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      if (!candidates.length || !candidates.some(line => line.id === selected.id)) throw new Error("PRIZE_NOT_AVAILABLE");
      if (candidates.some(line => line.prizePaymentRequest &&
        (line.prizePaymentRequest.status !== "REJECTED" || line.prizePaymentRequest.batchId))) throw new Error("REQUEST_ALREADY_EXISTS");

      const feeLines = candidates.map(line => {
        const grossCents = line.prizeCents ?? 0;
        const review = getNumericPrizeReview({
          numberValue: line.numberValue, unitCents: line.unitCents, tensCents: line.tensCents,
          hundredsCents: line.hundredsCents, milharCents: line.milharCents,
          quinaCents: line.quinaCents, senaCents: line.senaCents,
          ruleVersion: line.ruleVersion, ruleSnapshot: line.ruleSnapshot,
        }, line.participation.round.resultNumber);
        if (grossCents <= 0 || line.prizeCreditedAt || !review?.calculationConsistent ||
            review.calculatedPrizeCents !== grossCents) throw new Error("PRIZE_CALCULATION_MISMATCH");
        return { id: line.id, grossCents, oldRequestId: line.prizePaymentRequest?.id ?? null };
      });
      const fees = calculatePrizeFeeBatch(feeLines);
      const automatic = fees.grossCents < PRIZE_FEE_THRESHOLD_CENTS;
      const admin = automatic ? await tx.user.findFirst({
        where: { role: "ADMIN", status: "ACTIVE", mustChangePassword: false },
        select: { id: true }, orderBy: { createdAt: "asc" },
      }) : null;
      if (automatic && !admin) throw new Error("AUTOMATIC_PAYOUT_ADMIN_MISSING");

      const batchId = "ppb_" + randomUUID().replace(/-/g, "");
      const externalReference = "prize_batch_" + batchId;
      const now = new Date();
      const allocations = new Map(fees.allocations.map(item => [item.id, item]));
      await tx.prizePaymentBatch.create({ data: {
        id: batchId, purchaseId: purchase.id,
        pixKeyEncrypted: encryptPixKey(input.pixKey), pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType,
        holderNameEncrypted: encryptPixKey(input.holderName), holderCpfEncrypted: encryptPixKey(input.holderCpf),
        holderCpfMasked: "***.***.***-" + input.holderCpf.slice(-2),
        grossCents: fees.grossCents, administrativeFeeCents: fees.administrativeFeeCents,
        transactionFeeCents: fees.transactionFeeCents, netCents: fees.netCents,
        feeRuleVersion: "physical-prize-fees-v2", status: automatic ? "PROCESSING" : "PENDING",
        requestedAt: now, reviewedAt: automatic ? now : null, reviewerId: admin?.id ?? null,
        paymentReference: automatic ? externalReference : null,
        transferRequestedAt: automatic ? now : null,
        items: { create: feeLines.map(line => ({ participationLineId: line.id, amountCents: line.grossCents })) },
      } });
      for (const line of feeLines) {
        const allocation = allocations.get(line.id)!;
        const requestData = {
          purchaseId: purchase.id, batchId,
          pixKey: null, pixKeyEncrypted: null, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType,
          holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null,
          holderCpfMasked: "***.***.***-" + input.holderCpf.slice(-2),
          grossCents: allocation.grossCents, administrativeFeeCents: allocation.administrativeFeeCents,
          transactionFeeCents: allocation.transactionFeeCents, netCents: allocation.netCents,
          feeRuleVersion: "physical-prize-fees-v2", status: automatic ? "PROCESSING" as const : "PENDING" as const,
          requestedAt: now, reviewedAt: automatic ? now : null, reviewerId: admin?.id ?? null,
          paymentReference: automatic ? externalReference : null,
          transferRequestedAt: automatic ? now : null,
        };
        if (line.oldRequestId) {
          await tx.prizePaymentRequest.update({ where: { id: line.oldRequestId }, data: requestData });
        } else {
          await tx.prizePaymentRequest.create({ data: {
            ...requestData, id: "ppr_" + randomUUID().replace(/-/g, ""),
            participationLineId: line.id,
          } });
        }
      }
      await tx.auditEvent.create({ data: {
        action: "PRIZE_PIX_BATCH_REQUESTED", entityType: "PrizePaymentBatch", entityId: batchId,
        metadata: { receiptCode, lineCount: feeLines.length, grossCents: fees.grossCents,
          administrativeFeeCents: fees.administrativeFeeCents, transactionFeeCents: fees.transactionFeeCents,
          netCents: fees.netCents, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType,
          holderCpfMasked: "***.***.***-" + input.holderCpf.slice(-2) },
      } });
      return { id: batchId, externalReference, grossCents: fees.grossCents,
        administrativeFeeCents: fees.administrativeFeeCents, transactionFeeCents: fees.transactionFeeCents,
        netCents: fees.netCents, lineCount: feeLines.length, automatic,
        pixKey: input.pixKey, pixKeyType: input.pixKeyType };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (batch.automatic) {
      try {
        const transfer = await createAsaasPixTransfer({
          amountCents: batch.netCents, pixKey: batch.pixKey,
          pixKeyType: batch.pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
          externalReference: batch.externalReference,
        });
        await authPrisma.$transaction(async tx => {
          await tx.prizePaymentBatch.updateMany({ where: { id: batch.id, status: "PROCESSING", paymentReference: batch.externalReference },
            data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING", transferRequestedAt: new Date() } });
          await tx.prizePaymentRequest.updateMany({ where: { batchId: batch.id, status: "PROCESSING" },
            data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING", transferRequestedAt: new Date() } });
        });
        return NextResponse.json({ success: true, batch: {
          id: batch.id, grossCents: batch.grossCents, administrativeFeeCents: batch.administrativeFeeCents,
          transactionFeeCents: batch.transactionFeeCents, netCents: batch.netCents, lineCount: batch.lineCount,
        }, status: "PROCESSING", message: "Solicitação agrupada aceita. Um único Pix foi enviado à Asaas e aguarda confirmação bancária." }, { status: 202, headers });
      } catch (transferError) {
        const status = typeof transferError === "object" && transferError !== null && "status" in transferError ? Number(transferError.status) : 0;
        if (status >= 400 && status < 500) {
          await authPrisma.$transaction(async tx => {
            await tx.prizePaymentBatch.updateMany({ where: { id: batch.id, status: "PROCESSING", asaasTransferId: null },
              data: { status: "FAILED", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas recusou a transferência. Revise a chave Pix e a configuração." } });
            await tx.prizePaymentRequest.updateMany({ where: { batchId: batch.id, status: "PROCESSING" },
              data: { status: "FAILED", asaasTransferStatus: "REJECTED", asaasTransferFailureReason: "A Asaas recusou a transferência. Revise a chave Pix e a configuração." } });
          }).catch(() => undefined);
          return NextResponse.json({ error: "A Asaas recusou a transferência. Nenhum pagamento foi confirmado; revise os dados Pix." }, { status: 502, headers });
        }
        return NextResponse.json({ success: true, status: "PROCESSING",
          message: "Solicitação agrupada registrada. A confirmação do envio está inconclusiva; nova tentativa foi bloqueada para evitar Pix duplicado." }, { status: 202, headers });
      }
    }
    return NextResponse.json({ success: true, batch: {
      id: batch.id, grossCents: batch.grossCents, administrativeFeeCents: batch.administrativeFeeCents,
      transactionFeeCents: batch.transactionFeeCents, netCents: batch.netCents, lineCount: batch.lineCount,
    }, status: "PENDING", message: "Solicitação recebida. O total do recibo é de R$ 1.000,00 ou mais e aguarda análise da administração." }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
      return NextResponse.json({ error: "Este recibo foi atualizado simultaneamente ou já possui uma solicitação. Atualize o recibo e tente novamente." }, { status: 409, headers });
    }
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, [string, number]> = {
      PHYSICAL_RECEIPT_ONLY: ["Solicitações Pix por recibo estão disponíveis somente para vendas físicas.", 403],
      PAYMENT_NOT_CONFIRMED: ["O pagamento deste recibo ainda não está confirmado.", 409],
      PRIZE_NOT_FOUND: ["O prêmio informado não pertence a este recibo.", 404],
      PRIZE_NOT_AVAILABLE: ["Não há prêmios elegíveis para pagamento neste recibo.", 409],
      PRIZE_CALCULATION_MISMATCH: ["Um dos valores premiados diverge do recálculo oficial. O lote inteiro foi bloqueado para conferência.", 409],
      AUTOMATIC_PAYOUT_ADMIN_MISSING: ["Não foi possível identificar o responsável interno para registrar a transferência automática.", 503],
      REQUEST_ALREADY_EXISTS: ["Este recibo já possui uma solicitação em análise ou pagamento registrado.", 409],
      BATCH_ALREADY_EXISTS: ["Este recibo já possui uma solicitação em análise ou pagamento registrado. Consulte o andamento no próprio recibo.", 409],
    };
    const mapped = messages[code];
    return NextResponse.json({ error: mapped?.[0] ?? "Não foi possível enviar a solicitação Pix." }, { status: mapped?.[1] ?? 500, headers });
  }
}
