import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authPrisma } from "@/lib/auth/session";
import { getAsaasPayment } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

type AsaasPaymentWebhook = {
  id?: string;
  event?: string;
  payment?: { id?: string };
};

function response(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers });
}

function tokenMatches(received: string | null, expected: string) {
  if (!received) return false;
  const actual = Buffer.from(received);
  const configured = Buffer.from(expected);
  return actual.length === configured.length && timingSafeEqual(actual, configured);
}

/**
 * Confirms store billing only from canonical Asaas state.
 * This handler never issues coupons, closes batches, or starts payouts.
 */
export async function POST(request: NextRequest) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) return response({ error: "Webhook não configurado." }, 503);
  if (!tokenMatches(request.headers.get("asaas-access-token"), token)) {
    return response({ error: "Autenticação inválida." }, 401);
  }

  let raw: string;
  let body: AsaasPaymentWebhook;
  try {
    raw = await request.text();
    body = JSON.parse(raw) as AsaasPaymentWebhook;
  } catch {
    return response({ error: "Payload inválido." }, 400);
  }

  const eventId = body.id?.trim();
  const event = body.event?.trim().toUpperCase();
  const paymentId = body.payment?.id?.trim();
  if (!eventId || !event || !paymentId) {
    return response({ error: "Evento de pagamento incompleto." }, 400);
  }
  if (!["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"].includes(event)) {
    return response({ received: true, ignored: true }, 200);
  }

  try {
    const payment = await getAsaasPayment(paymentId);
    if (payment.id !== paymentId || payment.billingType !== "PIX") {
      return response({ error: "O pagamento consultado não é uma cobrança Pix válida." }, 422);
    }
    if (!["RECEIVED", "CONFIRMED"].includes(payment.status ?? "")) {
      return response({ error: "O Asaas ainda não confirmou o recebimento." }, 503);
    }
    if (!payment.externalReference || !Number.isFinite(payment.value)) {
      return response({ error: "Dados canônicos incompletos no Asaas." }, 422);
    }

    const billing = await authPrisma.storeBilling.findUnique({
      where: { externalReference: payment.externalReference },
      select: { id: true, amountCents: true, status: true, providerPaymentId: true, externalReference: true },
    });
    if (!billing) return response({ error: "Cobrança da loja ainda não localizada." }, 503);

    const paidCents = Math.round((payment.value ?? 0) * 100);
    if (paidCents !== billing.amountCents) {
      return response({ error: "O valor recebido não corresponde à cobrança registrada." }, 422);
    }
    if (billing.providerPaymentId && billing.providerPaymentId !== paymentId) {
      return response({ error: "O identificador do pagamento não corresponde à cobrança." }, 409);
    }

    const payloadDigest = createHash("sha256").update(raw).digest("hex");
    const outcome = await authPrisma.$transaction(async (tx) => {
      const existing = await tx.asaasWebhookEvent.findUnique({
        where: { providerEventId: eventId },
        select: { processedAt: true },
      });
      if (existing?.processedAt) return "DUPLICATE";

      await tx.asaasWebhookEvent.upsert({
        where: { providerEventId: eventId },
        create: { providerEventId: eventId, eventType: event, payloadDigest },
        update: { eventType: event, payloadDigest, processingError: null },
      });

      const changed = await tx.storeBilling.updateMany({
        where: { id: billing.id, status: { not: "PAID" } },
        data: {
          status: "PAID",
          provider: "ASAAS",
          providerPaymentId: paymentId,
          lastProviderStatus: payment.status,
          paidAt: new Date(),
        },
      });
      if (changed.count === 0 && billing.status !== "PAID") {
        throw new Error("STORE_BILLING_STATE_CONFLICT");
      }

      await tx.asaasWebhookEvent.update({
        where: { providerEventId: eventId },
        data: { processedAt: new Date(), processingError: null },
      });
      return billing.status === "PAID" ? "ALREADY_PAID" : "BILLING_PAID";
    }, { isolationLevel: "Serializable" });

    return response({ received: true, outcome }, 200);
  } catch {
    return response({ error: "Falha ao reconciliar cobrança da loja; o Asaas poderá reenviar." }, 503);
  }
}
