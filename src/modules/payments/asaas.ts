import "server-only";

type AsaasTransfer = {
  id?: string;
  status?: string;
  externalReference?: string;
  transactionReceiptUrl?: string | null;
  failReason?: string | null;
};

function config() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  const baseUrl = (process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3").trim().replace(/\/$/, "");
  if (!apiKey) throw new Error("ASAAS_API_KEY_MISSING");
  if (!/^https:\/\//.test(baseUrl)) throw new Error("ASAAS_BASE_URL_INVALID");
  return { apiKey, baseUrl };
}

export async function createAsaasPixTransfer(input: {
  amountCents: number;
  pixKey: string;
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
  externalReference: string;
}) {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("ASAAS_TRANSFER_AMOUNT_INVALID");
  }
  const { apiKey, baseUrl } = config();
  const pixKey = ["CPF", "CNPJ", "PHONE"].includes(input.pixKeyType)
    ? input.pixKey.replace(/\D/g, "")
    : input.pixKey.trim();
  const response = await fetch(baseUrl + "/transfers", {
    method: "POST",
    headers: {
      "access_token": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      value: Number((input.amountCents / 100).toFixed(2)),
      pixAddressKey: pixKey,
      pixAddressKeyType: input.pixKeyType,
      operationType: "PIX",
      description: "Premiação Super Sena",
      externalReference: input.externalReference,
    }),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as AsaasTransfer & { errors?: Array<{ description?: string }> };
  if (!response.ok) {
    const error = new Error("ASAAS_TRANSFER_HTTP_" + response.status);
    Object.assign(error, { status: response.status, providerMessage: body.errors?.[0]?.description ?? null });
    throw error;
  }
  if (!body.id) throw new Error("ASAAS_TRANSFER_RESPONSE_WITHOUT_ID");
  return body;
}
