import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { authPrisma, getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };
type RouteContext = { params: Promise<{ userId: string }> };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try { const parsed = new URL(origin); return ["https:", "http:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host; }
  catch { return false; }
}

const deletionSchema = z.object({
  confirmationUsername: z.string().trim().min(1).max(80),
  reason: z.string().trim().min(8).max(300),
}).strict();

export async function DELETE(request: NextRequest, context: RouteContext) {
  if (!validOrigin(request)) return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  const admin = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!admin) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (admin.role !== "ADMIN" || admin.mustChangePassword) return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  const { userId } = await context.params;
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(userId)) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404, headers });

  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400, headers }); }
  const parsed = deletionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Confirme o nome de usuário e informe o motivo da exclusão." }, { status: 400, headers });

  try {
    const passwordHash = await hashPassword(randomUUID() + randomUUID());
    const result = await authPrisma.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: userId }, select: { id: true, username: true, role: true } });
      if (!target || !["PLAYER", "CASHIER"].includes(target.role) || target.username.startsWith("excluido-")) throw new Error("USER_NOT_FOUND");
      if (target.id === admin.id || target.role === "ADMIN") throw new Error("PROTECTED_USER");
      if (target.username !== parsed.data.confirmationUsername) throw new Error("CONFIRMATION_MISMATCH");

      await tx.session.deleteMany({ where: { userId: target.id } });
      await tx.customer.updateMany({
        where: { createdById: target.id },
        data: { createdById: null, name: "Cliente removido", phone: null },
      });
      await tx.withdrawal.updateMany({
        where: { userId: target.id },
        data: { pixKey: null, pixKeyEncrypted: null, pixKeyType: null, holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null, holderCpfMasked: null, pixKeyMasked: null },
      });
      await tx.prizePaymentRequest.updateMany({
        where: { purchase: { playerId: target.id } },
        data: { pixKey: null, pixKeyEncrypted: null, pixKeyType: null, holderName: null, holderNameEncrypted: null, holderCpfEncrypted: null, holderCpfMasked: null },
      });
      await tx.auditEvent.updateMany({
        where: { OR: [{ actorId: target.id }, { entityType: "User", entityId: target.id }] },
        data: { metadata: { personalDataErased: true } },
      });
      await tx.user.update({
        where: { id: target.id },
        data: {
          username: "excluido-" + target.id,
          fullName: null, whatsapp: null, city: null, address: null, referencePoint: null,
          passwordHash, status: "BLOCKED", mustChangePassword: true,
          suppliesMaterial: false, commissionRateBasisPoints: 0,
        },
      });
      await tx.auditEvent.create({
        data: {
          actorId: admin.id, action: "USER_PERSONAL_DATA_ERASED", entityType: "User", entityId: target.id,
          metadata: { formerRole: target.role, reason: parsed.data.reason, financialRecordsRetained: true, sessionsRevoked: true },
        },
      });
      return { formerRole: target.role };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({
      success: true, result,
      message: "Dados pessoais removidos e sessões encerradas. Registros financeiros e de auditoria necessários foram preservados.",
    }, { headers });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "USER_NOT_FOUND") return NextResponse.json({ error: "Jogador ou cambista não encontrado." }, { status: 404, headers });
    if (code === "PROTECTED_USER") return NextResponse.json({ error: "Esta conta não pode ser excluída." }, { status: 403, headers });
    if (code === "CONFIRMATION_MISMATCH") return NextResponse.json({ error: "O nome de usuário informado não confere." }, { status: 409, headers });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ error: "A conta foi atualizada simultaneamente. Atualize a lista e tente novamente." }, { status: 409, headers });
    return NextResponse.json({ error: "Não foi possível concluir a exclusão dos dados pessoais." }, { status: 500, headers });
  }
}
