import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma } from "@/lib/auth/session";
import { maskPixKey, parsePixKeyInput } from "@/lib/wallet/pix-key";
import { getNumericPrizeReview } from "@/domain/numeric-prize-review";
import { calculatePrizeFeeBatch } from "@/domain/prize-fees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

function parsePayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (typeof body.participationLineId !== "string" || !body.participationLineId) return null;
  const pix = parsePixKeyInput(body);
  return pix ? { participationLineId: body.participationLineId, ...pix } : null;
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
      }, select: { id: true, prizeCents: true, prizeCreditedAt: true, prizePaymentRequest: { select: { requestedAt: true } }, participation: { select: { round: { select: { resultPublishedAt: true } } } } } });
      if (!selected) throw new Error("PRIZE_NOT_FOUND");
      const selectedDeadline = selected.participation.round.resultPublishedAt
        ? selected.participation.round.resultPublishedAt.getTime() + 7 * 24 * 60 * 60 * 1000 : null;
      const alreadyRequestedInTime = Boolean(selected.prizePaymentRequest?.requestedAt && selectedDeadline && selected.prizePaymentRequest.requestedAt.getTime() <= selectedDeadline);
      if (selectedDeadline !== null && Date.now() >= selectedDeadline && !alreadyRequestedInTime && !selected.prizeCreditedAt) throw new Error("PRIZE_EXPIRED");

      const openBatch = await tx.prizePaymentBatch.findFirst({ where: {
        purchaseId: purchase.id, status: { in: ["PENDING", "PROCESSING"] },
      }, select: { id: true } });
      if (openBatch) throw new Error("BATCH_ALREADY_EXISTS");

      const candidates = await tx.numericParticipationLine.findMany({ where: {
        participation: { purchaseId: purchase.id, status: "CONFIRMED", round: { status: "COMPLETED", resultNumber: { not: null }, resultPublishedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        prizeCents: { gt: 0 }, prizeCreditedAt: null, prizePayout: null,
      }, select: {
        id: true, numberValue: true, prizeCents: true, prizeCreditedAt: true,
        tensCents: true, hundredsCents: true, milharCents: true, quinaCents: true, senaCents: true,
        ruleVersion: true, ruleSnapshot: true,
        participation: { select: { round: { select: { resultNumber: true, resultPublishedAt: true } } } },
        prizePaymentRequest: { select: { id: true, status: true, batchId: true, batch: { select: { status: true } } } },
      }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      if (!candidates.length || !candidates.some(line => line.id === selected.id)) throw new Error("PRIZE_NOT_AVAILABLE");
      if (candidates.some(line => {
        const previous = line.prizePaymentRequest;
        if (!previous) return false;
        // A failed legacy provider transfer must first be explicitly released
        // by an administrator. That guarded action records the old provider
        // reference in the audit trail before a fresh request can reuse this row.
        const released = previous.status === "REJECTED" && previous.batchId === null;
        return !released;
      })) throw new Error("REQUEST_ALREADY_EXISTS");

      const feeLines = candidates.map(line => {
        const grossCents = line.prizeCents ?? 0;
        const review = getNumericPrizeReview({
          numberValue: line.numberValue, tensCents: line.tensCents,
          hundredsCents: line.hundredsCents, milharCents: line.milharCents,
          quinaCents: line.quinaCents, senaCents: line.senaCents,
          ruleVersion: line.ruleVersion, ruleSnapshot: line.ruleSnapshot,
        }, line.participation.round.resultNumber);
        if (grossCents <= 0 || line.prizeCreditedAt || !line.participation.round.resultPublishedAt || Date.now() >= line.participation.round.resultPublishedAt.getTime() + 7 * 24 * 60 * 60 * 1000 || !review?.calculationConsistent ||
            review.calculatedPrizeCents !== grossCents) throw new Error("PRIZE_CALCULATION_MISMATCH");
        return { id: line.id, grossCents, oldRequestId: line.prizePaymentRequest?.id ?? null };
      });
      const fees = calculatePrizeFeeBatch(feeLines);
      // Keep the receipt request and fee allocation; the administrator performs and confirms the Pix manually.

      const batchId = "ppb_" + randomUUID().replace(/-/g, "");
      const now = new Date();
      const allocations = new Map(fees.allocations.map(item => [item.id, item]));
      await tx.prizePaymentBatch.create({ data: {
        id: batchId, purchaseId: purchase.id,
        pixKey: input.pixKey, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType,
        holderName: null,
        holderCpfMasked: "Não informado",
        grossCents: fees.grossCents, administrativeFeeCents: fees.administrativeFeeCents,
        transactionFeeCents: fees.transactionFeeCents, netCents: fees.netCents,
        feeRuleVersion: "physical-prize-fees-v2", status: "PENDING",
        requestedAt: now, reviewedAt: null, reviewerId: null,
        items: { create: feeLines.map(line => ({ participationLineId: line.id, amountCents: line.grossCents })) },
      } });
      for (const line of feeLines) {
        const allocation = allocations.get(line.id)!;
        const requestData = {
          purchaseId: purchase.id, batchId,
          pixKey: null, pixKeyEncrypted: null, pixKeyMasked: maskPixKey(input.pixKey), pixKeyType: input.pixKeyType,
          holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null,
          holderCpfMasked: "Não informado",
          grossCents: allocation.grossCents, administrativeFeeCents: allocation.administrativeFeeCents,
          transactionFeeCents: allocation.transactionFeeCents, netCents: allocation.netCents,
          feeRuleVersion: "physical-prize-fees-v2", status: "PENDING" as const,
          requestedAt: now, reviewedAt: null, reviewerId: null,
          paymentReference: null,
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
        },
      } });
      return { id: batchId, grossCents: fees.grossCents,
        administrativeFeeCents: fees.administrativeFeeCents, transactionFeeCents: fees.transactionFeeCents,
        netCents: fees.netCents, lineCount: feeLines.length, requestedAt: now };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, batch: {
      id: batch.id, grossCents: batch.grossCents, administrativeFeeCents: batch.administrativeFeeCents,
      transactionFeeCents: batch.transactionFeeCents, netCents: batch.netCents, lineCount: batch.lineCount,
    }, status: "PENDING", message: "Solicitação recebida. O administrador fará o pagamento Pix e atualizará o status após confirmar a transferência." }, { status: 201, headers });
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
      PRIZE_EXPIRED: ["Prazo encerrado: o prêmio não foi solicitado nos 7 dias corridos após a divulgação do resultado e está expirado.", 409],
      PRIZE_CALCULATION_MISMATCH: ["Um dos valores premiados diverge do recálculo oficial. O lote inteiro foi bloqueado para conferência.", 409],
      REQUEST_ALREADY_EXISTS: ["Este recibo já possui uma solicitação em análise ou pagamento registrado.", 409],
      BATCH_ALREADY_EXISTS: ["Este recibo já possui uma solicitação em análise ou pagamento registrado. Consulte o andamento no próprio recibo.", 409],
    };
    const mapped = messages[code];
    return NextResponse.json({ error: mapped?.[0] ?? "Não foi possível enviar a solicitação Pix." }, { status: mapped?.[1] ?? 500, headers });
  }
}
