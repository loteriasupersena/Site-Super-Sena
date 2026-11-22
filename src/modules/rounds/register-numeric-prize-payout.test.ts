import { describe, expect, it, vi } from "vitest";
import { registerNumericPrizePayout } from "./register-numeric-prize-payout";
import { createNumericPrizeRuleSnapshot, NUMERIC_PRIZE_RULE_VERSION } from "../../domain/numeric-prize-rules";

function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-12345678",
    numberValue: "012319",
    prizeCents: 500,
    prizeCreditedAt: null,
    tensCents: 25, hundredsCents: 20, milharCents: 20, quinaCents: 20, senaCents: 20,
    ruleVersion: NUMERIC_PRIZE_RULE_VERSION,
    ruleSnapshot: createNumericPrizeRuleSnapshot(),
    prizePayout: null,
    prizePaymentRequest: { id: "request-123", batchId: null, status: "PENDING", netCents: 500, grossCents: 500, administrativeFeeCents: 0, transactionFeeCents: 0, paymentReference: "prize_request_request-12345678" },
    participation: {
      status: "CONFIRMED",
      purchase: {
        id: "purchase-123",
        receiptCode: "SQ-12345678",
        cashierId: "cashier-123",
        playerId: null,
        status: "CONFIRMED",
        confirmedAt: new Date("2026-11-06T12:00:00.000Z"),
      },
      round: { id: "round-123", code: "SQ-ROUND-01", status: "COMPLETED", resultNumber: "993319" },
    },
    ...overrides,
  };
}

function setup(line = makeLine()) {
  const payoutCreate = vi.fn().mockResolvedValue({
    id: "payout-123", participationLineId: "line-12345678",
    channel: "PLATFORM_PIX", amountCents: 500,
    paidAt: new Date("2026-11-06T12:30:00.000Z"), reference: null,
  });
  const auditCreate = vi.fn().mockResolvedValue({});
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    numericParticipationLine: { findUnique: vi.fn().mockResolvedValue(line) },
    numericPrizePayout: { create: payoutCreate },
    auditEvent: { create: auditCreate },
    prizePaymentRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  };
  return { tx, payoutCreate, auditCreate };
}

describe("registerNumericPrizePayout", () => {
  it("allows the administrator to confirm an externally paid Pix request", async () => {
    const { tx, payoutCreate, auditCreate } = setup();
    const result = await registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
    });
    expect(result.amountCents).toBe(500);
    expect(payoutCreate).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
  });


  it("does not settle a receipt that has no player Pix request", async () => {
    const { tx, payoutCreate, auditCreate } = setup(makeLine({ prizePaymentRequest: null }));
    await expect(registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
    })).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("allows the administrator to confirm a request after its previous attempt failed", async () => {
    const { tx, payoutCreate } = setup(makeLine({
      prizePaymentRequest: {
        id: "request-123", status: "FAILED", netCents: 500, grossCents: 500,
        administrativeFeeCents: 0, transactionFeeCents: 0,
        paymentReference: "prize_request_request-12345678",
      },
    }));
    const result = await registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
      expectedRequestStatus: "FAILED", reference: "prize_request_request-12345678",
    });
    expect(result.amountCents).toBe(500);
    expect(payoutCreate).toHaveBeenCalledOnce();
  });

  it("records the administrator's bank reference independently from a legacy provider reference", async () => {
    const { tx, payoutCreate } = setup();
    await registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
      expectedRequestStatus: "PENDING", reference: "bank-transaction-123",
    });
    expect(tx.prizePaymentRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "request-123", status: "PENDING" },
      data: expect.objectContaining({ status: "PAID", paymentReference: "bank-transaction-123" }),
    });
    expect(payoutCreate).toHaveBeenCalledOnce();
  });

  it("blocks payout when the stored prize differs from the deterministic result", async () => {
    const { tx, payoutCreate, auditCreate } = setup(makeLine({ prizeCents: 1000 }));
    await expect(registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
      expectedRequestStatus: "PENDING",
    })).rejects.toMatchObject({ code: "INCONSISTENT_PRIZE" });
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects external payout for an online player's prize", async () => {
    const { tx, payoutCreate, auditCreate } = setup(makeLine({
      participation: {
        status: "CONFIRMED",
        purchase: {
          id: "purchase-online", receiptCode: "SQ-12345678",
          cashierId: null, playerId: "player-123",
          status: "CONFIRMED", confirmedAt: new Date(),
        },
        round: { id: "round-123", code: "SQ-ROUND-01", status: "COMPLETED", resultNumber: "993319" },
      },
    }));
    await expect(registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
    })).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(payoutCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a prize already credited or manually paid", async () => {
    const credited = setup(makeLine({ prizeCreditedAt: new Date() }));
    await expect(registerNumericPrizePayout(credited.tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
    })).rejects.toMatchObject({ code: "ALREADY_PAID" });

    const paid = setup(makeLine({ prizePayout: { id: "existing-payout" } }));
    await expect(registerNumericPrizePayout(paid.tx as never, {
      lineId: "line-12345678", actorId: "admin-123", channel: "PLATFORM_PIX",
    })).rejects.toMatchObject({ code: "ALREADY_PAID" });
  });

  it("blocks cash payout through the cashier channel", async () => {
    const { tx, payoutCreate } = setup();
    await expect(registerNumericPrizePayout(tx as never, {
      lineId: "line-12345678", actorId: "cashier-456",
      channel: "CASHIER_CASH",
    })).rejects.toMatchObject({ code: "NOT_ELIGIBLE" });
    expect(payoutCreate).not.toHaveBeenCalled();
  });
});
