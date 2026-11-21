import { NextRequest, NextResponse } from "next/server";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (user.role !== "ADMIN" || user.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  try {
    const users = await authPrisma.user.findMany({
      where: {
        role: { in: ["PLAYER", "CASHIER"] },
        NOT: { username: { startsWith: "excluido-" } },
        ...(q ? { OR: [
          { username: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
          { whatsapp: { contains: q } },
        ] } : {}),
      },
      select: { id: true, username: true, fullName: true, whatsapp: true, role: true, status: true, createdAt: true },
      orderBy: [{ role: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({ users }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar os usuários." }, { status: 500, headers });
  }
}
