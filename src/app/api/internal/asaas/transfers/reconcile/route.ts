import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { findAsaasTransfersByExternalReference } from "@/modules/payments/asaas";
import { POST as processTransferWebhook } from "@/app/api/payments/asaas/transfers/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const expected = process.env.ASAAS_RECONCILIATION_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Recovers uncertain transfer POSTs by exact externalReference, then uses the same webhook processor. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) return NextResponse.json({ error: "Webhook Asaas não configurado." }, { status: 503 });

  const rows = await authPrisma.couponPayout.findMany({
    where: { status: { in: ["PROCESSING", "UNKNOWN"] } },
    select: { id: true, externalReference: true, providerTransferId: true, requestedAt: true },
    orderBy: { requestedAt: "asc" },
    take: 100,
  });

  let checked = 0, recovered = 0, confirmed = 0, ambiguous = 0, errors = 0;
  for (const payout of rows) {
    checked++;
    try {
      let transferId = payout.providerTransferId;
      if (!transferId) {
        if (!payout.requestedAt) { errors++; continue; }
        const matches = await findAsaasTransfersByExternalReference({
          externalReference: payout.externalReference,
          requestedAt: payout.requestedAt,
        });
        if (matches.length > 1) {
          ambiguous++;
          await authPrisma.couponPayout.updateMany({
            where: { id: payout.id, providerTransferId: null },
            data: { status: "UNKNOWN", providerStatus: "AMBIGUOUS_PROVIDER_MATCH" },
          });
          await authPrisma.auditEvent.create({
            data: {
              action: "COUPON_PAYOUT_PROVIDER_MATCH_AMBIGUOUS",
              entityType: "CouponPayout", entityId: payout.id,
              metadata: { matchCount: matches.length, provider: "ASAAS" },
            },
          });
          continue;
        }
        transferId = matches[0]?.id ?? null;
        if (!transferId) continue;
        const attached = await authPrisma.couponPayout.updateMany({
          where: { id: payout.id, providerTransferId: null },
          data: { providerTransferId: transferId, provider: "ASAAS", status: "PROCESSING" },
        });
        if (attached.count !== 1) continue;
        recovered++;
      }

      const webhook = new NextRequest("https://internal.invalid/api/payments/asaas/transfers/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", "asaas-access-token": token },
        body: JSON.stringify({
          id: "platform_poll_" + randomUUID(),
          event: "TRANSFER_PENDING",
          transfer: { id: transferId, externalReference: payout.externalReference },
        }),
      });
      const response = await processTransferWebhook(webhook);
      const body = await response.json().catch(() => ({})) as { outcome?: string };
      if (!response.ok) { errors++; continue; }
      if (body.outcome === "PAID") confirmed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ success: errors === 0 && ambiguous === 0, checked, recovered, confirmed, ambiguous, errors }, {
    headers: { "Cache-Control": "no-store" },
  });
}
