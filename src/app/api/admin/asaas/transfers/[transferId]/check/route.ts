import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { getAsaasTransfer } from "@/modules/payments/asaas";
import { POST as processAsaasTransferWebhook } from "@/app/api/payments/asaas/transfers/webhook/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private" };

function validOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/**
 * Manual platform reconciliation. It deliberately enters the same processor
 * used by the Asaas webhook, so both paths apply identical validation,
 * idempotency, wallet ledger and receipt settlement rules.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ transferId: string }> },
) {
  if (!validOrigin(request)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 403, headers });
  }

  const admin = await getSessionUser(request.cookies.get(SESSION_COOKIE)?.value);
  if (!admin) return NextResponse.json({ error: "É necessário entrar na conta." }, { status: 401, headers });
  if (admin.role !== "ADMIN" || admin.mustChangePassword) {
    return NextResponse.json({ error: "Acesso não permitido." }, { status: 403, headers });
  }

  const { transferId } = await context.params;
  if (!transferId || transferId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(transferId)) {
    return NextResponse.json({ error: "Identificador de transferência inválido." }, { status: 400, headers });
  }

  try {
    // Read the current provider record first. The shared processor will read it
    // again immediately before applying the exact same settlement mechanism.
    const current = await getAsaasTransfer(transferId);
    if (current.id !== transferId || !current.externalReference) {
      return NextResponse.json({ error: "Transferência sem referência válida no Asaas." }, { status: 409, headers });
    }

    const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "Webhook não configurado para processamento compartilhado." }, { status: 503, headers });
    }

    const internalRequest = new NextRequest(new URL("/api/payments/asaas/transfers/webhook", request.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "asaas-access-token": token,
      },
      body: JSON.stringify({
        id: "platform_check_" + randomUUID(),
        event: "TRANSFER_PENDING",
        transfer: {
          id: current.id,
          status: current.status,
          externalReference: current.externalReference,
        },
      }),
    });

    const result = await processAsaasTransferWebhook(internalRequest);
    const body = await result.json().catch(() => ({}));
    return NextResponse.json({ ...body, source: "PLATFORM_QUERY", providerStatus: current.status }, {
      status: result.status,
      headers,
    });
  } catch {
    return NextResponse.json({
      error: "Não foi possível consultar e conciliar a transferência diretamente com o Asaas.",
    }, { status: 503, headers });
  }
}
