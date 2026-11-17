import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { findAsaasTransfersByExternalReference } from "@/modules/payments/asaas";
import { reconcileAsaasTransferFromPlatform } from "@/modules/payments/reconcile-asaas-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const expected = process.env.ASAAS_RECONCILIATION_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Candidate = {
  kind: "withdrawal" | "prize" | "batch";
  id: string;
  transferId: string | null;
  externalReference: string;
  requestedAt: Date;
};

async function attachRecoveredTransfer(item: Candidate, transferId: string) {
  if (item.kind === "withdrawal") {
    const result = await authPrisma.withdrawal.updateMany({
      where: { id: item.id, status: "PROCESSING", asaasTransferId: null, paymentReference: item.externalReference },
      data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
    });
    return result.count === 1;
  }
  if (item.kind === "batch") {
    const result = await authPrisma.prizePaymentBatch.updateMany({
      where: { id: item.id, status: "PROCESSING", asaasTransferId: null, paymentReference: item.externalReference },
      data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
    });
    if (result.count !== 1) return false;
    await authPrisma.prizePaymentRequest.updateMany({
      where: { batchId: item.id, status: "PROCESSING", paymentReference: item.externalReference },
      data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
    });
    return true;
  }
  const result = await authPrisma.prizePaymentRequest.updateMany({
    where: { id: item.id, status: "PROCESSING", asaasTransferId: null, paymentReference: item.externalReference },
    data: { asaasTransferId: transferId, asaasTransferStatus: "PENDING" },
  });
  return result.count === 1;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const staleBefore = new Date(Date.now() - 10_000);
  const claimedAt = new Date();
  const results = { checked: 0, recovered: 0, confirmed: 0, pending: 0, ambiguous: 0, errors: 0 };

  const [withdrawals, prizeRequests, batches] = await Promise.all([
    authPrisma.withdrawal.findMany({
      where: { status: "PROCESSING", paymentReference: { not: null }, transferRequestedAt: { not: null }, updatedAt: { lt: staleBefore } },
      select: { id: true, asaasTransferId: true, paymentReference: true, transferRequestedAt: true },
      orderBy: { updatedAt: "asc" }, take: 100,
    }),
    authPrisma.prizePaymentRequest.findMany({
      where: { batchId: null, status: "PROCESSING", paymentReference: { not: null }, transferRequestedAt: { not: null }, updatedAt: { lt: staleBefore } },
      select: { id: true, asaasTransferId: true, paymentReference: true, transferRequestedAt: true },
      orderBy: { updatedAt: "asc" }, take: 200,
    }),
    authPrisma.prizePaymentBatch.findMany({
      where: { status: "PROCESSING", paymentReference: { not: null }, transferRequestedAt: { not: null }, updatedAt: { lt: staleBefore } },
      select: { id: true, asaasTransferId: true, paymentReference: true, transferRequestedAt: true },
      orderBy: { updatedAt: "asc" }, take: 100,
    }),
  ]);

  const candidates: Candidate[] = [
    ...withdrawals.filter(x => x.paymentReference && x.transferRequestedAt).map(x => ({
      kind: "withdrawal" as const, id: x.id, transferId: x.asaasTransferId,
      externalReference: x.paymentReference!, requestedAt: x.transferRequestedAt!,
    })),
    ...prizeRequests.filter(x => x.paymentReference && x.transferRequestedAt).map(x => ({
      kind: "prize" as const, id: x.id, transferId: x.asaasTransferId,
      externalReference: x.paymentReference!, requestedAt: x.transferRequestedAt!,
    })),
    ...batches.filter(x => x.paymentReference && x.transferRequestedAt).map(x => ({
      kind: "batch" as const, id: x.id, transferId: x.asaasTransferId,
      externalReference: x.paymentReference!, requestedAt: x.transferRequestedAt!,
    })),
  ];

  for (const item of candidates) {
    const where = { id: item.id, status: "PROCESSING" as const, updatedAt: { lt: staleBefore } };
    const claim = item.kind === "withdrawal"
      ? await authPrisma.withdrawal.updateMany({ where: { ...where, asaasTransferId: item.transferId }, data: { updatedAt: claimedAt } })
      : item.kind === "batch"
        ? await authPrisma.prizePaymentBatch.updateMany({ where: { ...where, asaasTransferId: item.transferId }, data: { updatedAt: claimedAt } })
        : await authPrisma.prizePaymentRequest.updateMany({ where: { ...where, asaasTransferId: item.transferId }, data: { updatedAt: claimedAt } });
    if (claim.count !== 1) continue;
    results.checked++;

    try {
      let transferId = item.transferId;
      if (!transferId) {
        const matches = await findAsaasTransfersByExternalReference({
          externalReference: item.externalReference, requestedAt: item.requestedAt,
        });
        if (matches.length === 0) { results.pending++; continue; }
        if (matches.length !== 1 || !matches[0].id) { results.ambiguous++; continue; }
        transferId = matches[0].id;
        if (!await attachRecoveredTransfer(item, transferId)) { results.pending++; continue; }
        results.recovered++;
      }

      const outcome = await reconcileAsaasTransferFromPlatform({
        transferId, externalReference: item.externalReference,
      });
      if (outcome.includes("PAID") || outcome === "BATCH_PAID" || outcome === "ALREADY_PAID") results.confirmed++;
      else results.pending++;
    } catch {
      results.errors++;
    }
  }

  return NextResponse.json({ success: true, ...results }, {
    headers: { "Cache-Control": "no-store" },
  });
}
