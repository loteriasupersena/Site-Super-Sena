import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

const schema = z.object({
  fullName: z.string().trim().min(3).max(120),
  username: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_.-]+$/),
  password: z.string().min(8).max(1024),
}).strict();

async function requireStoreAdmin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "STORE_ADMIN" || user.mustChangePassword) {
    return { response: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  }
  const store = await authPrisma.store.findUnique({
    where: { adminUserId: user.id },
    select: { id: true, status: true },
  });
  if (!store || store.status !== "ACTIVE") {
    return { response: NextResponse.json({ error: "Loja não encontrada ou inativa." }, { status: 403, headers }) };
  }
  return { user, store };
}

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host.toLowerCase();
  } catch { return false; }
}

export async function GET(request: NextRequest) {
  const auth = await requireStoreAdmin(request);
  if (auth.response) return auth.response;
  try {
    const terminals = await authPrisma.user.findMany({
      where: { storeId: auth.store.id, role: "CASHIER" },
      select: { id: true, username: true, fullName: true, status: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({
      terminals: terminals.map((terminal) => ({ ...terminal, createdAt: terminal.createdAt.toISOString() })),
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as maquininhas." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const auth = await requireStoreAdmin(request);
  if (auth.response) return auth.response;

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Informe nome, usuário e senha inicial válidos." }, { status: 400, headers });

  try {
    const username = parsed.data.username.toLowerCase();
    const passwordHash = await hashPassword(parsed.data.password);
    const terminal = await authPrisma.$transaction(async (tx) => {
      const currentStore = await tx.store.findUnique({
        where: { id: auth.store.id }, select: { id: true, status: true, adminUserId: true },
      });
      if (!currentStore || currentStore.status !== "ACTIVE" || currentStore.adminUserId !== auth.user.id) {
        throw new Error("STORE_TERMINAL_ADMIN_FORBIDDEN");
      }
      const created = await tx.user.create({
        data: {
          username, fullName: parsed.data.fullName, passwordHash,
          role: "CASHIER", status: "ACTIVE", mustChangePassword: true,
          store: { connect: { id: currentStore.id } },
        },
        select: { id: true, username: true, fullName: true, status: true, createdAt: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: auth.user.id, action: "STORE_TERMINAL_CREATED",
          entityType: "User", entityId: created.id,
          metadata: { storeId: currentStore.id, username: created.username },
        },
      });
      return created;
    });
    return NextResponse.json({
      terminal: { ...terminal, createdAt: terminal.createdAt.toISOString() },
      message: "Acesso da maquininha criado. A senha inicial deverá ser entregue ao operador com segurança.",
    }, { status: 201, headers });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_TERMINAL_ADMIN_FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Esse nome de usuário já está em uso." }, { status: 409, headers });
    }
    return NextResponse.json({ error: "Não foi possível criar o acesso da maquininha." }, { status: 500, headers });
  }
}
