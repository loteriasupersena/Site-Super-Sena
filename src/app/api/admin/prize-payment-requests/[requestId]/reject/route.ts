import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Rejection remains disabled; release is handled by the guarded endpoint, which checks terminal transfer state.
export async function POST() {
  return NextResponse.json({
    error: "Recusa manual desativada. Use o fluxo seguro de liberação após a conciliação da transferência.",
  }, {
    status: 410,
    headers: { "Cache-Control": "no-store, private" },
  });
}
