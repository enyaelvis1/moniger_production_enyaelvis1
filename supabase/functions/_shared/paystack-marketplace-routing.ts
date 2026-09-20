type JsonLike = boolean | null | number | string | JsonLike[] | { [key: string]: JsonLike };

export type PayoutRoutingAccountRow = {
  id: string;
  provider_metadata: Record<string, unknown> | null;
  provider_subaccount_code: string | null;
  status: string;
};

export type PayoutRoutingSplitConfigRow = {
  id: string;
  moniger_fee_flat_amount: number | string;
  provider_metadata: Record<string, unknown> | null;
  provider_split_code: string | null;
  split_mode: string;
  status: string;
};

export type MarketplaceRoutingConfig =
  | {
      status: "inactive";
    }
  | {
      mode: "flat" | "percentage";
      payoutAccountId: string;
      providerMetadata: Record<string, unknown>;
      providerSplitCode: string | null;
      providerSubaccountCode: string;
      splitConfigId: string;
      splitConfigMetadata: Record<string, unknown>;
      status: "ready";
      transactionChargeKobo: number | null;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asNullableNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const asNullableString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

const toJsonLike = (value: unknown): JsonLike | null => {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonLike(entry));
  }

  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonLike(entry)]));
  }

  return null;
};

export const resolveMarketplaceRoutingConfig = ({
  amountKobo,
  payoutAccount,
  splitConfig,
  toKobo,
}: {
  amountKobo: number;
  payoutAccount: PayoutRoutingAccountRow | null;
  splitConfig: PayoutRoutingSplitConfigRow | null;
  toKobo: (value: number | string) => number;
}): MarketplaceRoutingConfig => {
  if (!payoutAccount || !splitConfig) {
    return { status: "inactive" };
  }

  if (splitConfig.status !== "ready") {
    return { status: "inactive" };
  }

  if (!["pending_verification", "verified"].includes(payoutAccount.status)) {
    return { status: "inactive" };
  }

  const providerSubaccountCode = asNullableString(payoutAccount.provider_subaccount_code);
  if (!providerSubaccountCode) {
    throw new Error("Workspace payout routing is marked active but missing a Paystack subaccount code.");
  }

  if (splitConfig.split_mode === "percentage") {
    const providerSplitCode = asNullableString(splitConfig.provider_split_code);
    if (!providerSplitCode) {
      throw new Error("Workspace payout routing is marked ready but missing a Paystack split code.");
    }

    return {
      mode: "percentage",
      payoutAccountId: payoutAccount.id,
      providerMetadata: payoutAccount.provider_metadata ?? {},
      providerSplitCode,
      providerSubaccountCode,
      splitConfigId: splitConfig.id,
      splitConfigMetadata: splitConfig.provider_metadata ?? {},
      status: "ready",
      transactionChargeKobo: null,
    };
  }

  const monigerFeeFlatAmount = asNullableNumber(splitConfig.moniger_fee_flat_amount);
  if (monigerFeeFlatAmount === null || monigerFeeFlatAmount < 0) {
    throw new Error("Workspace payout routing is marked ready but its flat-fee amount is invalid.");
  }

  const transactionChargeKobo = toKobo(monigerFeeFlatAmount);
  if (transactionChargeKobo > amountKobo) {
    throw new Error("Workspace payout routing fee exceeds this invoice amount.");
  }

  return {
    mode: "flat",
    payoutAccountId: payoutAccount.id,
    providerMetadata: payoutAccount.provider_metadata ?? {},
    providerSplitCode: null,
    providerSubaccountCode,
    splitConfigId: splitConfig.id,
    splitConfigMetadata: splitConfig.provider_metadata ?? {},
    status: "ready",
    transactionChargeKobo,
  };
};

export const buildMarketplaceInitializationPayload = (routingConfig: MarketplaceRoutingConfig) => {
  if (routingConfig.status !== "ready") {
    return {};
  }

  if (routingConfig.mode === "percentage") {
    return {
      bearer: "account",
      split_code: routingConfig.providerSplitCode,
    };
  }

  return {
    bearer: "account",
    subaccount: routingConfig.providerSubaccountCode,
    transaction_charge: routingConfig.transactionChargeKobo,
  };
};

const buildMarketplaceRoutingSettlement = ({
  paidAt,
  paystackPayload,
  reference,
}: {
  paidAt: string;
  paystackPayload: Record<string, unknown>;
  reference: string;
}) => ({
  amount_kobo: asNullableNumber(paystackPayload.amount),
  currency: asNullableString(paystackPayload.currency),
  fees_kobo: asNullableNumber(paystackPayload.fees),
  fees_split: toJsonLike(paystackPayload.fees_split),
  gateway_response: asNullableString(paystackPayload.gateway_response),
  paid_at: asNullableString(paystackPayload.paid_at) ?? paidAt,
  provider_reference: asNullableString(paystackPayload.reference) ?? reference,
  provider_status: asNullableString(paystackPayload.status),
  split: toJsonLike(paystackPayload.split),
  subaccount: toJsonLike(paystackPayload.subaccount),
  transaction_date: asNullableString(paystackPayload.transaction_date),
  verified_at: new Date().toISOString(),
});

export const resolveMarketplaceRoutingMetadata = ({
  existingMetadata,
  paidAt,
  paystackPayload,
  reference,
}: {
  existingMetadata: Record<string, unknown>;
  paidAt: string;
  paystackPayload: Record<string, unknown>;
  reference: string;
}) => {
  const existingRouting = isRecord(existingMetadata.marketplace_routing)
    ? (existingMetadata.marketplace_routing as Record<string, unknown>)
    : null;
  const providerMetadata = isRecord(paystackPayload.metadata) ? paystackPayload.metadata : null;
  const providerRouting = providerMetadata && isRecord(providerMetadata.marketplace_routing)
    ? (providerMetadata.marketplace_routing as Record<string, unknown>)
    : null;
  const baseRouting = existingRouting ?? providerRouting;

  if (!baseRouting) {
    return null;
  }

  return {
    ...baseRouting,
    enabled: typeof baseRouting.enabled === "boolean" ? baseRouting.enabled : true,
    settlement: buildMarketplaceRoutingSettlement({
      paidAt,
      paystackPayload,
      reference,
    }),
  };
};
