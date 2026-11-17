import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { reconcilePixPaymentFromProvider } from "@/modules/payments/reconcile-pix-payment";

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

/**
 * Independent fallback for incoming Pix notifications. If a webhook payload
 * is incomplete or its delivery is delayed, pending Asaas purchases are still
 * reconciled against the provider's canonical payment state.
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const staleBefore = new Date(Date.now() - 30_000);
  const claimedAt = new Date();
  const results = { checked: 0, confirmed: 0, pending: 0, errors: 0 };

  const candidates = await authPrisma.payment.findMany({
    where: {
      provider: "ASAAS",
      status: "PENDING",
      providerQrCodeId: { not: null },
      updatedAt: { lt: staleBefore },
      purchase: { is: { status: "PENDING_PAYMENT" } },
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: 25,
  });

  for (const candidate of candidates) {
    const claim = await authPrisma.payment.updateMany({
      where: { id: candidate.id, provider: "ASAAS", status: "PENDING", updatedAt: { lt: staleBefore } },
      data: { updatedAt: claimedAt },
    });
    if (claim.count !== 1) continue;

    results.checked++;
    try {
      const outcome = await reconcilePixPaymentFromProvider(authPrisma, candidate.id);
      if (outcome === "confirmed" || outcome === "already_confirmed") results.confirmed++;
      else results.pending++;
    } catch {
      results.errors++;
    }
  }

  return NextResponse.json({ success: true, ...results }, {
    headers: { "Cache-Control": "no-store" },
  });
}
