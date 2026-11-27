import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { saveStorePixKey } from "@/modules/benefits/save-store-pix-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

const schema = z.object({
  pixKey: z.string().trim().min(1).max(255),
  pixKeyType: z.enum(["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"]),
}).strict();

function validateOrigin(request: NextRequest) {
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

async function requireStoreAdmin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  }
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

export async function GET(request: NextRequest) {
  const auth = await requireStoreAdmin(request);
  if (auth.response) return auth.response;
  try {
    const saved = await authPrisma.storePixKey.findUnique({
      where: { storeId: auth.store.id },
      select: { keyMasked: true, keyType: true, validatedAt: true, updatedAt: true },
    });
    return NextResponse.json({
      pixKey: saved ? {
        keyMasked: saved.keyMasked,
        keyType: saved.keyType,
        validated: Boolean(saved.validatedAt),
        updatedAt: saved.updatedAt.toISOString(),
      } : null,
    }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível consultar a chave Pix." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  if (!validateOrigin(request)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  }
  const auth = await requireStoreAdmin(request);
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe uma chave Pix e o tipo correspondente." }, { status: 400, headers });
  }

  try {
    const saved = await saveStorePixKey({
      storeId: auth.store.id,
      actorId: auth.user.id,
      pixKey: parsed.data.pixKey,
      pixKeyType: parsed.data.pixKeyType,
    });
    return NextResponse.json({
      pixKey: {
        keyMasked: saved.keyMasked,
        keyType: saved.keyType,
        validated: false,
        updatedAt: saved.updatedAt.toISOString(),
      },
      message: "Chave salva. A titularidade ainda precisa ser validada antes de liberar saques.",
    }, { headers });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_PIX_KEY_INVALID") {
      return NextResponse.json({ error: "A chave Pix não corresponde ao tipo informado." }, { status: 400, headers });
    }
    if (error instanceof Error && error.message === "STORE_PIX_KEY_ACTOR_FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
    }
    return NextResponse.json({ error: "Não foi possível salvar a chave Pix." }, { status: 500, headers });
  }
}
