import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { createStoreBillingPixCharge } from "@/modules/benefits/create-store-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}

async function requireStore(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "STORE_ADMIN" || user.mustChangePassword) {
    return { response: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  }
  const store = await authPrisma.store.findUnique({
    where: { adminUserId: user.id },
    select: { id: true, status: true, outstandingCouponCount: true },
  });
  if (!store || store.status !== "ACTIVE") {
    return { response: NextResponse.json({ error: "Loja não encontrada ou inativa." }, { status: 403, headers }) };
  }
  return { user, store };
}

export async function GET(request: NextRequest) {
  const auth = await requireStore(request);
  if (auth.response) return auth.response;
  try {
    const [billing, outstanding] = await Promise.all([
      authPrisma.storeBilling.findFirst({
        where: { storeId: auth.store.id, status: { in: ["PENDING", "PROCESSING"] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, amountCents: true, status: true, pixCopyPaste: true, pixQrCodeBase64: true,
          createdAt: true, _count: { select: { couponLinks: true } },
        },
      }),
      authPrisma.coupon.aggregate({
        where: { storeId: auth.store.id, platformFeeCents: { gt: 0 }, billingLinks: { none: { billing: { status: "PAID" } } } },
        _sum: { platformFeeCents: true },
      }),
    ]);
    return NextResponse.json({
      billing: billing ? {
        id: billing.id, amountCents: billing.amountCents, status: billing.status,
        pixCopyPaste: billing.pixCopyPaste, pixQrCodeBase64: billing.pixQrCodeBase64,
        couponCount: billing._count.couponLinks, createdAt: billing.createdAt.toISOString(),
      } : null,
      outstanding: { couponCount: auth.store.outstandingCouponCount, amountCents: outstanding._sum.platformFeeCents ?? 0 },
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a cobrança da loja." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const auth = await requireStore(request);
  if (auth.response) return auth.response;
  try {
    const billing = await createStoreBillingPixCharge({ storeId: auth.store.id });
    return NextResponse.json({
      billing: {
        id: billing.id, amountCents: billing.amountCents, status: billing.status,
        pixCopyPaste: billing.pixCopyPaste, pixQrCodeBase64: billing.pixQrCodeBase64,
        createdAt: billing.createdAt.toISOString(),
      },
    }, { status: 201, headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "STORE_BILLING_NO_UNBILLED_COUPONS") return NextResponse.json({ error: "Ainda não há cupons pendentes para cobrar." }, { status: 409, headers });
    if (code === "STORE_BILLING_STORE_INACTIVE") return NextResponse.json({ error: "A loja está inativa." }, { status: 403, headers });
    if (code === "STORE_BILLING_PROVIDER_REQUEST_UNCERTAIN") return NextResponse.json({ error: "A cobrança está em processamento. Atualize a tela antes de tentar novamente." }, { status: 409, headers });
    if (code === "STORE_BILLING_AMOUNT_INVALID") return NextResponse.json({ error: "O total devido excede o limite suportado." }, { status: 422, headers });
    return NextResponse.json({ error: "Não foi possível gerar a cobrança Pix." }, { status: 502, headers });
  }
}
