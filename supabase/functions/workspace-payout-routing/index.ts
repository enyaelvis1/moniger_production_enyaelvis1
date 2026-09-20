import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  addOrUpdatePaystackSplitSubaccount,
  createPaystackSplit,
  createPaystackSubaccount,
  getPaystackSubaccountSyncStatus,
  resolvePaystackAccountNumber,
  resolvePaystackBankCode,
  updatePaystackSplit,
  updatePaystackSubaccount,
} from "../_shared/paystack-marketplace.ts";

type PayoutRoutingAction =
  | "self.get-config"
  | "self.upsert-payout-account"
  | "self.upsert-split-config"
  | "admin.get-config"
  | "admin.upsert-split-config";

type PayoutRoutingRequest = {
  action: PayoutRoutingAction;
  accountName?: string | null;
  accountNumber?: string | null;
  bankId?: string | null;
  bankName?: string | null;
  businessId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  monigerFeeFlatAmount?: number | null;
  monigerFeePercentageBasisPoints?: number | null;
  providerSettlementBankCode?: string | null;
  splitMode?: string | null;
  syncProvider?: boolean | null;
};

type BusinessContext = {
  defaultCurrency: string | null;
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
};

type PayoutAccountRow = {
  account_name: string;
  account_number: string;
  account_number_last4: string | null;
  bank_id: string | null;
  bank_name: string;
  business_id: string;
  country_code: string;
  created_at: string;
  created_by: string | null;
  currency: string;
  id: string;
  is_default: boolean;
  last_sync_error: string | null;
  last_verified_at: string | null;
  provider: string;
  provider_metadata: Record<string, unknown> | null;
  provider_settlement_bank_code: string | null;
  provider_subaccount_code: string | null;
  provider_subaccount_id: string | null;
  status: string;
  updated_at: string;
  updated_by: string | null;
};

type SplitConfigRow = {
  business_id: string;
  currency: string;
  id: string;
  last_sync_error: string | null;
  moniger_fee_flat_amount: number | string;
  moniger_fee_percentage_basis_points: number | null;
  payout_account_id: string | null;
  provider_metadata: Record<string, unknown> | null;
  provider: string;
  provider_split_id: string | null;
  provider_split_code: string | null;
  split_mode: string;
  status: string;
  updated_at: string;
};

type BankRow = {
  id: string;
  name: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const asNullableString = (value: unknown) => {
  const normalizedValue = asString(value);
  return normalizedValue || null;
};

const normalizeAccountNumber = (value: unknown) => asString(value).replace(/\D/g, "");
const normalizeCountryCode = (value: unknown) => asString(value).toUpperCase();
const normalizeCurrencyCode = (value: unknown) => asString(value).toUpperCase();

const isWorkspaceManagerRole = (value: unknown) => {
  const candidate = asString(value);
  return candidate === "owner" || candidate === "admin";
};

const isAdminRoutingAction = (value: PayoutRoutingAction) =>
  value === "admin.get-config" || value === "admin.upsert-split-config";

const toNullableBoolean = (value: unknown) => (typeof value === "boolean" ? value : null);
const toNullableNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const supportedPaystackResolveCountryCodes = new Set(["GH", "NG"]);

const mapPayoutAccount = (row: PayoutAccountRow | null) =>
  row
    ? {
      accountName: row.account_name,
      accountNumberLast4: row.account_number_last4,
      bankId: row.bank_id,
      bankName: row.bank_name,
      businessId: row.business_id,
      countryCode: row.country_code,
      createdAt: row.created_at,
      currency: row.currency,
      id: row.id,
      isDefault: row.is_default,
      lastSyncError: row.last_sync_error,
      lastVerifiedAt: row.last_verified_at,
      provider: row.provider,
      providerMetadata: row.provider_metadata ?? {},
      providerSettlementBankCode: row.provider_settlement_bank_code,
      providerSubaccountCode: row.provider_subaccount_code,
      providerSubaccountId: row.provider_subaccount_id,
      status: row.status,
      updatedAt: row.updated_at,
    }
    : null;

const mapSplitConfig = (row: SplitConfigRow | null) =>
  row
    ? {
      businessId: row.business_id,
      currency: row.currency,
      id: row.id,
      lastSyncError: row.last_sync_error,
      monigerFeeFlatAmount: Number(row.moniger_fee_flat_amount ?? 0),
      monigerFeePercentageBasisPoints: row.moniger_fee_percentage_basis_points,
      payoutAccountId: row.payout_account_id,
      providerMetadata: row.provider_metadata ?? {},
      provider: row.provider,
      providerSplitId: row.provider_split_id,
      providerSplitCode: row.provider_split_code,
      splitMode: row.split_mode,
      status: row.status,
      updatedAt: row.updated_at,
    }
    : null;

const findManagedBusiness = async ({
  adminClient,
  businessId,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string | null;
  userId: string;
}): Promise<BusinessContext | null> => {
  if (businessId) {
    const membershipResponse = await adminClient
      .from("business_members")
      .select("business_id, role, status")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipResponse.error) {
      throw membershipResponse.error;
    }

    if (membershipResponse.data?.status === "active" && isWorkspaceManagerRole(membershipResponse.data.role)) {
      const businessResponse = await adminClient
        .from("businesses")
        .select("id, name, default_currency, email, phone")
        .eq("id", businessId)
        .maybeSingle();

      if (businessResponse.error) {
        throw businessResponse.error;
      }

      if (!businessResponse.data) {
        return null;
      }

      return {
        defaultCurrency: asNullableString(businessResponse.data.default_currency),
        email: asNullableString(businessResponse.data.email),
        id: asString(businessResponse.data.id),
        name: asString(businessResponse.data.name),
        phone: asNullableString(businessResponse.data.phone),
      };
    }

    const ownedBusinessResponse = await adminClient
      .from("businesses")
      .select("id, name, default_currency, email, phone")
      .eq("id", businessId)
      .eq("owner_user_id", userId)
      .maybeSingle();

    if (ownedBusinessResponse.error) {
      throw ownedBusinessResponse.error;
    }

    if (!ownedBusinessResponse.data) {
      return null;
    }

    return {
      defaultCurrency: asNullableString(ownedBusinessResponse.data.default_currency),
      email: asNullableString(ownedBusinessResponse.data.email),
      id: asString(ownedBusinessResponse.data.id),
      name: asString(ownedBusinessResponse.data.name),
      phone: asNullableString(ownedBusinessResponse.data.phone),
    };
  }

  const membershipResponse = await adminClient
    .from("business_members")
    .select("business_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipResponse.error) {
    throw membershipResponse.error;
  }

  const managedBusinessId = asString(membershipResponse.data?.business_id);
  if (managedBusinessId) {
    const businessResponse = await adminClient
      .from("businesses")
      .select("id, name, default_currency, email, phone")
      .eq("id", managedBusinessId)
      .maybeSingle();

    if (businessResponse.error) {
      throw businessResponse.error;
    }

    if (businessResponse.data) {
      return {
        defaultCurrency: asNullableString(businessResponse.data.default_currency),
        email: asNullableString(businessResponse.data.email),
        id: asString(businessResponse.data.id),
        name: asString(businessResponse.data.name),
        phone: asNullableString(businessResponse.data.phone),
      };
    }
  }

  const ownedBusinessResponse = await adminClient
    .from("businesses")
    .select("id, name, default_currency, email, phone")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownedBusinessResponse.error) {
    throw ownedBusinessResponse.error;
  }

  if (!ownedBusinessResponse.data) {
    return null;
  }

  return {
    defaultCurrency: asNullableString(ownedBusinessResponse.data.default_currency),
    email: asNullableString(ownedBusinessResponse.data.email),
    id: asString(ownedBusinessResponse.data.id),
    name: asString(ownedBusinessResponse.data.name),
    phone: asNullableString(ownedBusinessResponse.data.phone),
  };
};

const loadPayoutAccount = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
}) => {
  const response = await adminClient
    .from("business_payout_accounts")
    .select("*")
    .eq("business_id", businessId)
    .maybeSingle<PayoutAccountRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadSplitConfig = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
}) => {
  const response = await adminClient
    .from("business_payment_split_configs")
    .select("id, business_id, payout_account_id, provider, status, split_mode, moniger_fee_flat_amount, moniger_fee_percentage_basis_points, currency, provider_split_id, provider_split_code, provider_metadata, last_sync_error, updated_at")
    .eq("business_id", businessId)
    .maybeSingle<SplitConfigRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};


const safeInsertAuditLog = async ({
  action,
  adminClient,
  businessId,
  detail,
  entityId,
  summary,
  userId,
}: {
  action: string;
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  detail: Record<string, unknown>;
  entityId: string | null;
  summary: string;
  userId: string;
}) => {
  try {
    await adminClient.from("audit_logs").insert({
      action,
      actor_user_id: userId,
      business_id: businessId,
      detail,
      entity_id: entityId,
      entity_type: "payout_account",
      summary,
    });
  } catch (error) {
    console.error("Unable to record payout routing audit log", error);
  }
};

const safeInsertSplitAuditLog = async ({
  action,
  adminClient,
  businessId,
  detail,
  entityId,
  summary,
  userId,
}: {
  action: string;
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  detail: Record<string, unknown>;
  entityId: string | null;
  summary: string;
  userId: string;
}) => {
  try {
    await adminClient.from("audit_logs").insert({
      action,
      actor_user_id: userId,
      business_id: businessId,
      detail,
      entity_id: entityId,
      entity_type: "payment_split_config",
      summary,
    });
  } catch (error) {
    console.error("Unable to record payout split audit log", error);
  }
};

const markSplitConfigPendingResync = async ({
  adminClient,
  businessId,
  nextPayoutAccountId,
  nextProviderSubaccountCode,
  reason,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  nextPayoutAccountId: string | null;
  nextProviderSubaccountCode: string | null;
  reason: string;
  userId: string;
}) => {
  const existingSplitConfig = await loadSplitConfig({
    adminClient,
    businessId,
  });

  if (!existingSplitConfig) {
    return null;
  }

  const response = await adminClient
    .from("business_payment_split_configs")
    .update({
      last_sync_error: reason,
      payout_account_id: nextPayoutAccountId,
      provider_subaccount_code: nextProviderSubaccountCode,
      status: "pending_provider_sync",
      updated_by: userId,
    })
    .eq("id", existingSplitConfig.id)
    .select("id, business_id, payout_account_id, provider, status, split_mode, moniger_fee_flat_amount, moniger_fee_percentage_basis_points, currency, provider_split_id, provider_split_code, provider_metadata, last_sync_error, updated_at")
    .single<SplitConfigRow>();

  if (response.error) {
    throw response.error;
  }

  await safeInsertSplitAuditLog({
    action: "marketplace.split_config.pending_resync",
    adminClient,
    businessId,
    detail: {
      payout_account_id: nextPayoutAccountId,
      provider_subaccount_code: nextProviderSubaccountCode,
      reason,
    },
    entityId: response.data.id,
    summary: "Workspace payout split configuration now needs provider re-sync",
    userId,
  });

  return response.data;
};

const loadBankById = async ({
  adminClient,
  bankId,
}: {
  adminClient: ReturnType<typeof createClient>;
  bankId: string | null;
}) => {
  if (!bankId) {
    return null;
  }

  const response = await adminClient
    .from("banks")
    .select("id, name")
    .eq("id", bankId)
    .maybeSingle<BankRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadBusinessById = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string | null;
}): Promise<BusinessContext | null> => {
  if (!businessId) {
    return null;
  }

  const businessResponse = await adminClient
    .from("businesses")
    .select("id, name, default_currency, email, phone")
    .eq("id", businessId)
    .maybeSingle();

  if (businessResponse.error) {
    throw businessResponse.error;
  }

  if (!businessResponse.data) {
    return null;
  }

  return {
    defaultCurrency: asNullableString(businessResponse.data.default_currency),
    email: asNullableString(businessResponse.data.email),
    id: asString(businessResponse.data.id),
    name: asString(businessResponse.data.name),
    phone: asNullableString(businessResponse.data.phone),
  };
};

const loadAdminAccess = async ({
  adminClient,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  userId: string;
}) => {
  const response = await adminClient
    .from("admin_users")
    .select("id, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for payout routing." }, 500);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing authorization header." }, 401);
  }

  const requestClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "You need an active session before managing payout routing." }, 401);
  }

  let payload: PayoutRoutingRequest;
  try {
    payload = (await request.json()) as PayoutRoutingRequest;
  } catch {
    return json({ error: "The payout routing request body is invalid." }, 400);
  }

  if (
    payload.action !== "self.get-config" &&
    payload.action !== "self.upsert-payout-account" &&
    payload.action !== "self.upsert-split-config" &&
    payload.action !== "admin.get-config" &&
    payload.action !== "admin.upsert-split-config"
  ) {
    return json({ error: "Unsupported payout routing action." }, 400);
  }

  const requestedBusinessId = asNullableString(payload.businessId);

  try {
    const adminAccess = isAdminRoutingAction(payload.action)
      ? await loadAdminAccess({
        adminClient,
        userId: user.id,
      })
      : null;

    if (isAdminRoutingAction(payload.action) && !adminAccess) {
      return json({ error: "Only platform admins can manage Moniger fee rules." }, 403);
    }

    const business = isAdminRoutingAction(payload.action)
      ? await loadBusinessById({
        adminClient,
        businessId: requestedBusinessId,
      })
      : await findManagedBusiness({
        adminClient,
        businessId: requestedBusinessId,
        userId: user.id,
      });

    if (!business) {
      return json(
        {
          error: isAdminRoutingAction(payload.action)
            ? requestedBusinessId
              ? "The selected workspace could not be found."
              : "A business workspace id is required before you can manage Moniger fee rules."
            : requestedBusinessId
            ? "Only workspace owners and admins can manage payout routing for this workspace."
            : "A business workspace is required before you can manage payout routing.",
        },
        isAdminRoutingAction(payload.action) ? (requestedBusinessId ? 404 : 400) : requestedBusinessId ? 403 : 404,
      );
    }

    if (payload.action === "self.get-config" || payload.action === "admin.get-config") {
      const [payoutAccount, splitConfig] = await Promise.all([
        loadPayoutAccount({ adminClient, businessId: business.id }),
        loadSplitConfig({ adminClient, businessId: business.id }),
      ]);

      return json({
        ok: true,
        payoutAccount: mapPayoutAccount(payoutAccount),
        splitConfig: mapSplitConfig(splitConfig),
      });
    }

    if (payload.action === "self.upsert-split-config") {
      return json(
        {
          error: "Moniger fee rules are managed by platform admins only.",
        },
        403,
      );
    }

    if (payload.action === "admin.upsert-split-config") {
      const existingPayoutAccount = await loadPayoutAccount({
        adminClient,
        businessId: business.id,
      });

      if (!existingPayoutAccount) {
        return json({ error: "Save a workspace payout account before configuring split routing." }, 400);
      }

      const splitMode = asNullableString(payload.splitMode);
      if (splitMode !== "flat" && splitMode !== "percentage") {
        return json({ error: "Choose a valid split mode before saving payout routing." }, 400);
      }

      const currency = normalizeCurrencyCode(payload.currency) || business.defaultCurrency || "NGN";
      const syncProvider = toNullableBoolean(payload.syncProvider) ?? true;
      const flatAmount = roundMoney(Math.max(0, toNullableNumber(payload.monigerFeeFlatAmount) ?? 0));
      const percentageBasisPoints =
        splitMode === "percentage" ? Math.round(Math.max(0, toNullableNumber(payload.monigerFeePercentageBasisPoints) ?? -1)) : null;

      if (currency.length !== 3) {
        return json({ error: "Use a valid 3-letter routing currency code before saving the fee rule." }, 400);
      }

      if (splitMode === "percentage" && (percentageBasisPoints === null || percentageBasisPoints > 10000)) {
        return json({ error: "Enter a valid Moniger percentage fee between 0 and 10000 basis points." }, 400);
      }

      if (syncProvider && splitMode === "percentage" && percentageBasisPoints !== null && percentageBasisPoints % 100 !== 0) {
        return json(
          {
            error: "Paystack split groups currently need whole-percentage shares. Use percentage fees in 100 basis-point steps for synced percentage mode.",
          },
          400,
        );
      }

      const existingSplitConfig = await loadSplitConfig({
        adminClient,
        businessId: business.id,
      });

      const splitName = `${business.name} Marketplace Split`;
      const baseSplitPayload = {
        business_id: business.id,
        created_by: user.id,
        currency,
        moniger_fee_flat_amount: flatAmount,
        moniger_fee_percentage_basis_points: percentageBasisPoints,
        payout_account_id: existingPayoutAccount.id,
        provider: "paystack",
        updated_by: user.id,
      };

      if (!syncProvider) {
        const upsertResponse = await adminClient
          .from("business_payment_split_configs")
          .upsert(
            {
              ...baseSplitPayload,
              last_sync_error: null,
              provider_metadata: {
                strategy: splitMode === "percentage" ? "split_code" : "transaction_charge",
              },
              provider_split_code: existingSplitConfig?.provider_split_code ?? null,
              provider_split_id: existingSplitConfig?.provider_split_id ?? null,
              provider_subaccount_code: existingPayoutAccount.provider_subaccount_code,
              split_mode: splitMode,
              status: "draft",
            },
            { onConflict: "business_id" },
          )
          .select("id, business_id, payout_account_id, provider, status, split_mode, moniger_fee_flat_amount, moniger_fee_percentage_basis_points, currency, provider_split_id, provider_split_code, provider_metadata, last_sync_error, updated_at")
          .single<SplitConfigRow>();

        if (upsertResponse.error) {
          throw upsertResponse.error;
        }

        await safeInsertSplitAuditLog({
          action: "marketplace.split_config.saved",
          adminClient,
          businessId: business.id,
          detail: {
            mode: splitMode,
            provider: "paystack",
            strategy: splitMode === "percentage" ? "split_code" : "transaction_charge",
          },
          entityId: upsertResponse.data.id,
          summary: "Workspace payout split config saved without provider sync",
          userId: user.id,
        });

        return json({
          ok: true,
          payoutAccount: mapPayoutAccount(existingPayoutAccount),
          splitConfig: mapSplitConfig(upsertResponse.data),
          sync: {
            attempted: false,
            message: "Provider sync was skipped and the split configuration was saved locally.",
            status: "skipped",
          },
        });
      }

      if (!paystackSecretKey) {
        return json(
          {
            error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to your Supabase Edge Function secrets.",
          },
          500,
        );
      }

      if (!existingPayoutAccount.provider_subaccount_code) {
        return json(
          {
            error: "Sync a workspace payout account to Paystack before configuring a split.",
          },
          400,
        );
      }

      try {
        let providerSplitCode = existingSplitConfig?.provider_split_code ?? null;
        let providerSplitId = existingSplitConfig?.provider_split_id ?? null;
        let providerMetadata: Record<string, unknown> = {};

        if (splitMode === "percentage") {
          const subaccountShare = roundMoney((10000 - percentageBasisPoints!) / 100);

          if (subaccountShare < 0 || subaccountShare > 100) {
            return json(
              {
                error: "The percentage split would create an invalid subscriber share. Check the Moniger fee.",
              },
              400,
            );
          }

          if (providerSplitId) {
            const updatedSplit = await updatePaystackSplit({
              bearerType: "account",
              name: splitName,
              paystackSecretKey,
              splitId: providerSplitId,
            });

            const syncedSplit = await addOrUpdatePaystackSplitSubaccount({
              paystackSecretKey,
              share: subaccountShare,
              splitId: providerSplitId,
              subaccountCode: existingPayoutAccount.provider_subaccount_code,
            });

            providerSplitCode = asNullableString(syncedSplit.split_code) ?? asNullableString(updatedSplit.split_code) ?? providerSplitCode;
            providerSplitId =
              (typeof syncedSplit.id === "number" || typeof syncedSplit.id === "string" ? String(syncedSplit.id) : null) ??
              (typeof updatedSplit.id === "number" || typeof updatedSplit.id === "string" ? String(updatedSplit.id) : null) ??
              providerSplitId;
          } else {
            const createdSplit = await createPaystackSplit({
              bearerType: "account",
              currency,
              name: splitName,
              paystackSecretKey,
              share: subaccountShare,
              subaccountCode: existingPayoutAccount.provider_subaccount_code,
              type: "percentage",
            });

            providerSplitCode = asNullableString(createdSplit.split_code);
            providerSplitId =
              typeof createdSplit.id === "number" || typeof createdSplit.id === "string" ? String(createdSplit.id) : null;
          }

          providerMetadata = {
            bearer_type: "account",
            split_name: splitName,
            strategy: "split_code",
            subscriber_share_percentage: subaccountShare,
          };
        } else {
          providerMetadata = {
            bearer_type: "account",
            split_name: splitName,
            strategy: "transaction_charge",
            transaction_charge_subunit_hint: Math.round(flatAmount * 100),
          };
          providerSplitCode = null;
          providerSplitId = null;
        }

        const upsertResponse = await adminClient
          .from("business_payment_split_configs")
          .upsert(
            {
              ...baseSplitPayload,
              last_sync_error: null,
              last_verified_at: new Date().toISOString(),
              provider_metadata: providerMetadata,
              provider_split_code: providerSplitCode,
              provider_split_id: providerSplitId,
              provider_subaccount_code: existingPayoutAccount.provider_subaccount_code,
              split_mode: splitMode,
              status: "ready",
            },
            { onConflict: "business_id" },
          )
          .select("id, business_id, payout_account_id, provider, status, split_mode, moniger_fee_flat_amount, moniger_fee_percentage_basis_points, currency, provider_split_id, provider_split_code, provider_metadata, last_sync_error, updated_at")
          .single<SplitConfigRow>();

        if (upsertResponse.error) {
          throw upsertResponse.error;
        }

        await safeInsertSplitAuditLog({
          action: existingSplitConfig?.id ? "marketplace.split_config.synced" : "marketplace.split_config.created",
          adminClient,
          businessId: business.id,
          detail: {
            mode: splitMode,
            provider: "paystack",
            provider_split_code: providerSplitCode,
            strategy: splitMode === "percentage" ? "split_code" : "transaction_charge",
          },
          entityId: upsertResponse.data.id,
          summary: "Workspace payout split configuration synced",
          userId: user.id,
        });

        return json({
          ok: true,
          payoutAccount: mapPayoutAccount(existingPayoutAccount),
          splitConfig: mapSplitConfig(upsertResponse.data),
          sync: {
            attempted: true,
            message:
              splitMode === "percentage"
                ? "The split configuration was saved and synced to Paystack."
                : "The split configuration was saved. Flat mode will use Paystack transaction_charge during payment initialization.",
            providerSplitCode,
            providerSplitId,
            status: splitMode === "percentage" ? "succeeded" : "not_required",
          },
        });
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : "The split configuration could not be synced with Paystack.";

        const upsertResponse = await adminClient
          .from("business_payment_split_configs")
          .upsert(
            {
              ...baseSplitPayload,
              last_sync_error: message,
              provider_metadata: {
                strategy: splitMode === "percentage" ? "split_code" : "transaction_charge",
              },
              provider_split_code: existingSplitConfig?.provider_split_code ?? null,
              provider_split_id: existingSplitConfig?.provider_split_id ?? null,
              provider_subaccount_code: existingPayoutAccount.provider_subaccount_code,
              split_mode: splitMode,
              status: "errored",
            },
            { onConflict: "business_id" },
          )
          .select("id, business_id, payout_account_id, provider, status, split_mode, moniger_fee_flat_amount, moniger_fee_percentage_basis_points, currency, provider_split_id, provider_split_code, provider_metadata, last_sync_error, updated_at")
          .single<SplitConfigRow>();

        if (upsertResponse.error) {
          throw upsertResponse.error;
        }

        await safeInsertSplitAuditLog({
          action: "marketplace.split_config.sync_failed",
          adminClient,
          businessId: business.id,
          detail: {
            error: message,
            mode: splitMode,
            provider: "paystack",
          },
          entityId: upsertResponse.data.id,
          summary: "Workspace payout split configuration sync failed",
          userId: user.id,
        });

        return json({
          ok: true,
          payoutAccount: mapPayoutAccount(existingPayoutAccount),
          splitConfig: mapSplitConfig(upsertResponse.data),
          sync: {
            attempted: true,
            message,
            status: "failed",
          },
        });
      }
    }

    const normalizedBankId = asNullableString(payload.bankId);
    const bankRecord = await loadBankById({
      adminClient,
      bankId: normalizedBankId,
    });

    if (normalizedBankId && !bankRecord) {
      return json({ error: "The selected bank could not be found." }, 400);
    }

    const bankName = asNullableString(bankRecord?.name) ?? asNullableString(payload.bankName);
    const accountNumber = normalizeAccountNumber(payload.accountNumber);
    const accountNameInput = asNullableString(payload.accountName);
    const countryCode = normalizeCountryCode(payload.countryCode) || "NG";
    const currency = normalizeCurrencyCode(payload.currency) || business.defaultCurrency || "NGN";
    const syncProvider = toNullableBoolean(payload.syncProvider) ?? true;
    const requestedBankCode = asNullableString(payload.providerSettlementBankCode);

    if (!bankName) {
      return json({ error: "Choose a bank before saving payout routing." }, 400);
    }

    if (accountNumber.length < 10 || accountNumber.length > 20) {
      return json({ error: "Enter a valid bank account number before saving payout routing." }, 400);
    }

    if (countryCode.length !== 2) {
      return json({ error: "Use a valid 2-letter country code like NG before saving payout routing." }, 400);
    }

    if (currency.length !== 3) {
      return json({ error: "Use a valid 3-letter routing currency code like NGN before saving payout routing." }, 400);
    }

    if (!syncProvider && !accountNameInput) {
      return json({ error: "Enter the account name if you are saving without provider sync." }, 400);
    }

    if (syncProvider && supportedPaystackResolveCountryCodes.has(countryCode) && accountNumber.length !== 10) {
      return json(
        {
          error: `Paystack account resolution expects a 10-digit account number for ${countryCode}. Save as draft if you need to keep the record before using a supported live payout account.`,
        },
        400,
      );
    }

    if (syncProvider && !supportedPaystackResolveCountryCodes.has(countryCode)) {
      return json(
        {
          error: `Live Paystack payout-account sync is currently supported for NG and GH account resolution only. Save as draft first if this payout destination is outside those countries.`,
        },
        400,
      );
    }

    const existingPayoutAccount = await loadPayoutAccount({
      adminClient,
      businessId: business.id,
    });

    const basePayload = {
      account_number: accountNumber,
      bank_id: bankRecord?.id ?? normalizedBankId,
      bank_name: bankName,
      business_id: business.id,
      country_code: countryCode,
      created_by: existingPayoutAccount?.created_by ?? user.id,
      currency,
      is_default: true,
      provider: "paystack",
      updated_by: user.id,
    };

    if (!syncProvider) {
      const upsertResponse = await adminClient
        .from("business_payout_accounts")
        .upsert(
          {
            ...basePayload,
            account_name: accountNameInput,
            last_sync_error: null,
            provider_metadata: existingPayoutAccount?.provider_metadata ?? {},
            provider_settlement_bank_code: requestedBankCode ?? existingPayoutAccount?.provider_settlement_bank_code ?? null,
            provider_subaccount_code: existingPayoutAccount?.provider_subaccount_code ?? null,
            provider_subaccount_id: existingPayoutAccount?.provider_subaccount_id ?? null,
            status: "draft",
          },
          { onConflict: "business_id" },
        )
        .select("*")
        .single<PayoutAccountRow>();

      if (upsertResponse.error) {
        throw upsertResponse.error;
      }

      await safeInsertAuditLog({
        action: "marketplace.payout_account.saved",
        adminClient,
        businessId: business.id,
        detail: {
          bank_name: bankName,
          currency,
          provider: "paystack",
          status: "draft",
        },
        entityId: upsertResponse.data.id,
        summary: "Workspace payout account saved without provider sync",
        userId: user.id,
      });

      const pendingSplitConfig = await markSplitConfigPendingResync({
        adminClient,
        businessId: business.id,
        nextPayoutAccountId: upsertResponse.data.id,
        nextProviderSubaccountCode: upsertResponse.data.provider_subaccount_code,
        reason: "The workspace payout destination changed and the platform admin needs to re-save the Moniger fee rule to re-sync Paystack routing.",
        userId: user.id,
      });

      return json({
        ok: true,
        payoutAccount: mapPayoutAccount(upsertResponse.data),
        splitConfig: mapSplitConfig(pendingSplitConfig ?? await loadSplitConfig({ adminClient, businessId: business.id })),
        sync: {
          attempted: false,
          message: pendingSplitConfig
            ? "Provider sync was skipped and the payout account was saved locally. The existing Moniger fee rule now needs an admin re-sync before routed checkout can use it again."
            : "Provider sync was skipped and the payout account was saved locally.",
          status: "skipped",
        },
      });
    }

    if (!paystackSecretKey) {
      return json(
        {
          error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to your Supabase Edge Function secrets.",
        },
        500,
      );
    }

    let resolvedBankCode = requestedBankCode;
    if (!resolvedBankCode) {
      resolvedBankCode = await resolvePaystackBankCode({
        bankName,
        currency,
        paystackSecretKey,
      });
    }

    if (!resolvedBankCode) {
      return json(
        {
          error: `We could not resolve a Paystack bank code for ${bankName}. Pass providerSettlementBankCode or use a bank name Paystack recognizes.`,
        },
        400,
      );
    }

    try {
      const resolvedAccount = await resolvePaystackAccountNumber({
        accountNumber,
        bankCode: resolvedBankCode,
        paystackSecretKey,
      });
      const resolvedAccountName = asNullableString(resolvedAccount.account_name) ?? accountNameInput;

      if (!resolvedAccountName) {
        throw new Error("Paystack did not return an account name for this bank account.");
      }

      const subaccountMetadata = {
        business_id: business.id,
        business_name: business.name,
        source: "moniger_marketplace_routing",
      };

      const subaccount =
        existingPayoutAccount?.provider_subaccount_code
          ? await updatePaystackSubaccount({
            accountNumber,
            bankCode: resolvedBankCode,
            businessName: business.name,
            description: `Moniger payout account for ${business.name}`,
            metadata: subaccountMetadata,
            paystackSecretKey,
            primaryContactEmail: asNullableString(user.email) ?? business.email,
            primaryContactName:
              asNullableString(user.user_metadata?.name) ??
              asNullableString(user.user_metadata?.full_name) ??
              business.name,
            primaryContactPhone: business.phone,
            subaccountCode: existingPayoutAccount.provider_subaccount_code,
          })
          : await createPaystackSubaccount({
            accountNumber,
            bankCode: resolvedBankCode,
            businessName: business.name,
            description: `Moniger payout account for ${business.name}`,
            metadata: subaccountMetadata,
            paystackSecretKey,
            primaryContactEmail: asNullableString(user.email) ?? business.email,
            primaryContactName:
              asNullableString(user.user_metadata?.name) ??
              asNullableString(user.user_metadata?.full_name) ??
              business.name,
            primaryContactPhone: business.phone,
          });

      const syncStatus = getPaystackSubaccountSyncStatus(subaccount);
      const providerSubaccountCode = asNullableString(subaccount.subaccount_code);
      const providerSubaccountId =
        typeof subaccount.id === "number" || typeof subaccount.id === "string" ? String(subaccount.id) : null;

      const upsertResponse = await adminClient
        .from("business_payout_accounts")
        .upsert(
          {
            ...basePayload,
            account_name: resolvedAccountName,
            last_sync_error: null,
            last_verified_at: new Date().toISOString(),
            provider_metadata: {
              account_name: asNullableString(subaccount.account_name),
              active: subaccount.active ?? null,
              is_verified: subaccount.is_verified ?? null,
              raw_settlement_bank: asNullableString(subaccount.settlement_bank),
              updated_at: asNullableString(subaccount.updatedAt),
            },
            provider_settlement_bank_code: resolvedBankCode,
            provider_subaccount_code: providerSubaccountCode,
            provider_subaccount_id: providerSubaccountId,
            status: syncStatus,
          },
          { onConflict: "business_id" },
        )
        .select("*")
        .single<PayoutAccountRow>();

      if (upsertResponse.error) {
        throw upsertResponse.error;
      }

      await safeInsertAuditLog({
        action: existingPayoutAccount?.id ? "marketplace.payout_account.synced" : "marketplace.payout_account.created",
        adminClient,
        businessId: business.id,
        detail: {
          bank_name: bankName,
          currency,
          provider: "paystack",
          provider_subaccount_code: providerSubaccountCode,
          resolved_account_name: resolvedAccountName,
          status: syncStatus,
        },
        entityId: upsertResponse.data.id,
        summary: "Workspace payout account synced with Paystack",
        userId: user.id,
      });

      const payoutBankChanged =
        existingPayoutAccount?.provider_subaccount_code !== providerSubaccountCode ||
        existingPayoutAccount?.account_number !== accountNumber ||
        existingPayoutAccount?.bank_name !== bankName;
      const pendingSplitConfig = payoutBankChanged
        ? await markSplitConfigPendingResync({
          adminClient,
          businessId: business.id,
          nextPayoutAccountId: upsertResponse.data.id,
          nextProviderSubaccountCode: providerSubaccountCode,
          reason: "The workspace payout destination changed after the fee rule was configured. Re-save the Moniger fee rule from the platform admin payout tab to re-sync Paystack routing.",
          userId: user.id,
        })
        : null;

      return json({
        ok: true,
        payoutAccount: mapPayoutAccount(upsertResponse.data),
        splitConfig: mapSplitConfig(pendingSplitConfig ?? await loadSplitConfig({ adminClient, businessId: business.id })),
        sync: {
          attempted: true,
          message: pendingSplitConfig
            ? "The payout account was saved and synced with Paystack. The existing Moniger fee rule now needs an admin re-sync before routed checkout can use the updated destination."
            : "The payout account was saved and synced with Paystack.",
          providerSubaccountCode,
          resolvedAccountName,
          resolvedBankCode,
          status: "succeeded",
        },
      });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "The payout account could not be synced with Paystack.";

      const upsertResponse = await adminClient
        .from("business_payout_accounts")
        .upsert(
          {
            ...basePayload,
            account_name: accountNameInput ?? existingPayoutAccount?.account_name ?? business.name,
            last_sync_error: message,
            provider_metadata: existingPayoutAccount?.provider_metadata ?? {},
            provider_settlement_bank_code: resolvedBankCode,
            provider_subaccount_code: existingPayoutAccount?.provider_subaccount_code ?? null,
            provider_subaccount_id: existingPayoutAccount?.provider_subaccount_id ?? null,
            status: "errored",
          },
          { onConflict: "business_id" },
        )
        .select("*")
        .single<PayoutAccountRow>();

      if (upsertResponse.error) {
        throw upsertResponse.error;
      }

      await safeInsertAuditLog({
        action: "marketplace.payout_account.sync_failed",
        adminClient,
        businessId: business.id,
        detail: {
          bank_name: bankName,
          error: message,
          provider: "paystack",
          resolved_bank_code: resolvedBankCode,
        },
        entityId: upsertResponse.data.id,
        summary: "Workspace payout account sync failed",
        userId: user.id,
      });

      const pendingSplitConfig = await markSplitConfigPendingResync({
        adminClient,
        businessId: business.id,
        nextPayoutAccountId: upsertResponse.data.id,
        nextProviderSubaccountCode: upsertResponse.data.provider_subaccount_code,
        reason: "The workspace payout destination failed Paystack sync. Fix the payout account and then re-save the Moniger fee rule from the platform admin payout tab before routed checkout can resume.",
        userId: user.id,
      });

      return json({
        ok: true,
        payoutAccount: mapPayoutAccount(upsertResponse.data),
        splitConfig: mapSplitConfig(pendingSplitConfig ?? await loadSplitConfig({ adminClient, businessId: business.id })),
        sync: {
          attempted: true,
          message,
          resolvedBankCode,
          status: "failed",
        },
      });
    }
  } catch (error) {
    console.error("workspace-payout-routing failed", error);
    return json(
      {
        error: error instanceof Error ? error.message : "The workspace payout routing request failed.",
      },
      500,
    );
  }
});
