import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { issueCoupon } from "@/modules/benefits/issue-coupon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

const schema = z.object({
  idempotencyKey: z.string().trim().min(16).max(200),
  purchaseAmountCents: z.number().int().safe().min(1).max(2_147_483_647),
}).strict();

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol)
      && parsed.host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  }

  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "CASHIER" || user.mustChangePassword) {
    return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe o valor da compra em centavos e uma chave de idempotência válida." }, { status: 400, headers });
  }

  try {
    const result = await issueCoupon({
      issuedById: user.id,
      idempotencyKey: parsed.data.idempotencyKey,
      purchaseAmountCents: parsed.data.purchaseAmountCents,
    });
    return NextResponse.json({
      coupon: {
        code: result.coupon.publicCode,
        purchaseAmountCents: result.coupon.purchaseAmountCents,
        status: result.coupon.status,
        issuedAt: result.coupon.issuedAt.toISOString(),
        redemptionDeadline: result.coupon.customerRedemptionDeadline?.toISOString() ?? null,
      },
      batch: result.batch ? {
        sequenceNumber: result.batch.sequenceNumber,
        status: result.batch.status,
        completedAt: result.batch.completedAt?.toISOString() ?? null,
      } : null,
      replayed: result.replayed,
    }, { status: result.replayed ? 200 : 201, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "COUPON_ISSUE_INPUT_INVALID") return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
    if (code === "COUPON_ISSUER_FORBIDDEN") return NextResponse.json({ error: "Acesso operacional não autorizado." }, { status: 403, headers });
    if (code === "COUPON_STORE_INACTIVE") return NextResponse.json({ error: "A loja está inativa." }, { status: 403, headers });
    if (code === "COUPON_STORE_BILLING_LIMIT_REACHED") return NextResponse.json({ error: "A loja atingiu o limite de cupons ainda não quitados. Gere e pague a cobrança Pix para liberar novas emissões." }, { status: 409, headers });
    if (code === "COUPON_IDEMPOTENCY_KEY_CONFLICT") return NextResponse.json({ error: "Esta chave de operação já foi usada em outra emissão." }, { status: 409, headers });
    if (code === "COUPON_PLATFORM_FEE_OUT_OF_RANGE") return NextResponse.json({ error: "O valor calculado excede o limite financeiro suportado." }, { status: 422, headers });
    return NextResponse.json({ error: "Não foi possível emitir o cupom. Repita a tentativa com a mesma chave de idempotência." }, { status: 500, headers });
  }
}
