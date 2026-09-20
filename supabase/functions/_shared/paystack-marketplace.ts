type PaystackRequestMethod = "GET" | "POST" | "PUT";

type PaystackBankRecord = {
  active?: boolean;
  code?: string;
  currency?: string;
  name?: string;
};

type PaystackResolvedAccount = {
  account_name?: string;
  account_number?: string;
};

type PaystackSubaccountRecord = {
  account_name?: string;
  account_number?: string;
  active?: boolean;
  bank?: number | string;
  business_name?: string;
  createdAt?: string;
  currency?: string;
  description?: string | null;
  id?: number | string;
  is_verified?: boolean;
  metadata?: string | Record<string, unknown> | null;
  primary_contact_email?: string | null;
  primary_contact_name?: string | null;
  primary_contact_phone?: string | null;
  percentage_charge?: number | string | null;
  settlement_bank?: string | null;
  settlement_schedule?: string | null;
  subaccount_code?: string;
  updatedAt?: string;
};

type PaystackSplitSubaccountRecord = {
  share?: number | string | null;
  subaccount?: {
    id?: number | string;
    subaccount_code?: string;
  } | null;
};

type PaystackSplitRecord = {
  active?: boolean;
  bearer_subaccount?: string | null;
  bearer_type?: string | null;
  createdAt?: string;
  currency?: string;
  id?: number | string;
  name?: string;
  split_code?: string;
  subaccounts?: PaystackSplitSubaccountRecord[] | null;
  type?: string;
  updatedAt?: string;
 };

const toPaystackPath = (path: string) => `https://api.paystack.co${path.startsWith("/") ? path : `/${path}`}`;

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const asNullableString = (value: unknown) => {
  const normalized = asString(value);
  return normalized || null;
};

const normalizeBankName = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(nigeria|bank|microfinance|mfb|plc|limited)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sendPaystackRequest = async <TPayload>(
  path: string,
  method: PaystackRequestMethod,
  paystackSecretKey: string,
  payload?: Record<string, unknown>,
) => {
  const url = new URL(toPaystackPath(path));

  if (method === "GET" && payload) {
    Object.entries(payload).forEach(([key, value]) => {
      if (value === null || typeof value === "undefined" || value === "") {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    ...(method === "POST" || method === "PUT" ? { body: JSON.stringify(payload ?? {}) } : {}),
  });

  const responsePayload = (await response.json().catch(() => ({}))) as TPayload & {
    message?: string;
    status?: boolean;
  };

  if (!response.ok || responsePayload.status === false) {
    throw new Error(responsePayload.message || "The payment provider rejected the request.");
  }

  return responsePayload;
};

export const listPaystackBanks = async ({
  country = "nigeria",
  currency = "NGN",
  paystackSecretKey,
}: {
  country?: string;
  currency?: string;
  paystackSecretKey: string;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackBankRecord[] }>(
    "/bank",
    "GET",
    paystackSecretKey,
    {
      country,
      currency,
      perPage: 100,
    },
  );

  return Array.isArray(response.data) ? response.data : [];
};

export const resolvePaystackBankCode = async ({
  bankName,
  currency = "NGN",
  paystackSecretKey,
}: {
  bankName: string;
  currency?: string;
  paystackSecretKey: string;
}) => {
  const banks = await listPaystackBanks({
    currency,
    paystackSecretKey,
  });

  const normalizedTarget = normalizeBankName(bankName);
  if (!normalizedTarget) {
    return null;
  }

  const exactMatch =
    banks.find((bank) => normalizeBankName(asString(bank.name)) === normalizedTarget && asNullableString(bank.code)) ?? null;
  if (exactMatch?.code) {
    return exactMatch.code;
  }

  const fuzzyMatch =
    banks.find((bank) => {
      const normalizedCandidate = normalizeBankName(asString(bank.name));
      return (
        normalizedCandidate.length > 0 &&
        (normalizedCandidate.includes(normalizedTarget) || normalizedTarget.includes(normalizedCandidate))
      );
    }) ?? null;

  return asNullableString(fuzzyMatch?.code);
};

export const resolvePaystackAccountNumber = async ({
  accountNumber,
  bankCode,
  paystackSecretKey,
}: {
  accountNumber: string;
  bankCode: string;
  paystackSecretKey: string;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackResolvedAccount }>(
    "/bank/resolve",
    "GET",
    paystackSecretKey,
    {
      account_number: accountNumber,
      bank_code: bankCode,
    },
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected account resolution response.");
  }

  return response.data;
};

export const createPaystackSubaccount = async ({
  accountNumber,
  bankCode,
  businessName,
  description,
  metadata,
  paystackSecretKey,
  primaryContactEmail,
  primaryContactName,
  primaryContactPhone,
}: {
  accountNumber: string;
  bankCode: string;
  businessName: string;
  description: string;
  metadata: Record<string, unknown>;
  paystackSecretKey: string;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
  primaryContactPhone?: string | null;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackSubaccountRecord }>(
    "/subaccount",
    "POST",
    paystackSecretKey,
    {
      account_number: accountNumber,
      business_name: businessName,
      description,
      metadata: JSON.stringify(metadata),
      percentage_charge: 0,
      primary_contact_email: primaryContactEmail ?? undefined,
      primary_contact_name: primaryContactName ?? undefined,
      primary_contact_phone: primaryContactPhone ?? undefined,
      settlement_bank: bankCode,
    },
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected subaccount creation response.");
  }

  return response.data;
};

export const updatePaystackSubaccount = async ({
  accountNumber,
  active = true,
  bankCode,
  businessName,
  description,
  metadata,
  paystackSecretKey,
  primaryContactEmail,
  primaryContactName,
  primaryContactPhone,
  subaccountCode,
}: {
  accountNumber: string;
  active?: boolean;
  bankCode?: string | null;
  businessName: string;
  description: string;
  metadata: Record<string, unknown>;
  paystackSecretKey: string;
  primaryContactEmail?: string | null;
  primaryContactName?: string | null;
  primaryContactPhone?: string | null;
  subaccountCode: string;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackSubaccountRecord }>(
    `/subaccount/${encodeURIComponent(subaccountCode)}`,
    "PUT",
    paystackSecretKey,
    {
      account_number: accountNumber,
      active,
      bank_code: bankCode ?? undefined,
      business_name: businessName,
      description,
      metadata: JSON.stringify(metadata),
      percentage_charge: 0,
      primary_contact_email: primaryContactEmail ?? undefined,
      primary_contact_name: primaryContactName ?? undefined,
      primary_contact_phone: primaryContactPhone ?? undefined,
    },
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected subaccount update response.");
  }

  return response.data;
};

export const getPaystackSubaccountSyncStatus = (subaccount: PaystackSubaccountRecord) => {
  if (subaccount.is_verified === true) {
    return "verified";
  }

  if (subaccount.active === false) {
    return "disabled";
  }

  return "pending_verification";
};

export const createPaystackSplit = async ({
  bearerSubaccount,
  bearerType = "account",
  currency,
  name,
  paystackSecretKey,
  share,
  subaccountCode,
  type,
}: {
  bearerSubaccount?: string | null;
  bearerType?: "account" | "all" | "all-proportional" | "subaccount";
  currency: string;
  name: string;
  paystackSecretKey: string;
  share: number;
  subaccountCode: string;
  type: "flat" | "percentage";
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackSplitRecord }>(
    "/split",
    "POST",
    paystackSecretKey,
    {
      bearer_subaccount: bearerSubaccount ?? undefined,
      bearer_type: bearerType,
      currency,
      name,
      subaccounts: [
        {
          share,
          subaccount: subaccountCode,
        },
      ],
      type,
    },
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected split creation response.");
  }

  return response.data;
};

export const updatePaystackSplit = async ({
  active = true,
  bearerSubaccount,
  bearerType = "account",
  name,
  paystackSecretKey,
  splitId,
}: {
  active?: boolean;
  bearerSubaccount?: string | null;
  bearerType?: "account" | "all" | "all-proportional" | "subaccount";
  name: string;
  paystackSecretKey: string;
  splitId: string;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackSplitRecord }>(
    `/split/${encodeURIComponent(splitId)}`,
    "PUT",
    paystackSecretKey,
    {
      active,
      bearer_subaccount: bearerSubaccount ?? undefined,
      bearer_type: bearerType,
      name,
    },
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected split update response.");
  }

  return response.data;
};

export const addOrUpdatePaystackSplitSubaccount = async ({
  paystackSecretKey,
  share,
  splitId,
  subaccountCode,
}: {
  paystackSecretKey: string;
  share: number;
  splitId: string;
  subaccountCode: string;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackSplitRecord }>(
    `/split/${encodeURIComponent(splitId)}/subaccount/add`,
    "POST",
    paystackSecretKey,
    {
      share,
      subaccount: subaccountCode,
    },
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected split subaccount update response.");
  }

  return response.data;
};
