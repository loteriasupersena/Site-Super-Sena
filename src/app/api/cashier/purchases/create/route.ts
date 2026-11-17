import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createNumericPurchase } from "@/modules/purchases/create-numeric-purchase";
import { PurchaseServiceError } from "@/modules/purchases/purchase-service-error";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { createAsaasStaticPixQrCode } from "@/modules/payments/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  idempotencyKey: z.string().trim().min(16).max(200),
  repetitionCount: z.number().int().min(1).max(10),
  numbers: z.array(z.string().regex(/^[0-9]{6}$/)).min(1).max(100),
  stakeCents: z.number().int().safe().min(100).max(2_000_000_000),
}).strict();

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  if (origin) {
    let originHost = "";
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:") {
        return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
      }
      originHost = parsedOrigin.host.toLowerCase();
    } catch {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
    }
    const requestHost = request.headers.get("host")?.trim().toLowerCase();
    if (!requestHost || originHost !== requestHost) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 403 });
    }
  }
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (user.role !== "CASHIER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe de 1 a 10 repetições, números de seis algarismos e valores em centavos." }, { status: 400 });
  }
  try {
    const purchase = await createNumericPurchase(authPrisma, {
      idempotencyKey: parsed.data.idempotencyKey, cashierId: user.id,
      roundCount: parsed.data.repetitionCount, numbers: parsed.data.numbers, stakeCents: parsed.data.stakeCents,
      paymentProvider: "ASAAS",
    });
    if (purchase.status === "CONFIRMED" && purchase.payment?.status === "CONFIRMED" && purchase.receiptCode && purchase.confirmedAt) {
      return NextResponse.json({
        purchase: { id: purchase.id, receiptCode: purchase.receiptCode, status: purchase.status, totalCents: purchase.totalCents, currency: purchase.currency },
        paymentActionRequired: false, receiptReady: true,
        message: "Esta venda já está confirmada. O recibo oficial está disponível.",
      }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    let pixCheckout: { copyPaste: string | null; qrCodeBase64: string | null; ticketUrl: string | null } | null = null;
    const payment = purchase.payment;
    if (payment && payment.provider === "ASAAS" && process.env.ASAAS_API_KEY?.trim()) {
      try {
        const checkout = payment.providerQrCodeId ? null : await createAsaasStaticPixQrCode({
          purchaseId: purchase.id, amountCents: purchase.totalCents,
        });
        if (checkout) {
          const updated = await authPrisma.payment.update({
            where: { id: payment.id },
            data: {
              providerQrCodeId: checkout.id, pixCopyPaste: checkout.payload,
              pixQrCodeBase64: checkout.encodedImage, pixTicketUrl: null,
              providerStatus: "PENDING", providerStatusDetail: "static_qr_created",
              expiresAt: checkout.expirationDate ? new Date(checkout.expirationDate) : new Date(Date.now() + 1_800_000),
            },
            select: { pixCopyPaste: true, pixQrCodeBase64: true, pixTicketUrl: true },
          });
          pixCheckout = { copyPaste: updated.pixCopyPaste, qrCodeBase64: updated.pixQrCodeBase64, ticketUrl: updated.pixTicketUrl };
        } else if (payment.pixCopyPaste && payment.pixQrCodeBase64) {
          pixCheckout = { copyPaste: payment.pixCopyPaste, qrCodeBase64: payment.pixQrCodeBase64, ticketUrl: null };
        }
        if (!pixCheckout?.copyPaste) {
          return NextResponse.json({ error: "O Asaas ainda não disponibilizou o QR Code desta venda. Tente novamente em instantes.", code: "PIX_QR_NOT_READY", purchaseId: purchase.id }, { status: 502, headers: { "Cache-Control": "no-store" } });
        }
      } catch {
        return NextResponse.json({
          error: "A venda foi registrada, mas não foi possível preparar o Pix agora. Tente novamente com a mesma chave de idempotência.",
          code: "PIX_CHECKOUT_UNAVAILABLE", purchaseId: purchase.id,
        }, { status: 502, headers: { "Cache-Control": "no-store" } });
      }
    } else if (payment?.provider === "MERCADO_PAGO" && payment.pixCopyPaste && payment.pixQrCodeBase64) {
      // Keep an already-created legacy QR available for its original pending purchase.
      // This branch never creates a new Mercado Pago order.
      pixCheckout = {
        copyPaste: payment.pixCopyPaste,
        qrCodeBase64: payment.pixQrCodeBase64,
        ticketUrl: payment.pixTicketUrl,
      };
    }
    return NextResponse.json({
      purchase: {
        id: purchase.id, receiptCode: purchase.receiptCode, status: purchase.status,
        paymentStatus: purchase.payment?.status ?? "PENDING", totalCents: purchase.totalCents, currency: purchase.currency,
        numericIntent: purchase.numericIntent ? {
          repetitionCount: purchase.numericIntent.roundCount,
          numbers: purchase.numericIntent.numbers,
          allocationCents: purchase.numericIntent.allocation,
        } : null,
        participations: purchase.participations.map((part) => ({
          roundId: part.roundId, totalCents: part.totalCents,
          lines: part.numericLines.map((line) => ({
            numberValue: line.numberValue,
            totalCents: line.unitCents + line.tensCents + line.hundredsCents + line.milharCents + line.quinaCents + line.senaCents,
            allocationCents: { unit: line.unitCents, tens: line.tensCents, hundreds: line.hundredsCents, milhar: line.milharCents, quina: line.quinaCents, sena: line.senaCents },
          })),
        })),
      },
      pixCheckout, paymentActionRequired: true,
      message: pixCheckout
        ? payment?.provider === "MERCADO_PAGO"
          ? "Código Pix de uma venda antiga do Mercado Pago. Não gere outro pagamento; aguarde a conciliação desta cobrança."
          : "Pix preparado pelo Asaas. A venda e o recibo continuam pendentes até a confirmação autêntica do pagamento."
        : "Venda registrada como pendente. Nenhum recibo foi emitido porque o pagamento ainda não foi confirmado. A cobrança Pix ainda não foi criada: configure ASAAS_API_KEY e ASAAS_PIX_KEY no ambiente de produção.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PurchaseServiceError) {
      const status = error.code === "INVALID_ACTOR" ? 403
        : error.code === "IDEMPOTENCY_CONFLICT" || error.code === "ROUND_UNAVAILABLE" ? 409 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Não foi possível registrar a venda agora." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
