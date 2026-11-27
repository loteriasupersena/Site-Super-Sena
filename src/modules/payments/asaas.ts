import "server-only";

const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "EVP"] as const;
export type AsaasPixKeyType = (typeof PIX_KEY_TYPES)[number];

type AsaasErrorBody = { errors?: Array<{ description?: string }> };
type AsaasTransfer = {
  id?: string;
  status?: string;
  externalReference?: string;
  transactionReceiptUrl?: string | null;
  failReason?: string | null;
};
export type AsaasTransferListItem = {
  id?: string;
  externalReference?: string | null;
  status?: string;
};
export type AsaasTransferDetails = {
  id: string;
  status: string;
  externalReference?: string | null;
  value?: number;
  operationType?: string;
  bankAccount?: { pixAddressKey?: string | null } | null;
  transactionReceiptUrl?: string | null;
  failReason?: string | null;
};
export type AsaasStaticPixQrCode = {
  id: string;
  payload: string;
  encodedImage: string;
  expirationDate?: string | null;
  externalReference: string;
};
type AsaasPayment = {
  id?: string;
  status?: string;
  billingType?: string;
  value?: number;
  externalReference?: string | null;
  pixQrCodeId?: string | null;
};

function config() {
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  const baseUrl = (process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3").trim().replace(/\/$/, "");
  if (!apiKey) throw new Error("ASAAS_API_KEY_MISSING");
  if (!/^https:\/\//i.test(baseUrl)) throw new Error("ASAAS_BASE_URL_INVALID");
  return { apiKey, baseUrl };
}

function assertAmount(amountCents: number, errorCode: string) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error(errorCode);
}

function normalizePixKey(pixKey: string, pixKeyType: AsaasPixKeyType) {
  const value = ["CPF", "CNPJ", "PHONE"].includes(pixKeyType)
    ? pixKey.replace(/\D/g, "")
    : pixKey.trim();
  if (!value) throw new Error("ASAAS_PIX_KEY_INVALID");
  return value;
}

async function asaasRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiKey, baseUrl } = config();
  const response = await fetch(baseUrl + path, {
    ...init,
    headers: {
      access_token: apiKey,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as T & AsaasErrorBody;
  if (!response.ok) {
    const error = new Error("ASAAS_HTTP_" + response.status);
    Object.assign(error, {
      status: response.status,
      providerMessage: body.errors?.[0]?.description ?? null,
    });
    throw error;
  }
  return body;
}

/** Creates an outgoing Pix transfer. Callers must persist an idempotent operation before invoking it. */
export async function createAsaasPixTransfer(input: {
  amountCents: number;
  pixKey: string;
  pixKeyType: AsaasPixKeyType;
  externalReference: string;
  description?: string;
}) {
  assertAmount(input.amountCents, "ASAAS_TRANSFER_AMOUNT_INVALID");
  if (!input.externalReference.trim()) throw new Error("ASAAS_TRANSFER_REFERENCE_INVALID");
  const body = await asaasRequest<AsaasTransfer & AsaasErrorBody>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      value: Number((input.amountCents / 100).toFixed(2)),
      pixAddressKey: normalizePixKey(input.pixKey, input.pixKeyType),
      pixAddressKeyType: input.pixKeyType,
      operationType: "PIX",
      description: input.description?.trim() || "MEU VALE PIX",
      externalReference: input.externalReference,
    }),
  });
  if (!body.id) throw new Error("ASAAS_TRANSFER_RESPONSE_WITHOUT_ID");
  return body;
}

/** Finds exact-reference transfers after an ambiguous/timed-out create request. */
export async function findAsaasTransfersByExternalReference(input: {
  externalReference: string;
  requestedAt: Date;
}): Promise<AsaasTransferListItem[]> {
  if (!input.externalReference.trim() || Number.isNaN(input.requestedAt.getTime())) {
    throw new Error("ASAAS_TRANSFER_RECOVERY_INPUT_INVALID");
  }
  const { apiKey, baseUrl } = config();
  const url = new URL(baseUrl + "/transfers");
  const start = new Date(input.requestedAt);
  start.setUTCDate(start.getUTCDate() - 1);
  const end = new Date(input.requestedAt);
  end.setUTCDate(end.getUTCDate() + 1);
  url.searchParams.set("dateCreated[ge]", start.toISOString().slice(0, 10));
  url.searchParams.set("dateCreated[le]", end.toISOString().slice(0, 10));
  url.searchParams.set("limit", "100");

  const matches: AsaasTransferListItem[] = [];
  let offset = 0;
  for (let page = 0; page < 20; page++) {
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      method: "GET",
      headers: { access_token: apiKey, Accept: "application/json" },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({})) as {
      data?: AsaasTransferListItem[];
      hasMore?: boolean;
    } & AsaasErrorBody;
    if (!response.ok) throw new Error("ASAAS_TRANSFER_LIST_HTTP_" + response.status);
    const rows = body.data ?? [];
    for (const row of rows) {
      if (row.id && row.externalReference === input.externalReference) matches.push(row);
    }
    if (!body.hasMore) return matches;
    if (rows.length === 0) throw new Error("ASAAS_TRANSFER_LIST_PAGINATION_INVALID");
    offset += rows.length;
  }
  throw new Error("ASAAS_TRANSFER_LIST_TOO_MANY_RESULTS");
}

/** Creates a static Pix QR code using an explicit platform-owned receiving key. */
export async function createAsaasStaticPixQrCode(input: {
  amountCents: number;
  externalReference: string;
  description: string;
  addressKey?: string;
}) {
  assertAmount(input.amountCents, "ASAAS_QR_AMOUNT_INVALID");
  if (!input.externalReference.trim()) throw new Error("ASAAS_QR_REFERENCE_INVALID");
  const addressKey = input.addressKey?.trim() || process.env.ASAAS_PIX_KEY?.trim();
  if (!addressKey) throw new Error("ASAAS_PIX_KEY_MISSING");

  const body = await asaasRequest<Omit<AsaasStaticPixQrCode, "externalReference"> & AsaasErrorBody>(
    "/pix/qrCodes/static",
    {
      method: "POST",
      body: JSON.stringify({
        addressKey,
        description: input.description.trim() || "MEU VALE PIX",
        value: Number((input.amountCents / 100).toFixed(2)),
        format: "ALL",
        expirationSeconds: 1800,
        allowsMultiplePayments: false,
        externalReference: input.externalReference,
      }),
    },
  );
  if (!body.id || !body.payload || !body.encodedImage) throw new Error("ASAAS_QR_RESPONSE_INCOMPLETE");
  return { ...body, externalReference: input.externalReference };
}

export async function getAsaasPayment(paymentId: string) {
  if (!paymentId.trim()) throw new Error("ASAAS_PAYMENT_ID_INVALID");
  const body = await asaasRequest<AsaasPayment & AsaasErrorBody>(
    "/payments/" + encodeURIComponent(paymentId),
    { method: "GET" },
  );
  if (!body.id) throw new Error("ASAAS_PAYMENT_RESPONSE_WITHOUT_ID");
  return body;
}

export async function listAsaasPaymentsByQrCode(qrCodeId: string) {
  if (!qrCodeId.trim()) throw new Error("ASAAS_QR_ID_INVALID");
  const url = new URL(config().baseUrl + "/payments");
  url.searchParams.set("pixQrCodeId", qrCodeId);
  url.searchParams.set("limit", "10");
  const { apiKey } = config();
  const response = await fetch(url, {
    method: "GET",
    headers: { access_token: apiKey, Accept: "application/json" },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { data?: AsaasPayment[] } & AsaasErrorBody;
  if (!response.ok) throw new Error("ASAAS_PAYMENT_LIST_HTTP_" + response.status);
  return body.data ?? [];
}

export async function getAsaasTransfer(transferId: string): Promise<AsaasTransferDetails> {
  if (!transferId.trim()) throw new Error("ASAAS_TRANSFER_ID_INVALID");
  const body = await asaasRequest<AsaasTransferDetails & AsaasErrorBody>(
    "/transfers/" + encodeURIComponent(transferId),
    { method: "GET" },
  );
  if (!body.id) throw new Error("ASAAS_TRANSFER_LOOKUP_WITHOUT_ID");
  return body;
}
