import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { getAppBaseUrl } from "../_shared/paystack-subscriptions.ts";
import { verifyPaystackTransaction } from "../_shared/paystack.ts";

type FundingAction = "self.initialize-topup" | "self.verify-topup";

type FundingRequest =
    | {
      action: "self.initialize-topup";
      amount: number | string;
      businessId: string;
      payerName?: string | null;
      returnUrl?: string | null;
    }
  | {
      action: "self.verify-topup";
      reference: string;
    };

type BusinessContext = {
  defaultCurrency: string | null;
  id: string;
  name: string;
};

type WalletRow = {
  balance: number | null;
  business_id: string;
  currency: string | null;
  id: string;
  last_funded_at: string | null;
  reserved_balance: number | null;
};

type FundingSessionRow = {
  access_code: string | null;
  amount: number;
  business_id: string;
  callback_url: string;
  completed_at: string | null;
  created_at: string;
  created_by: string | null;
  currency: string;
  failure_reason: string | null;
  checkout_url: string;
  id: string;
  ledger_entry_id: string | null;
  payer_email: string;
  payer_name: string | null;
  provider: string;
  provider_metadata: Record<string, unknown>;
  provider_reference: string;
  status: string;
  updated_at: string;
  updated_by: string | null;
  verified_at: string | null;
  wallet_id: string;
};

type ApplyFundingCompletionResult = {
  applied: boolean;
  balance_after: number;
  balance_before: number;
  funding_session_id: string;
  ledger_entry_id: string | null;
  message: string | null;
  reserved_after: number;
  reserved_before: number;
  status: string;
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
const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsedValue = Number(value);
    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return null;
};
const toKobo = (amount: number) => Math.round(amount * 100);

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isUnsupportedPaystackEmail = (email: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1] ?? "";

  if (!domain) {
    return true;
  }

  return (
    domain === "localhost" ||
    domain.endsWith(".invalid") ||
    domain.endsWith(".local") ||
    domain.endsWith(".localhost") ||
    domain.endsWith(".test")
  );
};

const isAllowedReturnUrlOrigin = (candidateUrl: string, appBaseUrl: string) => {
  try {
    const parsedUrl = new URL(candidateUrl);
    const configuredOrigin = new URL(appBaseUrl).origin.replace(/\/$/, "");
    const candidateOrigin = parsedUrl.origin.replace(/\/$/, "");

    if (candidateOrigin === configuredOrigin) {
      return true;
    }

    return (
      parsedUrl.hostname === "localhost" ||
      parsedUrl.hostname === "127.0.0.1" ||
      parsedUrl.hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
};

const resolveWalletFundingReturnOrigin = (request: Request, candidateUrl?: string | null) => {
  const appBaseUrl = getAppBaseUrl(request);

  if (candidateUrl && isAllowedReturnUrlOrigin(candidateUrl, appBaseUrl)) {
    return new URL(candidateUrl).origin.replace(/\/$/, "");
  }

  return appBaseUrl.replace(/\/$/, "");
};

const createFundingReference = (businessId: string) => {
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
      : Math.random().toString(36).slice(2, 12).toUpperCase();
  return `WAL-${businessId.replace(/-/g, "").slice(0, 6).toUpperCase()}-${suffix}`;
};

const sendPaystackRequest = async <TPayload>(
  path: string,
  payload: Record<string, unknown>,
  paystackSecretKey: string,
) => {
  const response = await fetch(`https://api.paystack.co${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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

const loadManagedBusiness = async ({
  adminClient,
  businessId,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  userId: string;
}): Promise<BusinessContext | null> => {
  const membershipResponse = await adminClient
    .from("business_members")
    .select("business_id, role, status")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin"])
    .maybeSingle();

  if (membershipResponse.error) {
    throw membershipResponse.error;
  }

  if (!membershipResponse.data) {
    return null;
  }

  const businessResponse = await adminClient
    .from("businesses")
    .select("id, name, default_currency")
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
    id: asString(businessResponse.data.id),
    name: asString(businessResponse.data.name),
  };
};

const loadWallet = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
}): Promise<WalletRow | null> => {
  const response = await adminClient
    .from("workspace_wallets")
    .select("id, business_id, currency, balance, reserved_balance, last_funded_at")
    .eq("business_id", businessId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as WalletRow | null;
};

const loadFundingSessionByReference = async ({
  adminClient,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  reference: string;
}): Promise<FundingSessionRow | null> => {
  const response = await adminClient
    .from("workspace_wallet_funding_sessions")
    .select(
      "id, business_id, wallet_id, provider, amount, currency, status, provider_reference, checkout_url, callback_url, payer_email, payer_name, access_code, provider_metadata, failure_reason, verified_at, completed_at, ledger_entry_id, created_by, updated_by, created_at, updated_at",
    )
    .eq("provider_reference", reference)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as FundingSessionRow | null;
};

const applyFundingCompletion = async ({
  adminClient,
  amount,
  businessId,
  fundingSessionId,
  paidAt,
  payerName,
  payerEmail,
  providerMetadata,
  reference,
  walletId,
  currency,
  updatedBy,
}: {
  adminClient: ReturnType<typeof createClient>;
  amount: number;
  businessId: string;
  currency: string;
  fundingSessionId: string;
  paidAt: string;
  payerEmail: string;
  payerName: string | null;
  providerMetadata: Record<string, unknown>;
  reference: string;
  updatedBy: string | null;
  walletId: string;
}) => {
  const { data, error } = await adminClient.rpc("apply_wallet_funding_completion", {
    p_amount: amount,
    p_business_id: businessId,
    p_funding_session_id: fundingSessionId,
    p_paid_at: paidAt,
    p_provider_metadata: providerMetadata,
    p_reference: reference,
    p_updated_by: updatedBy,
    p_wallet_id: walletId,
    p_currency: currency,
  });

  if (error) {
    throw error;
  }

  return (Array.isArray(data) ? data[0] : data) as ApplyFundingCompletionResult | null;
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
    return json({ error: "Supabase environment variables are not configured for wallet funding." }, 500);
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
    return json({ error: "You need an active session before funding a workspace wallet." }, 401);
  }

  let payload: FundingRequest;
  try {
    payload = (await request.json()) as FundingRequest;
  } catch {
    return json({ error: "The wallet funding request body is invalid." }, 400);
  }

  if (payload.action !== "self.initialize-topup" && payload.action !== "self.verify-topup") {
    return json({ error: "Unsupported wallet funding action." }, 400);
  }

  const requestedBusinessId = payload.action === "self.initialize-topup" ? asString(payload.businessId) : "";
  const payerEmail = asNullableString(user.email)?.toLowerCase() ?? "";
  const payerName =
    asNullableString(user.user_metadata?.name) ??
    asNullableString(user.user_metadata?.full_name) ??
    null;
  const returnUrl = payload.action === "self.initialize-topup" ? asNullableString(payload.returnUrl) : null;

  try {
    if (payload.action === "self.initialize-topup") {
      const amount = asNumber(payload.amount);

      if (!requestedBusinessId) {
        return json({ error: "A business workspace is required before funding can be initialized." }, 400);
      }

      if (!amount || amount <= 0) {
        return json({ error: "Enter a wallet funding amount greater than zero." }, 400);
      }

      if (!isValidEmailAddress(payerEmail)) {
        return json({ error: "Your account needs a valid email address before starting wallet funding." }, 400);
      }

      if (isUnsupportedPaystackEmail(payerEmail)) {
        return json(
          {
            error:
              "Use a real email address for wallet funding. Paystack rejects test-only domains like .test and .local.",
          },
          400,
        );
      }

      if (!paystackSecretKey) {
        return json(
          {
            error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to your Supabase Edge Function secrets.",
          },
          500,
        );
      }

      const business = await loadManagedBusiness({
        adminClient,
        businessId: requestedBusinessId,
        userId: user.id,
      });

      if (!business) {
        return json({ error: "Only workspace owners and admins can fund this wallet." }, 403);
      }

      const wallet = await loadWallet({
        adminClient,
        businessId: business.id,
      });

      if (!wallet) {
        return json({ error: "We could not find a wallet for this workspace." }, 404);
      }

      const reference = createFundingReference(business.id);
      const returnOrigin = resolveWalletFundingReturnOrigin(request, returnUrl);
      const callbackUrl = `${returnOrigin}/wallet/confirmed?reference=${encodeURIComponent(reference)}`;
      const checkoutPayload = {
        amount: toKobo(amount),
        callback_url: callbackUrl,
        currency: wallet.currency ?? business.defaultCurrency ?? "NGN",
        email: payerEmail,
        metadata: {
          business_id: business.id,
          payer_email: payerEmail,
          payer_name: payerName ?? business.name,
          source: "workspace_wallet_funding",
          wallet_id: wallet.id,
        },
        reference,
      };

      const initializationPayload = await sendPaystackRequest<{
        data?: { access_code?: string; authorization_url?: string; reference?: string };
      }>("/transaction/initialize", checkoutPayload, paystackSecretKey);

      const authorizationUrl = initializationPayload.data?.authorization_url?.trim();
      const accessCode = initializationPayload.data?.access_code?.trim() ?? null;
      const resolvedReference = initializationPayload.data?.reference?.trim() || reference;

      if (!authorizationUrl) {
        return json({ error: "The payment provider did not return a checkout URL." }, 500);
      }

      const { data: fundingSession, error: fundingSessionError } = await adminClient
        .from("workspace_wallet_funding_sessions")
        .insert({
          access_code: accessCode,
          amount,
          business_id: business.id,
          callback_url: callbackUrl,
          checkout_url: authorizationUrl,
          currency: wallet.currency ?? business.defaultCurrency ?? "NGN",
          payer_email: payerEmail,
          payer_name: payerName ?? business.name,
          provider: "paystack",
          provider_metadata: {
            checkout_url: authorizationUrl,
            initialization_reference: resolvedReference,
            source: "workspace_wallet_funding",
          },
          provider_reference: resolvedReference,
          status: "initialized",
          wallet_id: wallet.id,
          created_by: user.id,
          updated_by: user.id,
        })
        .select(
          "id, business_id, wallet_id, provider, amount, currency, status, provider_reference, checkout_url, callback_url, payer_email, payer_name, access_code, provider_metadata, failure_reason, verified_at, completed_at, ledger_entry_id, created_by, updated_by, created_at, updated_at",
        )
        .single();

      if (fundingSessionError) {
        return json({ error: fundingSessionError.message }, 500);
      }

      const fundingSessionRow = fundingSession as FundingSessionRow;

      await adminClient
        .from("workspace_wallet_funding_sessions")
        .update({
          checkout_url: authorizationUrl,
          provider_metadata: {
            checkout_url: authorizationUrl,
            initialization_reference: resolvedReference,
            source: "workspace_wallet_funding",
          },
        })
        .eq("id", fundingSessionRow.id);

      return json({
        checkoutUrl: authorizationUrl,
        fundingSession: fundingSessionRow,
        ok: true,
        providerReference: resolvedReference,
      });
    }

    const reference = asString(payload.reference);
    if (!reference) {
      return json({ error: "Missing wallet funding reference." }, 400);
    }

    const fundingSession = await loadFundingSessionByReference({
      adminClient,
      reference,
    });

    if (!fundingSession) {
      return json({ error: "We could not find that wallet funding session." }, 404);
    }

    const business = await loadManagedBusiness({
      adminClient,
      businessId: fundingSession.business_id,
      userId: user.id,
    });

    if (!business) {
      return json({ error: "Only workspace owners and admins can verify wallet funding." }, 403);
    }

    const wallet = await loadWallet({
      adminClient,
      businessId: fundingSession.business_id,
    });

    if (!wallet) {
      return json({ error: "We could not find the workspace wallet." }, 404);
    }

    const providerVerification = await verifyPaystackTransaction(reference, paystackSecretKey);
    const providerStatus = asString(providerVerification.status).toLowerCase();
    const providerAmount = asNumber(providerVerification.amount);
    const providerCurrency = asString(providerVerification.currency).toUpperCase();
    const providerMetadata =
      providerVerification.metadata && typeof providerVerification.metadata === "object"
        ? (providerVerification.metadata as Record<string, unknown>)
        : {};

    if (providerStatus !== "success") {
      return json({
        applied: false,
        balanceAfter: wallet.balance ?? 0,
        balanceBefore: wallet.balance ?? 0,
        fundingSession,
        ledgerEntryId: fundingSession.ledger_entry_id,
        message: "Paystack has not confirmed this top-up yet.",
        ok: true,
        reservedAfter: wallet.reserved_balance ?? 0,
        reservedBefore: wallet.reserved_balance ?? 0,
        status: fundingSession.status,
      });
    }

    if (providerReferenceMismatch(reference, providerVerification)) {
      return json({ error: "The payment provider returned an unexpected wallet funding reference." }, 400);
    }

    if (providerCurrency && providerCurrency !== (wallet.currency ?? fundingSession.currency).toUpperCase()) {
      return json({ error: "The wallet funding currency does not match this workspace." }, 400);
    }

    if (providerAmount !== toKobo(fundingSession.amount)) {
      return json({ error: "The wallet funding amount does not match the checkout session." }, 400);
    }

    if (asString(providerMetadata.source) !== "workspace_wallet_funding") {
      return json({ error: "The wallet funding metadata could not be verified." }, 400);
    }

    if (asString(providerMetadata.business_id) !== fundingSession.business_id) {
      return json({ error: "The wallet funding business does not match this workspace." }, 400);
    }

    if (asString(providerMetadata.wallet_id) !== fundingSession.wallet_id) {
      return json({ error: "The wallet funding destination does not match this workspace wallet." }, 400);
    }

    const settlement = await applyFundingCompletion({
      adminClient,
      amount: fundingSession.amount,
      businessId: fundingSession.business_id,
      currency: fundingSession.currency,
      fundingSessionId: fundingSession.id,
      paidAt:
        typeof providerVerification.paid_at === "string" && providerVerification.paid_at.trim()
          ? providerVerification.paid_at
          : new Date().toISOString(),
      payerEmail: fundingSession.payer_email,
      payerName: fundingSession.payer_name,
      providerMetadata: {
        paystack_verification: providerVerification,
      },
      reference,
      updatedBy: user.id,
      walletId: fundingSession.wallet_id,
    });

    const updatedFundingSession = await loadFundingSessionByReference({
      adminClient,
      reference,
    });

      return json({
        applied: Boolean(settlement?.applied),
        balanceAfter: settlement?.balance_after ?? wallet.balance ?? 0,
        balanceBefore: settlement?.balance_before ?? wallet.balance ?? 0,
        fundingSession: updatedFundingSession ?? fundingSession,
        ledgerEntryId: settlement?.ledger_entry_id ?? fundingSession.ledger_entry_id,
        message:
          settlement?.message ??
          (settlement?.applied ? "Wallet funding confirmed." : "Wallet funding was already recorded."),
        ok: true,
        reservedAfter: settlement?.reserved_after ?? wallet.reserved_balance ?? 0,
        reservedBefore: settlement?.reserved_before ?? wallet.reserved_balance ?? 0,
      status: settlement?.status ?? fundingSession.status,
    });
  } catch (error) {
    console.error("workspace-wallet-funding error", error);
    return json(
      {
        error: error instanceof Error ? error.message : "The wallet funding handler failed.",
      },
      500,
    );
  }
});

const providerReferenceMismatch = (reference: string, verification: Record<string, unknown>) => {
  const providerReference = asString(verification.reference);
  return Boolean(providerReference) && providerReference !== reference;
};
