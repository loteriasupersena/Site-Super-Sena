import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401 });
  if (user.role !== "CASHIER" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403 });
  return NextResponse.json({
    error: "O pagamento de prêmios não pode mais ser baixado pelo cambista. O ganhador deve solicitar o recebimento pela consulta do QR Code do recibo, e a plataforma fará o pagamento via Pix.",
  }, { status: 403, headers: { "Cache-Control": "no-store, private" } });
}
