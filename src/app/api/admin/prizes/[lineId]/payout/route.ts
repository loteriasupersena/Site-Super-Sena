import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401 });
  if (user.role !== "ADMIN" || user.mustChangePassword) {
    return NextResponse.json({ error: "Somente o administrador pode acessar esta operação." }, { status: 403 });
  }
  return NextResponse.json({
    error: "A confirmação manual foi desativada. Use a autorização de Pix pela Asaas na solicitação do ganhador.",
  }, { status: 410, headers: { "Cache-Control": "no-store, private" } });
}
