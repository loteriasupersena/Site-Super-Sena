import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

const createSchema = z.object({
  name: z.string().trim().min(2).max(160),
  adminFullName: z.string().trim().min(3).max(120),
  username: z.string().trim().min(3).max(24).regex(/^[A-Za-z0-9_.-]+$/),
  password: z.string().min(8).max(1024),
  whatsapp: z.string().trim().min(10).max(24),
  commissionRateBasisPoints: z.number().int().min(300).max(500),
  couponLimit: z.number().int().min(1).max(100000).default(100),
}).strict();

async function requireAdmin(request: NextRequest) {
  const user = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) return { response: NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers }) };
  if (user.role !== "ADMIN" || user.mustChangePassword) return { response: NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers }) };
  return { user };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  try {
    const stores = await authPrisma.store.findMany({
      select: {
        id: true, name: true, status: true, commissionRateBasisPoints: true, couponLimit: true, createdAt: true,
        adminUser: { select: { id: true, username: true, fullName: true, whatsapp: true, status: true } },
        _count: { select: { users: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return NextResponse.json({ stores: stores.map((store) => ({
      ...store,
      commissionPercent: store.commissionRateBasisPoints / 100,
      createdAt: store.createdAt.toISOString(),
    })) }, { headers });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar as lojas." }, { status: 500, headers });
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  try {
    const parsedOrigin = new URL(origin);
    if (!["http:", "https:"].includes(parsedOrigin.protocol) || parsedOrigin.host.toLowerCase() !== host.toLowerCase()) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
    }
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  }

  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400, headers }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Confira os dados da loja, administrador, percentual entre 3% e 5% e limite de cupons." }, { status: 400, headers });

  const whatsapp = parsed.data.whatsapp.replace(/\D/g, "");
  if (whatsapp.length < 10 || whatsapp.length > 15) return NextResponse.json({ error: "Informe um WhatsApp válido com DDD." }, { status: 400, headers });

  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const username = parsed.data.username.toLowerCase();
    const store = await authPrisma.$transaction(async (tx) => {
      const adminUser = await tx.user.create({
        data: {
          username, fullName: parsed.data.adminFullName, whatsapp, passwordHash,
          role: "STORE_ADMIN", status: "ACTIVE", mustChangePassword: true,
        },
        select: { id: true, username: true, fullName: true, whatsapp: true, status: true },
      });
      const createdStore = await tx.store.create({
        data: {
          name: parsed.data.name,
          commissionRateBasisPoints: parsed.data.commissionRateBasisPoints,
          couponLimit: parsed.data.couponLimit,
          adminUserId: adminUser.id,
          users: { connect: { id: adminUser.id } },
        },
        select: { id: true, name: true, status: true, commissionRateBasisPoints: true, couponLimit: true, createdAt: true },
      });
      await tx.auditEvent.create({
        data: {
          actorId: auth.user.id, action: "STORE_CREATED", entityType: "Store", entityId: createdStore.id,
          metadata: {
            name: createdStore.name, adminUserId: adminUser.id, adminUsername: adminUser.username,
            commissionRateBasisPoints: createdStore.commissionRateBasisPoints, couponLimit: createdStore.couponLimit,
          },
        },
      });
      return { ...createdStore, adminUser };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      store: { ...store, commissionPercent: store.commissionRateBasisPoints / 100, createdAt: store.createdAt.toISOString() },
    }, { status: 201, headers });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Esse nome de usuário já está em uso." }, { status: 409, headers });
    }
    return NextResponse.json({ error: "Não foi possível cadastrar a loja e seu administrador." }, { status: 500, headers });
  }
}
