import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findAsaasTransfersByExternalReference } from "./asaas";

describe("findAsaasTransfersByExternalReference", () => {
  beforeEach(() => {
    vi.stubEnv("ASAAS_API_KEY", "asaas-test-key");
    vi.stubEnv("ASAAS_BASE_URL", "https://api.asaas.com/v3");
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns only exact external-reference matches", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      data: [
        { id: "trf-exact", externalReference: "prize_batch_123", status: "PENDING" },
        { id: "trf-prefix", externalReference: "prize_batch_123_other", status: "DONE" },
        { externalReference: "prize_batch_123", status: "DONE" },
      ],
      hasMore: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const matches = await findAsaasTransfersByExternalReference({
      externalReference: "prize_batch_123",
      requestedAt: new Date("2026-11-17T12:00:00.000Z"),
    });

    expect(matches).toEqual([
      { id: "trf-exact", externalReference: "prize_batch_123", status: "PENDING" },
    ]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("dateCreated%5Bge%5D=2026-11-16");
    expect(String(url)).toContain("dateCreated%5Ble%5D=2026-11-18");
    expect(String(url)).toContain("limit=100");
    expect(init).toMatchObject({ method: "GET", cache: "no-store" });
    expect(new Headers(init?.headers).get("access_token")).toBe("asaas-test-key");
  });

  it("checks subsequent pages before returning matches", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: Array.from({ length: 100 }, (_, index) => ({
          id: "trf-" + index,
          externalReference: "unrelated-" + index,
        })),
        hasMore: true,
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{ id: "trf-match", externalReference: "prize_batch_456", status: "DONE" }],
        hasMore: false,
      }), { status: 200, headers: { "content-type": "application/json" } }));

    const matches = await findAsaasTransfersByExternalReference({
      externalReference: "prize_batch_456",
      requestedAt: new Date("2026-11-17T12:00:00.000Z"),
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("trf-match");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("offset=100");
  });

  it("returns every exact match so the caller can reject ambiguous recovery", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      data: [
        { id: "trf-one", externalReference: "prize_batch_789" },
        { id: "trf-two", externalReference: "prize_batch_789" },
      ],
      hasMore: false,
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const matches = await findAsaasTransfersByExternalReference({
      externalReference: "prize_batch_789",
      requestedAt: new Date("2026-11-17T12:00:00.000Z"),
    });

    expect(matches.map((item) => item.id)).toEqual(["trf-one", "trf-two"]);
  });

  it("fails closed when Asaas does not return a successful response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 503 }));

    await expect(findAsaasTransfersByExternalReference({
      externalReference: "prize_batch_999",
      requestedAt: new Date("2026-11-17T12:00:00.000Z"),
    })).rejects.toThrow("ASAAS_TRANSFER_LIST_HTTP_503");
  });

  it("rejects invalid recovery input before making a request", async () => {
    const fetchMock = vi.mocked(fetch);

    await expect(findAsaasTransfersByExternalReference({
      externalReference: " ",
      requestedAt: new Date("invalid"),
    })).rejects.toThrow("ASAAS_TRANSFER_RECOVERY_INPUT_INVALID");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
