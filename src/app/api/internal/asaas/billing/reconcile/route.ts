import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { listAsaasPaymentsByQrCode } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const expected = process.env.ASAAS_RECONCILIATION_TOKEN?.trim();
  const received = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || expected.length < 32 || !received) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Polls Asaas for already-created store billing QR codes; it never creates a charge or payout. */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const billings = await authPrisma.storeBilling.findMany({
    where: { status: { in: ["PENDING", "PROCESSING"] }, providerQrCodeId: { not: null } },
    select: { id: true, amountCents: true, externalReference: true, providerQrCodeId: true, providerPaymentId: true },
    orderBy: { createdAt: "asc" },
    take: 100,
  });

  let checked = 0, confirmed = 0, errors = 0;
  for (const billing of billings) {
    if (!billing.providerQrCodeId) continue;
    checked++;
    try {
      const payments = await listAsaasPaymentsByQrCode(billing.providerQrCodeId);
      const matches = payments.filter((payment) =>
        payment.id
        && payment.pixQrCodeId === billing.providerQrCodeId
        && payment.externalReference === billing.externalReference
        && payment.billingType === "PIX"
        && ["RECEIVED", "CONFIRMED"].includes(payment.status ?? "")
        && Number.isFinite(payment.value)
        && Math.round((payment.value ?? 0) * 100) === billing.amountCents,
      );
      if (matches.length > 1) {
        errors++;
        continue;
      }
      const payment = matches[0];
      if (!payment?.id) continue;
      const updated = await authPrisma.storeBilling.updateMany({
        where: {
          id: billing.id,
          status: { in: ["PENDING", "PROCESSING"] },
          OR: [{ providerPaymentId: null }, { providerPaymentId: payment.id }],
        },
        data: {
          status: "PAID",
          providerPaymentId: payment.id,
          lastProviderStatus: payment.status,
          paidAt: new Date(),
        },
      });
      if (updated.count === 1) confirmed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ success: errors === 0, checked, confirmed, errors }, {
    headers: { "Cache-Control": "no-store" },
  });
}
