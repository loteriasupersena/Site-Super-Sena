import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The legacy rejection endpoint could clear an Asaas transfer reference.
// Release is handled by the guarded release endpoint, which checks provider state.
export async function POST() {
  return NextResponse.json({
    error: "Recusa manual desativada. Use o fluxo seguro de liberação após a conciliação da transferência.",
  }, {
    status: 410,
    headers: { "Cache-Control": "no-store, private" },
  });
}
