import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ webhookPost: vi.fn() }));
vi.mock("@/app/api/payments/asaas/transfers/webhook/route", () => ({
  POST: mocks.webhookPost,
}));

import { reconcileAsaasTransferFromPlatform } from "./reconcile-asaas-transfer";

describe("platform Asaas transfer reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "w".repeat(40));
    mocks.webhookPost.mockResolvedValue(new Response(JSON.stringify({
      received: true, outcome: "WITHDRAWAL_PROCESSING",
    }), { status: 200, headers: { "content-type": "application/json" } }));
  });

  it("uses the authenticated webhook processor as a reconciliation signal without creating a Pix", async () => {
    const outcome = await reconcileAsaasTransferFromPlatform({
      transferId: "trf-existing",
      externalReference: "wallet_withdrawal_wdr_12345678",
    });

    expect(outcome).toBe("WITHDRAWAL_PROCESSING");
    expect(mocks.webhookPost).toHaveBeenCalledOnce();
    const request = mocks.webhookPost.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
    expect(request.headers.get("asaas-access-token")).toBe("w".repeat(40));
    await expect(request.json()).resolves.toMatchObject({
      event: "TRANSFER_PENDING",
      transfer: {
        id: "trf-existing",
        externalReference: "wallet_withdrawal_wdr_12345678",
      },
    });
  });

  it("fails closed when the webhook token is missing or too short", async () => {
    vi.stubEnv("ASAAS_WEBHOOK_TOKEN", "short");

    await expect(reconcileAsaasTransferFromPlatform({
      transferId: "trf-existing",
      externalReference: "wallet_withdrawal_wdr_12345678",
    })).rejects.toThrow("ASAAS_WEBHOOK_NOT_CONFIGURED");
    expect(mocks.webhookPost).not.toHaveBeenCalled();
  });

  it("propagates an unsuccessful reconciliation response", async () => {
    mocks.webhookPost.mockResolvedValueOnce(new Response(JSON.stringify({
      error: "Asaas indisponível",
    }), { status: 503, headers: { "content-type": "application/json" } }));

    await expect(reconcileAsaasTransferFromPlatform({
      transferId: "trf-existing",
      externalReference: "wallet_withdrawal_wdr_12345678",
    })).rejects.toThrow("Asaas indisponível");
  });
});
