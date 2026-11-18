import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual prize payment was retired. Physical prize Pix transfers are initiated
// by the public receipt request flow and executed automatically by Asaas.
export async function POST() {
  return NextResponse.json({
    error: "Pagamento manual desativado. As solicitações elegíveis são enviadas automaticamente à Asaas.",
  }, {
    status: 410,
    headers: { "Cache-Control": "no-store, private" },
  });
}
