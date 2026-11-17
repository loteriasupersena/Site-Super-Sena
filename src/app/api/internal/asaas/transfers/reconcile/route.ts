import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { reconcileAsaasTransferFromPlatform } from "@/modules/payments/reconcile-asaas-transfer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const expected = process.env.ASAAS_RECONCILIATION_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "").trim();
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const staleBefore = new Date(Date.now() - 10_000);
  const claimedAt = new Date();
  const results = { checked: 0, confirmed: 0, pending: 0, errors: 0 };

  const [withdrawals, prizeRequests] = await Promise.all([
    authPrisma.withdrawal.findMany({
      where: { status: "PROCESSING", asaasTransferId: { not: null }, paymentReference: { not: null }, updatedAt: { lt: staleBefore } },
      select: { id: true, asaasTransferId: true, paymentReference: true },
      orderBy: { updatedAt: "asc" }, take: 100,
    }),
    authPrisma.prizePaymentRequest.findMany({
      where: { status: "PROCESSING", asaasTransferId: { not: null }, paymentReference: { not: null }, updatedAt: { lt: staleBefore } },
      select: { id: true, asaasTransferId: true, paymentReference: true },
      orderBy: { updatedAt: "asc" }, take: 200,
    }),
  ]);

  const unique = new Map<string, { transferId: string; externalReference: string; kind: "withdrawal" | "prize"; id: string }>();
  for (const item of withdrawals) {
    if (item.asaasTransferId && item.paymentReference) unique.set(item.asaasTransferId, {
      transferId: item.asaasTransferId, externalReference: item.paymentReference, kind: "withdrawal", id: item.id,
    });
  }
  for (const item of prizeRequests) {
    if (item.asaasTransferId && item.paymentReference && !unique.has(item.asaasTransferId)) unique.set(item.asaasTransferId, {
      transferId: item.asaasTransferId, externalReference: item.paymentReference, kind: "prize", id: item.id,
    });
  }

  for (const item of unique.values()) {
    const claim = item.kind === "withdrawal"
      ? await authPrisma.withdrawal.updateMany({
          where: { id: item.id, status: "PROCESSING", asaasTransferId: item.transferId, updatedAt: { lt: staleBefore } },
          data: { updatedAt: claimedAt },
        })
      : await authPrisma.prizePaymentRequest.updateMany({
          where: { id: item.id, status: "PROCESSING", asaasTransferId: item.transferId, updatedAt: { lt: staleBefore } },
          data: { updatedAt: claimedAt },
        });
    if (claim.count !== 1) continue;
    results.checked++;
    try {
      const outcome = await reconcileAsaasTransferFromPlatform({
        transferId: item.transferId, externalReference: item.externalReference,
      });
      if (outcome.includes("PAID") || outcome === "BATCH_PAID" || outcome === "ALREADY_PAID") results.confirmed++;
      else results.pending++;
    } catch {
      results.errors++;
    }
  }

  const digest = createHash("sha256").update(JSON.stringify(results)).digest("hex").slice(0, 12);
  return NextResponse.json({ success: true, ...results, run: digest }, {
    headers: { "Cache-Control": "no-store" },
  });
}
