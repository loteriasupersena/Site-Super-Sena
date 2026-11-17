import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { POST as processAsaasTransferWebhook } from "@/app/api/payments/asaas/transfers/webhook/route";

/**
 * Platform-side automatic reconciliation. This is the same processor used by
 * the provider webhook; it only creates a wake-up signal and never sends Pix.
 */
export async function reconcileAsaasTransferFromPlatform(input: {
  transferId: string;
  externalReference: string;
}) {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!token || token.length < 32) throw new Error("ASAAS_WEBHOOK_NOT_CONFIGURED");

  const request = new NextRequest("https://internal.invalid/api/payments/asaas/transfers/webhook", {
    method: "POST",
    headers: { "content-type": "application/json", "asaas-access-token": token },
    body: JSON.stringify({
      id: "platform_poll_" + randomUUID(),
      event: "TRANSFER_PENDING",
      transfer: { id: input.transferId, externalReference: input.externalReference },
    }),
  });
  const response = await processAsaasTransferWebhook(request);
  const body = await response.json().catch(() => ({})) as { outcome?: string; error?: string };
  if (!response.ok) throw new Error(body.error ?? "ASAAS_TRANSFER_RECONCILIATION_FAILED");
  return body.outcome ?? "PROCESSING";
}
