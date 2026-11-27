import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createAsaasPixTransfer,
  createAsaasStaticPixQrCode,
  findAsaasTransfersByExternalReference,
} from "./asaas";

describe("Asaas client", () => {
  beforeEach(() => {
    vi.stubEnv("ASAAS_API_KEY", "asaas-test-key");
    vi.stubEnv("ASAAS_BASE_URL", "https://api-sandbox.asaas.com/v3");
    vi.stubEnv("ASAAS_PIX_KEY", "platform-pix-key");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("creates a Pix transfer with cents converted to BRL and a neutral project description", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "trf-123", status: "PENDING",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await createAsaasPixTransfer({
      amountCents: 12345,
      pixKey: "(77) 99999-0000",
      pixKeyType: "PHONE",
      externalReference: "coupon-prize-coupon_123",
    });

    expect(result.id).toBe("trf-123");
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe("https://api-sandbox.asaas.com/v3/transfers");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      value: 123.45,
      pixAddressKey: "77999990000",
      pixAddressKeyType: "PHONE",
      operationType: "PIX",
      description: "MEU VALE PIX",
      externalReference: "coupon-prize-coupon_123",
    });
  });

  it("creates a static Pix QR code with an explicit reference", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      id: "qr-123", payload: "pix-payload", encodedImage: "base64-image",
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await createAsaasStaticPixQrCode({
      amountCents: 5000,
      externalReference: "store-invoice-store_123-period_1",
      description: "Liquidação MEU VALE PIX",
    });

    expect(result.externalReference).toBe("store-invoice-store_123-period_1");
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      value: 50,
      addressKey: "platform-pix-key",
      externalReference: "store-invoice-store_123-period_1",
    });
  });

  it("returns only exact external-reference matches and paginates", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: Array.from({ length: 100 }, (_, index) => ({
          id: "trf-" + index, externalReference: "other-" + index,
        })),
        hasMore: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          { id: "trf-exact", externalReference: "prize_batch_456", status: "DONE" },
          { id: "trf-prefix", externalReference: "prize_batch_456_other", status: "DONE" },
        ],
        hasMore: false,
      }), { status: 200 }));

    const matches = await findAsaasTransfersByExternalReference({
      externalReference: "prize_batch_456",
      requestedAt: new Date("2026-11-17T12:00:00.000Z"),
    });

    expect(matches).toEqual([
      { id: "trf-exact", externalReference: "prize_batch_456", status: "DONE" },
    ]);
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain("offset=100");
  });

  it("rejects invalid amounts and references before making requests", async () => {
    await expect(createAsaasPixTransfer({
      amountCents: 0, pixKey: "key", pixKeyType: "EVP", externalReference: "ref",
    })).rejects.toThrow("ASAAS_TRANSFER_AMOUNT_INVALID");
    await expect(createAsaasStaticPixQrCode({
      amountCents: 100, externalReference: " ", description: "x",
    })).rejects.toThrow("ASAAS_QR_REFERENCE_INVALID");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails closed when provider requests fail", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 503 }));
    await expect(createAsaasPixTransfer({
      amountCents: 100, pixKey: "key", pixKeyType: "EVP", externalReference: "ref",
    })).rejects.toThrow("ASAAS_HTTP_503");
  });
});
