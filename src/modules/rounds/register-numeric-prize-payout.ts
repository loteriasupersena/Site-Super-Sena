import { Prisma } from "@/generated/prisma/client";
import { getNumericPrizeReview, NUMERIC_PRIZE_CATEGORY_LABELS } from "@/domain/numeric-prize-review";

export type NumericPrizePayoutChannel = "PLATFORM_PIX" | "CASHIER_CASH";

export class NumericPrizePayoutError extends Error {
  constructor(public readonly code: "LINE_NOT_FOUND" | "NOT_ELIGIBLE" | "ALREADY_PAID" | "INCONSISTENT_PRIZE") {
    super(code);
  }
}

export async function registerNumericPrizePayout(
  tx: Prisma.TransactionClient,
  input: {
    lineId: string;
    actorId: string | null;
    channel: NumericPrizePayoutChannel;
    reference?: string | null;
    expectedRequestStatus?: "PENDING" | "PROCESSING" | "FAILED" | "CANCELLED";
  },
) {
  await tx.$queryRaw`SELECT "id" FROM "NumericParticipationLine" WHERE "id" = ${input.lineId} FOR UPDATE`;
  const line = await tx.numericParticipationLine.findUnique({
    where: { id: input.lineId },
    select: {
      id: true,
      numberValue: true,
      prizeCents: true,
      prizeCreditedAt: true,
      unitCents: true, tensCents: true, hundredsCents: true, milharCents: true, quinaCents: true, senaCents: true,
      ruleVersion: true, ruleSnapshot: true,
      participation: {
        select: {
          status: true,
          purchase: { select: { id: true, receiptCode: true, cashierId: true, playerId: true, status: true, confirmedAt: true } },
          round: { select: { id: true, code: true, status: true, resultNumber: true } },
        },
      },
      prizePayout: { select: { id: true } },
      prizePaymentRequest: { select: { id: true, batchId: true, status: true, netCents: true, grossCents: true, administrativeFeeCents: true, transactionFeeCents: true, paymentReference: true } },
    },
  });
  if (!line) throw new NumericPrizePayoutError("LINE_NOT_FOUND");
  if (line.prizePayout || line.prizeCreditedAt) throw new NumericPrizePayoutError("ALREADY_PAID");

  const purchase = line.participation.purchase;
  const isCashierTicket = Boolean(purchase.cashierId) && purchase.playerId === null;
  // Online-player prizes remain in the wallet; physical receipts require a platform Pix request.
  if (
    !isCashierTicket ||
    purchase.status !== "CONFIRMED" ||
    !purchase.confirmedAt ||
    line.participation.status !== "CONFIRMED" ||
    line.participation.round.status !== "COMPLETED" ||
    !line.prizeCents ||
    line.prizeCents <= 0
  ) throw new NumericPrizePayoutError("NOT_ELIGIBLE");

  if (input.channel === "CASHIER_CASH") throw new NumericPrizePayoutError("NOT_ELIGIBLE");
  // The administrator confirms only after completing the external Pix transfer.
  // Pending and legacy in-process requests can be confirmed manually after the
  // administrator verifies the completed bank transfer.
  const expectedRequestStatus = input.expectedRequestStatus ?? (line.prizePaymentRequest?.status ?? "PENDING");
  if (input.channel === "PLATFORM_PIX" && (
    !["PENDING", "PROCESSING", "FAILED", "CANCELLED"].includes(expectedRequestStatus)
    || !line.prizePaymentRequest
    || line.prizePaymentRequest.status !== expectedRequestStatus
  )) {
    throw new NumericPrizePayoutError("NOT_ELIGIBLE");
  }

  const prizeReview = getNumericPrizeReview({
    numberValue: line.numberValue,
    unitCents: line.unitCents, tensCents: line.tensCents,
    hundredsCents: line.hundredsCents, milharCents: line.milharCents,
    quinaCents: line.quinaCents, senaCents: line.senaCents, ruleVersion: line.ruleVersion,
    ruleSnapshot: line.ruleSnapshot,
  }, line.participation.round.resultNumber);
  if (!prizeReview?.calculationConsistent || prizeReview.calculatedPrizeCents !== line.prizeCents) {
    throw new NumericPrizePayoutError("INCONSISTENT_PRIZE");
  }

  const paidAt = new Date();
  if (!line.prizePaymentRequest) throw new NumericPrizePayoutError("NOT_ELIGIBLE");
  const requestUpdated = await tx.prizePaymentRequest.updateMany({
    where: { id: line.prizePaymentRequest.id, status: expectedRequestStatus },
    data: { status: "PAID", pixKey: null, pixKeyEncrypted: null, reviewedAt: paidAt, reviewerId: input.actorId ?? undefined, paymentReference: input.reference?.trim() || null },
  });
  if (requestUpdated.count !== 1) throw new NumericPrizePayoutError("NOT_ELIGIBLE");
  if (line.prizePaymentRequest.batchId) {
    const remaining = await tx.prizePaymentRequest.count({
      where: { batchId: line.prizePaymentRequest.batchId, status: { not: "PAID" } },
    });
    if (remaining === 0) {
      await tx.prizePaymentBatch.updateMany({
        where: { id: line.prizePaymentRequest.batchId, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PAID", pixKey: null, pixKeyEncrypted: null, reviewedAt: paidAt, paymentReference: input.reference?.trim() || null },
      });
    }
  }

  const payout = await tx.numericPrizePayout.create({
    data: {
      participationLineId: line.id,
      channel: "PLATFORM_PIX",
      amountCents: line.prizePaymentRequest.netCents,
      actorId: input.actorId ?? undefined,
      cashierId: null,
      reference: input.reference?.trim() || null,
      paidAt,
    },
    select: {
      id: true,
      participationLineId: true,
      channel: true,
      amountCents: true,
      paidAt: true,
      reference: true,
    },
  });
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId ?? undefined,
      action: "PLATFORM_PRIZE_PAID_PIX",
      entityType: "NumericPrizePayout",
      entityId: payout.id,
      metadata: {
        participationLineId: line.id,
        numberValue: line.numberValue,
        resultNumber: line.participation.round.resultNumber,
        prizeCategory: prizeReview.category,
        prizeCategoryLabel: NUMERIC_PRIZE_CATEGORY_LABELS[prizeReview.category],
        categoryStakeCents: prizeReview.stakeCents,
        multiplier: prizeReview.multiplier,
        calculatedPrizeCents: prizeReview.calculatedPrizeCents,
        receiptCode: purchase.receiptCode,
        purchaseId: purchase.id,
        roundId: line.participation.round.id,
        roundCode: line.participation.round.code,
        cashierId: purchase.cashierId,
        channel: input.channel,
        grossCents: line.prizePaymentRequest?.grossCents ?? line.prizeCents,
        administrativeFeeCents: line.prizePaymentRequest?.administrativeFeeCents ?? 0,
        transactionFeeCents: line.prizePaymentRequest?.transactionFeeCents ?? 0,
        netCents: payout.amountCents,
        amountCents: payout.amountCents,
        reference: payout.reference,
        paidAt: payout.paidAt.toISOString(),
      },
    },
  });
  return payout;
}
