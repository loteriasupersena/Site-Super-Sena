import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";
import { isPlausiblePixKey, maskPixKey } from "@/lib/wallet/pix-key";
import { getNumericPrizeReview } from "@/domain/numeric-prize-review";
import { createAsaasPixTransfer, findAsaasTransfersByExternalReference } from "@/modules/payments/asaas";
import { reconcileAsaasTransferFromPlatform } from "@/modules/payments/reconcile-asaas-transfer";
import { calculatePrizeFeeBatch } from "@/domain/prize-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.participationLineId !== "string" || !body.participationLineId ||
      typeof body.pixKey !== "string" || typeof body.pixKeyType !== "string" ||
      body.pixKeyConfirmed !== true) return null;
  const pixKey = body.pixKey.trim();
  if (!["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"].includes(body.pixKeyType) ||
      pixKey.length < 3 || pixKey.length > 200 || !isPlausiblePixKey(pixKey)) return null;
  return { participationLineId: body.participationLineId, pixKey, pixKeyType: body.pixKeyType };
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
  if (!input) return NextResponse.json({ error: "Informe o tipo e uma chave Pix válida." }, { status: 400, headers });

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
      // Every eligible physical-prize request is sent directly to Asaas.
      // The admin area is monitoring-only; no manual payment authorization is required.

      const batchId = "ppb_" + randomUUID().replace(/-/g, "");
      const externalReference = "prize_batch_" + batchId;
      const now = new Date();
      const allocations = new Map(fees.allocations.map(item => [item.id, item]));
      await tx.prizePaymentBatch.create({ data: {
        id: batchId, purchaseId: purchase.id,
        pixKey: input.pixKey, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType,
        holderName: input.holderName,
        holderCpfMasked: "Não informado",
        grossCents: fees.grossCents, administrativeFeeCents: fees.administrativeFeeCents,
        transactionFeeCents: fees.transactionFeeCents, netCents: fees.netCents,
        feeRuleVersion: "physical-prize-fees-v2", status: "PROCESSING",
        requestedAt: now, reviewedAt: null, reviewerId: null,
        paymentReference: externalReference,
        transferRequestedAt: now,
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
          feeRuleVersion: "physical-prize-fees-v2", status: "PROCESSING" as const,
          requestedAt: now, reviewedAt: null, reviewerId: null,
          paymentReference: externalReference,
          transferRequestedAt: now,
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
          
      } });
      return { id: batchId, externalReference, grossCents: fees.grossCents,
        administrativeFeeCents: fees.administrativeFeeCents, transactionFeeCents: fees.transactionFeeCents,
        netCents: fees.netCents, lineCount: feeLines.length,
        pixKey: input.pixKey, pixKeyType: input.pixKeyType, requestedAt: now };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    try {
        const transfer = await createAsaasPixTransfer({
          amountCents: batch.netCents, pixKey: batch.pixKey,
          pixKeyType: batch.pixKeyType as "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP",
          externalReference: batch.externalReference,
        });
        await authPrisma.$transaction(async tx => {
          const batchLink = await tx.prizePaymentBatch.updateMany({
            where: { id: batch.id, status: "PROCESSING", paymentReference: batch.externalReference },
            data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING", transferRequestedAt: new Date() },
          });
          if (batchLink.count !== 1) throw new Error("PRIZE_BATCH_TRANSFER_LINK_FAILED");
          const requestLinks = await tx.prizePaymentRequest.updateMany({
            where: { batchId: batch.id, status: "PROCESSING" },
            data: { asaasTransferId: transfer.id, asaasTransferStatus: transfer.status ?? "PENDING", transferRequestedAt: new Date() },
          });
          if (requestLinks.count !== batch.lineCount) throw new Error("PRIZE_REQUEST_TRANSFER_LINK_FAILED");
        });
        return NextResponse.json({ success: true, batch: {
          id: batch.id, grossCents: batch.grossCents, administrativeFeeCents: batch.administrativeFeeCents,
          transactionFeeCents: batch.transactionFeeCents, netCents: batch.netCents, lineCount: batch.lineCount,
        }, status: "PROCESSING", message: "Solicitação agrupada aceita. Um único Pix foi enviado automaticamente à Asaas e aguarda confirmação bancária." }, { status: 202, headers });
      } catch (transferError) {
        const status = typeof transferError === "object" && transferError !== null && "status" in transferError
          ? Number(transferError.status) : 0;
        // Always reconcile first, including HTTP 4xx responses. Never assume
        // that a failed POST proves no transfer exists at the provider.
        let lookupCompleted = false;
        let matchingTransfers = 0;
        try {
          const matches = await findAsaasTransfersByExternalReference({
            externalReference: batch.externalReference,
            requestedAt: batch.requestedAt,
          });
          lookupCompleted = true;
          matchingTransfers = matches.length;
          if (matches.length === 1 && matches[0]?.id) {
            const recoveredTransferId = matches[0].id;
            const linked = await authPrisma.$transaction(async tx => {
              const result = await tx.prizePaymentBatch.updateMany({
                where: { id: batch.id, status: "PROCESSING", paymentReference: batch.externalReference,
                  OR: [{ asaasTransferId: null }, { asaasTransferId: recoveredTransferId }] },
                data: { asaasTransferId: recoveredTransferId, asaasTransferStatus: matches[0].status ?? "PENDING" },
              });
              if (result.count !== 1) return false;
              const requestLinks = await tx.prizePaymentRequest.updateMany({
                where: { batchId: batch.id, status: "PROCESSING",
                  OR: [{ asaasTransferId: null }, { asaasTransferId: recoveredTransferId }] },
                data: { asaasTransferId: recoveredTransferId, asaasTransferStatus: matches[0].status ?? "PENDING" },
              });
              if (requestLinks.count !== batch.lineCount) throw new Error("PRIZE_REQUEST_RECOVERY_LINK_FAILED");
              return true;
            });
            if (linked) {
              await reconcileAsaasTransferFromPlatform({
                transferId: recoveredTransferId,
                externalReference: batch.externalReference,
              });
              return NextResponse.json({ success: true, status: "PROCESSING",
                message: "Transferência localizada na Asaas e vinculada ao recibo. A confirmação bancária está sendo reconciliada." }, { status: 202, headers });
            }
          }
        } catch {
          // An unavailable or ambiguous lookup must preserve the reservation.
        }

        // A definitive provider rejection may be closed only after a successful
        // exact-reference lookup confirms that no transfer was created.
        const definitiveRejection = status >= 400 && status < 500 && status !== 408 && status !== 429;
        if (definitiveRejection && lookupCompleted && matchingTransfers === 0) {
          await authPrisma.$transaction(async tx => {
            const batchFailed = await tx.prizePaymentBatch.updateMany({
              where: { id: batch.id, status: "PROCESSING", paymentReference: batch.externalReference, asaasTransferId: null },
              data: { status: "FAILED", asaasTransferStatus: "REJECTED",
                asaasTransferFailureReason: "A Asaas recusou a transferência e a consulta por referência confirmou que ela não foi criada." },
            });
            if (batchFailed.count !== 1) throw new Error("PRIZE_BATCH_REJECTION_STATE_CONFLICT");
            const requestsFailed = await tx.prizePaymentRequest.updateMany({
              where: { batchId: batch.id, status: "PROCESSING", asaasTransferId: null },
              data: { status: "FAILED", asaasTransferStatus: "REJECTED",
                asaasTransferFailureReason: "A Asaas recusou a transferência e a consulta por referência confirmou que ela não foi criada." },
            });
            if (requestsFailed.count !== batch.lineCount) throw new Error("PRIZE_REQUEST_REJECTION_COUNT_MISMATCH");
          });
          return NextResponse.json({ error: "A Asaas recusou a transferência. A consulta confirmou que nenhum Pix foi criado; o pagamento ficou bloqueado para conferência." }, { status: 502, headers });
        }

        return NextResponse.json({ success: true, status: "PROCESSING",
          message: "Não foi possível confirmar o resultado do envio. O saldo permanece reservado e uma nova tentativa foi bloqueada para evitar Pix duplicado." }, { status: 202, headers });

    }
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
      REQUEST_ALREADY_EXISTS: ["Este recibo já possui uma solicitação em análise ou pagamento registrado.", 409],
      BATCH_ALREADY_EXISTS: ["Este recibo já possui uma solicitação em análise ou pagamento registrado. Consulte o andamento no próprio recibo.", 409],
    };
    const mapped = messages[code];
    return NextResponse.json({ error: mapped?.[0] ?? "Não foi possível enviar a solicitação Pix." }, { status: mapped?.[1] ?? 500, headers });
  }
}
