import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyPaystackTransaction } from "../_shared/paystack.ts";
import {
  createSubscriptionCheckoutReference,
  disablePaystackSubscription,
  getAppBaseUrl,
  getDefaultSubscriptionConfig,
  getResolvedAmount,
  initializePaystackSubscriptionCheckout,
  normalizeBillingCycle,
  normalizePlan,
  resolveCanonicalPaystackSubscription,
  resolvePaystackPlanCatalogEntry,
  syncBusinessSubscriptionFromPaystack,
  type ManagedSubscriptionBillingCycle,
  type ManagedSubscriptionPlan,
} from "../_shared/paystack-subscriptions.ts";
import {
  getManagedSubscriptionSwitchKind,
  type ManagedSubscriptionSwitchKind,
} from "../_shared/paystack-subscription-switching.ts";
import { validatePaystackCheckout } from "../_shared/paystack-checkout-validation.ts";

type SubscriptionAction =
  | "public.confirmation-status"
  | "self.cancel"
  | "self.initialize-checkout"
  | "self.update"
  | "self.verify-checkout";

type SubscriptionRequest = {
  action: SubscriptionAction;
  billingCycle?: string | null;
  businessId?: string | null;
  plan?: string | null;
  reference?: string | null;
};

type BusinessContext = {
  defaultCurrency: string | null;
  id: string;
  name: string;
};

type ExistingSubscriptionRow = {
  amount: number | null;
  billing_cycle: string | null;
  cancel_at_period_end: boolean | null;
  cancelled_at: string | null;
  currency: string | null;
  last_payment_reference: string | null;
  next_renewal_at: string | null;
  plan: string | null;
  provider: string | null;
  provider_customer_id: string | null;
  provider_email_token: string | null;
  provider_plan_code: string | null;
  provider_subscription_id: string | null;
  started_at: string | null;
  status: string | null;
};

type CheckoutSessionRow = {
  amount: number | null;
  billing_cycle: string | null;
  business_id: string;
  currency: string | null;
  payer_email: string;
  payer_name: string | null;
  plan: string;
  provider_customer_id?: string | null;
  provider_plan_code: string | null;
  replacing_billing_cycle?: string | null;
  replacing_email_token?: string | null;
  replacing_plan?: string | null;
  replacing_subscription_id?: string | null;
  provider_subscription_id?: string | null;
  reference: string;
  status: string;
  switch_kind?: string | null;
  verified_at?: string | null;
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

const isWorkspaceManagerRole = (value: unknown) => {
  const candidate = asString(value);
  return candidate === "owner" || candidate === "admin";
};

const isManagedPaystackSubscription = (subscription: ExistingSubscriptionRow | null | undefined) =>
  subscription?.provider === "paystack" &&
  Boolean(subscription.provider_subscription_id) &&
  subscription.status !== "cancelled" &&
  subscription.status !== "paused";

const getCheckoutSwitchKind = ({
  billingCycle,
  existingSubscription,
  plan,
}: {
  billingCycle: ManagedSubscriptionBillingCycle;
  existingSubscription: ExistingSubscriptionRow | null | undefined;
  plan: ManagedSubscriptionPlan;
}): ManagedSubscriptionSwitchKind =>
  getManagedSubscriptionSwitchKind({
    currentBillingCycle: isManagedPaystackSubscription(existingSubscription)
      ? normalizeBillingCycle(existingSubscription?.billing_cycle)
      : null,
    currentPlan: isManagedPaystackSubscription(existingSubscription) ? normalizePlan(existingSubscription?.plan) : null,
    nextBillingCycle: billingCycle,
    nextPlan: plan,
  });

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
    }

    const ownedBusinessResponse = await adminClient
      .from("businesses")
      .select("id, name, default_currency")
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
      id: asString(ownedBusinessResponse.data.id),
      name: asString(ownedBusinessResponse.data.name),
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
      .select("id, name, default_currency")
      .eq("id", managedBusinessId)
      .maybeSingle();

    if (businessResponse.error) {
      throw businessResponse.error;
    }

    if (businessResponse.data) {
      return {
        defaultCurrency: asNullableString(businessResponse.data.default_currency),
        id: asString(businessResponse.data.id),
        name: asString(businessResponse.data.name),
      };
    }
  }

  const ownedBusinessResponse = await adminClient
    .from("businesses")
    .select("id, name, default_currency")
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
    id: asString(ownedBusinessResponse.data.id),
    name: asString(ownedBusinessResponse.data.name),
  };
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
  entityId: string;
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
      entity_type: "subscription",
      summary,
    });
  } catch (error) {
    console.error("Unable to record workspace subscription audit log", error);
  }
};

const loadExistingSubscription = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
}) => {
  const response = await adminClient
    .from("business_subscriptions")
    .select(
      "amount, billing_cycle, cancel_at_period_end, cancelled_at, currency, last_payment_reference, next_renewal_at, plan, provider, provider_customer_id, provider_email_token, provider_plan_code, provider_subscription_id, started_at, status",
    )
    .eq("business_id", businessId)
    .maybeSingle<ExistingSubscriptionRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadCheckoutSession = async ({
  adminClient,
  businessId,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  reference: string;
}) => {
  const response = await adminClient
    .from("subscription_checkout_sessions")
    .select(
      "amount, billing_cycle, business_id, currency, payer_email, payer_name, plan, provider_plan_code, reference, replacing_billing_cycle, replacing_email_token, replacing_plan, replacing_subscription_id, status, switch_kind",
    )
    .eq("business_id", businessId)
    .eq("reference", reference)
    .maybeSingle<CheckoutSessionRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadCheckoutSessionByReference = async ({
  adminClient,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  reference: string;
}) => {
  const response = await adminClient
    .from("subscription_checkout_sessions")
    .select(
      "amount, billing_cycle, business_id, currency, payer_email, payer_name, plan, provider_customer_id, provider_plan_code, provider_subscription_id, reference, replacing_billing_cycle, replacing_email_token, replacing_plan, replacing_subscription_id, status, switch_kind, verified_at",
    )
    .eq("reference", reference)
    .maybeSingle<CheckoutSessionRow>();

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
  businessId: string;
}): Promise<BusinessContext | null> => {
  const response = await adminClient
    .from("businesses")
    .select("id, name, default_currency")
    .eq("id", businessId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  if (!response.data) {
    return null;
  }

  return {
    defaultCurrency: asNullableString(response.data.default_currency),
    id: asString(response.data.id),
    name: asString(response.data.name),
  };
};

const upsertCheckoutSession = async ({
  adminClient,
  amount,
  billingCycle,
  businessId,
  checkoutUrl,
  currency,
  payerEmail,
  payerName,
  plan,
  providerPlanCode,
  reference,
  replacingBillingCycle,
  replacingEmailToken,
  replacingPlan,
  replacingSubscriptionId,
  switchKind,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  businessId: string;
  checkoutUrl: string;
  currency: string;
  payerEmail: string;
  payerName: string | null;
  plan: ManagedSubscriptionPlan;
  providerPlanCode: string;
  reference: string;
  replacingBillingCycle?: ManagedSubscriptionBillingCycle | null;
  replacingEmailToken?: string | null;
  replacingPlan?: ManagedSubscriptionPlan | null;
  replacingSubscriptionId?: string | null;
  switchKind: ManagedSubscriptionSwitchKind;
  userId: string;
}) => {
  const response = await adminClient.from("subscription_checkout_sessions").upsert(
    {
      amount,
      billing_cycle: billingCycle,
      business_id: businessId,
      checkout_url: checkoutUrl,
      currency,
      initiated_by: userId,
      payer_email: payerEmail,
      payer_name: payerName,
      plan,
      provider: "paystack",
      provider_plan_code: providerPlanCode,
      reference,
      replacing_billing_cycle: replacingBillingCycle ?? null,
      replacing_email_token: replacingEmailToken ?? null,
      replacing_plan: replacingPlan ?? null,
      replacing_subscription_id: replacingSubscriptionId ?? null,
      status: "initialized",
      switch_kind: switchKind,
    },
    {
      onConflict: "reference",
    },
  );

  if (response.error) {
    throw response.error;
  }
};

const markCheckoutSession = async ({
  adminClient,
  providerCustomerId,
  providerSubscriptionId,
  reference,
  status,
  verificationError,
  verifiedAt,
}: {
  adminClient: ReturnType<typeof createClient>;
  providerCustomerId?: string | null;
  providerSubscriptionId?: string | null;
  reference: string;
  status: "completed" | "failed" | "initialized";
  verificationError?: string | null;
  verifiedAt?: string | null;
}) => {
  const response = await adminClient.from("subscription_checkout_sessions").update({
    last_error: verificationError ?? null,
    provider_customer_id: providerCustomerId ?? null,
    provider_subscription_id: providerSubscriptionId ?? null,
    status,
    verified_at: verifiedAt ?? null,
  }).eq("reference", reference);

  if (response.error) {
    throw response.error;
  }
};

const buildActivatedResponse = ({
  amount,
  billingCycle,
  business,
  nextRenewalAt,
  plan,
  provider,
  reference,
  status,
}: {
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  business: BusinessContext;
  nextRenewalAt: string | null;
  plan: ManagedSubscriptionPlan;
  provider: string;
  reference?: string | null;
  status: string;
}) => ({
  kind: "activated",
  ok: true,
  subscription: {
    amount,
    billingCycle,
    businessId: business.id,
    businessName: business.name,
    nextRenewalAt,
    plan,
    provider,
    reference: reference ?? null,
    status,
  },
});

const buildCheckoutResponse = ({
  authorizationUrl,
  reference,
}: {
  authorizationUrl: string;
  reference: string;
}) => ({
  authorizationUrl,
  kind: "checkout",
  ok: true,
  reference,
});

const buildVerifiedResponse = ({
  amount,
  billingCycle,
  business,
  nextRenewalAt,
  plan,
  provider,
  reference,
  status,
}: {
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  business: BusinessContext;
  nextRenewalAt: string | null;
  plan: ManagedSubscriptionPlan;
  provider: string;
  reference: string;
  status: string;
}) => ({
  kind: "verified",
  ok: true,
  subscription: {
    amount,
    billingCycle,
    businessId: business.id,
    businessName: business.name,
    nextRenewalAt,
    plan,
    provider,
    reference,
    status,
  },
});

const buildPublicConfirmationResponse = ({
  billingCycle,
  plan,
  reference,
  status,
}: {
  billingCycle: ManagedSubscriptionBillingCycle;
  plan: ManagedSubscriptionPlan;
  reference: string;
  status: "completed" | "failed" | "initialized";
}) => ({
  confirmation: {
    billingCycle,
    plan,
    reference,
    status,
  },
  kind: "public_status",
  ok: true,
});

const finalizeSubscriptionReplacement = async ({
  checkoutSession,
  paystackSecretKey,
  providerSubscriptionId,
}: {
  checkoutSession: CheckoutSessionRow;
  paystackSecretKey: string;
  providerSubscriptionId: string | null;
}) => {
  const replacingSubscriptionId = asNullableString(checkoutSession.replacing_subscription_id);
  const replacingEmailToken = asNullableString(checkoutSession.replacing_email_token);

  if (!replacingSubscriptionId || !replacingEmailToken) {
    return {
      replacedPreviousSubscription: false,
      replacingSubscriptionId: null,
    };
  }

  if (providerSubscriptionId && providerSubscriptionId === replacingSubscriptionId) {
    return {
      replacedPreviousSubscription: false,
      replacingSubscriptionId,
    };
  }

  await disablePaystackSubscription({
    emailToken: replacingEmailToken,
    paystackSecretKey,
    subscriptionCode: replacingSubscriptionId,
  });

  return {
    replacedPreviousSubscription: true,
    replacingSubscriptionId,
  };
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
    return json({ error: "Supabase environment variables are not configured for workspace subscriptions." }, 500);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let payload: SubscriptionRequest;
  try {
    payload = (await request.json()) as SubscriptionRequest;
  } catch {
    return json({ error: "The workspace subscription request body is invalid." }, 400);
  }

  if (
    payload.action !== "public.confirmation-status" &&
    payload.action !== "self.cancel" &&
    payload.action !== "self.initialize-checkout" &&
    payload.action !== "self.update" &&
    payload.action !== "self.verify-checkout"
  ) {
    return json({ error: "Unsupported workspace subscription action." }, 400);
  }

  if (payload.action === "public.confirmation-status") {
    const reference = asNullableString(payload.reference);
    if (!reference) {
      return json({ error: "Missing Paystack checkout reference." }, 400);
    }

    try {
      const checkoutSession = await loadCheckoutSessionByReference({
        adminClient,
        reference,
      });

      if (!checkoutSession) {
        return json({ error: "We could not find that workspace subscription checkout session." }, 404);
      }
      const normalizedStatus = asString(checkoutSession.status);
      const publicStatus: "completed" | "failed" | "initialized" =
        normalizedStatus === "completed"
          ? "completed"
          : normalizedStatus === "failed"
            ? "failed"
            : "initialized";

      return json(
        buildPublicConfirmationResponse({
          billingCycle: normalizeBillingCycle(checkoutSession.billing_cycle),
          plan: normalizePlan(checkoutSession.plan),
          reference,
          status: publicStatus,
        }),
      );
    } catch (error) {
      console.error("workspace-subscriptions public confirmation error", error);
      return json(
        {
          error: error instanceof Error ? error.message : "We could not confirm this workspace subscription.",
        },
        500,
      );
    }
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

  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "You need an active session before updating workspace subscriptions." }, 401);
  }

  const requestedBusinessId = asNullableString(payload.businessId);

  try {
    let authoritativeCheckoutSession: CheckoutSessionRow | null = null;
    if (payload.action === "self.verify-checkout") {
      const reference = asNullableString(payload.reference);
      if (!reference) {
        return json({ error: "Missing Paystack checkout reference." }, 400);
      }
      authoritativeCheckoutSession = await loadCheckoutSessionByReference({ adminClient, reference });
      if (!authoritativeCheckoutSession) {
        return json({ error: "We could not find that workspace subscription checkout session." }, 404);
      }
      if (requestedBusinessId && requestedBusinessId !== authoritativeCheckoutSession.business_id) {
        return json({ error: "The checkout belongs to a different workspace.", code: "CHECKOUT_WORKSPACE_MISMATCH", retryable: false }, 409);
      }
    }

    const business = await findManagedBusiness({
      adminClient,
      businessId: authoritativeCheckoutSession?.business_id ?? requestedBusinessId,
      userId: user.id,
    });

    if (!business) {
      return json(
        {
          error: requestedBusinessId
            ? "Only workspace owners and admins can update this subscription."
            : "A business workspace is required before you can update your subscription.",
          code: authoritativeCheckoutSession ? "CHECKOUT_WORKSPACE_FORBIDDEN" : undefined,
        },
        requestedBusinessId || authoritativeCheckoutSession ? 403 : 404,
      );
    }

    const plan = normalizePlan(payload.plan);
    const defaults = getDefaultSubscriptionConfig(plan);
    const billingCycle = normalizeBillingCycle(payload.billingCycle || defaults.billingCycle);
    const amount = getResolvedAmount({ billingCycle, defaults });
    const existingSubscription = await loadExistingSubscription({
      adminClient,
      businessId: business.id,
    });
    const payerEmail = asNullableString(user.email)?.toLowerCase() ?? null;
    const payerName =
      asNullableString(user.user_metadata?.name) ??
      asNullableString(user.user_metadata?.full_name) ??
      business.name;

    if (payload.action === "self.cancel") {
      if (!isManagedPaystackSubscription(existingSubscription)) {
        return json({ error: "This workspace does not have an active Paystack subscription to cancel." }, 409);
      }

      if (!paystackSecretKey) {
        return json({ error: "Paystack is not configured yet." }, 500);
      }

      if (!existingSubscription.provider_email_token || !existingSubscription.provider_subscription_id) {
        return json({ error: "This workspace is missing the Paystack subscription token needed to stop renewal safely." }, 409);
      }

      await disablePaystackSubscription({
        emailToken: existingSubscription.provider_email_token,
        paystackSecretKey,
        subscriptionCode: existingSubscription.provider_subscription_id,
      });

      const cancellationResponse = await adminClient
        .from("business_subscriptions")
        .update({ cancel_at_period_end: true, updated_by: user.id })
        .eq("business_id", business.id);

      if (cancellationResponse.error) {
        throw cancellationResponse.error;
      }

      await safeInsertAuditLog({
        action: "subscription.self_service_cancel_requested",
        adminClient,
        businessId: business.id,
        detail: {
          cancel_at_period_end: true,
          next_renewal_at: existingSubscription.next_renewal_at,
          plan: existingSubscription.plan,
          provider: "paystack",
        },
        entityId: business.id,
        summary: "Workspace subscription cancellation requested",
        userId: user.id,
      });

      return json(
        buildActivatedResponse({
          amount: existingSubscription.amount ?? 0,
          billingCycle: normalizeBillingCycle(existingSubscription.billing_cycle),
          business,
          nextRenewalAt: existingSubscription.next_renewal_at,
          plan: normalizePlan(existingSubscription.plan),
          provider: "paystack",
          reference: existingSubscription.last_payment_reference,
          status: existingSubscription.status ?? "active",
        }),
      );
    }

    if (payload.action === "self.initialize-checkout") {
      if (plan === "starter" || billingCycle === "free" || billingCycle === "manual") {
        return json({ error: "Use the direct subscription update action for free or manual plans." }, 400);
      }

      if (!payerEmail) {
        return json({ error: "Your account needs a valid email address before starting subscription checkout." }, 400);
      }

      if (isUnsupportedPaystackEmail(payerEmail)) {
        return json(
          {
            error:
              "Use a real email address for paid subscriptions. Paystack rejects test-only domains like .test and .local.",
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

      const switchKind = getCheckoutSwitchKind({
        billingCycle,
        existingSubscription,
        plan,
      });
      const isReplacingManagedPaystackSubscription = isManagedPaystackSubscription(existingSubscription);

      if (isReplacingManagedPaystackSubscription) {
        const existingPlan = normalizePlan(existingSubscription?.plan);
        const existingBillingCycle = normalizeBillingCycle(existingSubscription?.billing_cycle);

        if (switchKind === "current") {
          return json(
            buildActivatedResponse({
              amount: existingSubscription.amount ?? amount,
              billingCycle: existingBillingCycle,
              business,
              nextRenewalAt: existingSubscription.next_renewal_at ?? null,
              plan,
              provider: "paystack",
              reference: existingSubscription.last_payment_reference,
              status: existingSubscription.status ?? "active",
            }),
          );
        }

        if (!existingSubscription.provider_email_token) {
          return json(
            {
              error:
                "This workspace is missing the Paystack subscription token needed to replace recurring billing safely.",
            },
            409,
          );
        }
      }

      const subscriptionCurrency = existingSubscription?.currency ?? business.defaultCurrency ?? defaults.currency;
      const paystackPlan = await resolvePaystackPlanCatalogEntry({
        adminClient,
        amount,
        billingCycle,
        currency: subscriptionCurrency,
        paystackSecretKey,
        plan,
      });
      const reference = createSubscriptionCheckoutReference(plan);
      const callbackUrl = `${getAppBaseUrl(request)}/pricing/confirmed`;
      const checkout = await initializePaystackSubscriptionCheckout({
        amount,
        callbackUrl,
        currency: subscriptionCurrency,
        email: payerEmail,
        metadata: {
          billing_cycle: billingCycle,
          business_id: business.id,
          business_name: business.name,
          initiated_by: user.id,
          payer_email: payerEmail,
          payer_name: payerName,
          plan,
          provider_plan_code: paystackPlan.planCode,
          source: "workspace_subscription",
        },
        paystackPlanCode: paystackPlan.planCode,
        paystackSecretKey,
        reference,
      });

      await upsertCheckoutSession({
        adminClient,
        amount,
        billingCycle,
        businessId: business.id,
        checkoutUrl: checkout.authorizationUrl,
        currency: subscriptionCurrency,
        payerEmail,
        payerName,
        plan,
        providerPlanCode: paystackPlan.planCode,
        reference: checkout.reference,
        replacingBillingCycle: isReplacingManagedPaystackSubscription
          ? normalizeBillingCycle(existingSubscription?.billing_cycle)
          : null,
        replacingEmailToken: isReplacingManagedPaystackSubscription
          ? existingSubscription?.provider_email_token ?? null
          : null,
        replacingPlan: isReplacingManagedPaystackSubscription ? normalizePlan(existingSubscription?.plan) : null,
        replacingSubscriptionId: isReplacingManagedPaystackSubscription
          ? existingSubscription?.provider_subscription_id ?? null
          : null,
        switchKind,
        userId: user.id,
      });

      // Keep the selected paid plan pending until Paystack verification succeeds.
      // This prevents a new Growth/Business workspace from inheriting the
      // Starter access state while checkout is still unpaid. When replacing an
      // existing managed Paystack subscription, the old active subscription
      // remains usable until the replacement is verified.
      if (!isReplacingManagedPaystackSubscription) {
        const pendingSubscriptionResponse = await adminClient.from("business_subscriptions").upsert({
          amount,
          billing_cycle: billingCycle,
          business_id: business.id,
          cancel_at_period_end: false,
          cancelled_at: null,
          currency: subscriptionCurrency,
          expired_at: null,
          last_payment_reference: null,
          next_renewal_at: null,
          plan,
          provider: "paystack",
          provider_customer_id: null,
          provider_email_token: null,
          provider_plan_code: paystackPlan.planCode,
          provider_subscription_id: null,
          started_at: existingSubscription?.started_at ?? new Date().toISOString(),
          status: "paused",
          updated_by: user.id,
        });

        if (pendingSubscriptionResponse.error) {
          throw pendingSubscriptionResponse.error;
        }
      }

      await safeInsertAuditLog({
        action: "subscription.checkout_initialized",
        adminClient,
        businessId: business.id,
        detail: {
          amount,
          billing_cycle: billingCycle,
          plan,
          provider: "paystack",
          reference: checkout.reference,
          replacing_subscription_id: isReplacingManagedPaystackSubscription
            ? existingSubscription?.provider_subscription_id ?? null
            : null,
          switch_kind: switchKind,
        },
        entityId: business.id,
        summary:
          switchKind === "new_checkout"
            ? "Workspace subscription checkout initialized"
            : `Workspace subscription ${switchKind.replace(/_/g, " ")} checkout initialized`,
        userId: user.id,
      });

      return json(
        buildCheckoutResponse({
          authorizationUrl: checkout.authorizationUrl,
          reference: checkout.reference,
        }),
      );
    }

    if (payload.action === "self.verify-checkout") {
      if (!paystackSecretKey) {
        return json({ error: "Paystack is not configured yet." }, 500);
      }

      const reference = asNullableString(payload.reference);
      if (!reference) {
        return json({ error: "Missing Paystack checkout reference." }, 400);
      }

      const checkoutSession = authoritativeCheckoutSession ?? await loadCheckoutSession({ adminClient, businessId: business.id, reference });

      if (!checkoutSession) {
        return json({ error: "We could not find that workspace subscription checkout session." }, 404);
      }

      const transactionVerification = await verifyPaystackTransaction(reference, paystackSecretKey);
      const providerStatus = asString(transactionVerification.status).toLowerCase();

      if (providerStatus !== "success") {
        await markCheckoutSession({
          adminClient,
          reference,
          status: "initialized",
          verificationError: "The Paystack transaction is not marked as successful yet.",
        });
        return json({ error: "Payment verification is still pending. Try again in a moment.", code: "CHECKOUT_PENDING", retryable: true }, 409);
      }

      const canonicalSubscription = await resolveCanonicalPaystackSubscription({
        checkoutSession,
        paystackSecretKey,
        transactionVerification,
      });

      if (!canonicalSubscription) {
        await markCheckoutSession({
          adminClient,
          reference,
          status: "initialized",
          verificationError: "No Paystack subscription record could be resolved for this completed checkout.",
        });
        return json(
          {
            error: "The checkout payment succeeded, but provider subscription details are still pending. Try again in a moment.",
            code: "PROVIDER_PENDING",
            retryable: true,
          },
          409,
        );
      }

      const transaction = transactionVerification as Record<string, unknown>;
      const providerPlan = transaction.plan && typeof transaction.plan === "object" ? transaction.plan as Record<string, unknown> : null;
      const canonicalPlan = canonicalSubscription.plan && typeof canonicalSubscription.plan === "object"
        ? canonicalSubscription.plan as Record<string, unknown>
        : null;
      const validation = validatePaystackCheckout({
        canonicalPlanCode: asNullableString(canonicalPlan?.plan_code),
        expectedAmountKobo: checkoutSession.amount === null ? null : Math.round(checkoutSession.amount * 100),
        expectedCurrency: asNullableString(checkoutSession.currency),
        expectedPlanCode: asNullableString(checkoutSession.provider_plan_code),
        providerAmount: asNumber(transaction.amount),
        providerCurrency: asNullableString(transaction.currency),
        transactionPlanCode: asNullableString(providerPlan?.plan_code),
      });
      if (!validation.ok) {
        return json({ error: "The payment does not match the selected workspace subscription.", code: validation.code, retryable: false }, 409);
      }

      const canonicalSummary = await syncBusinessSubscriptionFromPaystack({
        adminClient,
        businessId: business.id,
        checkoutSession,
        existingSubscription,
        plan: normalizePlan(checkoutSession.plan),
        reference,
        subscription: canonicalSubscription,
        updatedBy: user.id,
      });

      const replacementResult = await finalizeSubscriptionReplacement({
        checkoutSession,
        paystackSecretKey,
        providerSubscriptionId: canonicalSummary.paystackSubscriptionId,
      });

      await markCheckoutSession({
        adminClient,
        providerCustomerId: canonicalSummary.paystackCustomerId,
        providerSubscriptionId: canonicalSummary.paystackSubscriptionId,
        reference,
        status: "completed",
        verifiedAt: new Date().toISOString(),
      });

      await safeInsertAuditLog({
        action: "subscription.checkout_verified",
        adminClient,
        businessId: business.id,
        detail: {
          amount: canonicalSummary.amount,
          billing_cycle: canonicalSummary.billingCycle,
          plan: normalizePlan(checkoutSession.plan),
          provider: "paystack",
          provider_subscription_id: canonicalSummary.paystackSubscriptionId,
          reference,
          replaced_previous_subscription: replacementResult.replacedPreviousSubscription,
          replacing_subscription_id: replacementResult.replacingSubscriptionId,
          switch_kind: asNullableString(checkoutSession.switch_kind) ?? "new_checkout",
        },
        entityId: business.id,
        summary: "Workspace subscription activated from Paystack checkout",
        userId: user.id,
      });

      return json(
        buildVerifiedResponse({
          amount: canonicalSummary.amount,
          billingCycle: canonicalSummary.billingCycle,
          business,
          nextRenewalAt: canonicalSummary.nextRenewalAt,
          plan: normalizePlan(checkoutSession.plan),
          provider: "paystack",
          reference,
          status: canonicalSummary.status,
        }),
      );
    }

    if (plan !== "starter" && billingCycle !== "free" && billingCycle !== "manual") {
      return json(
        {
          error: "Paid workspace plans now require Paystack checkout. Initialize a checkout session before activating this plan.",
        },
        400,
      );
    }

    if (
      plan === "starter" &&
      existingSubscription?.provider === "paystack" &&
      existingSubscription.provider_subscription_id &&
      existingSubscription.status !== "cancelled"
    ) {
      if (!paystackSecretKey) {
        return json(
          {
            error: "Paystack must be configured before downgrading an active paid workspace subscription.",
          },
          500,
        );
      }

      if (!existingSubscription.provider_email_token) {
        return json(
          {
            error: "This workspace is missing the Paystack subscription token needed to stop recurring billing safely.",
          },
          409,
        );
      }

      await disablePaystackSubscription({
        emailToken: existingSubscription.provider_email_token,
        paystackSecretKey,
        subscriptionCode: existingSubscription.provider_subscription_id,
      });
    }

    const subscriptionCurrency = existingSubscription?.currency ?? business.defaultCurrency ?? defaults.currency;
    const nextRenewalAt = billingCycle === "free" || billingCycle === "manual" ? null : null;
    const subscriptionUpdateResponse = await adminClient.from("business_subscriptions").upsert({
      amount,
      billing_cycle: billingCycle,
      business_id: business.id,
      cancel_at_period_end: false,
      cancelled_at: null,
      currency: subscriptionCurrency,
      expired_at: null,
      last_payment_reference: null,
      next_renewal_at: nextRenewalAt,
      plan,
      provider: billingCycle === "manual" ? "manual" : "manual",
      provider_customer_id: null,
      provider_email_token: null,
      provider_plan_code: null,
      provider_subscription_id: null,
      started_at: existingSubscription?.started_at ?? new Date().toISOString(),
      status: "active",
      updated_by: user.id,
    });

    if (subscriptionUpdateResponse.error) {
      throw subscriptionUpdateResponse.error;
    }

    const businessOverrideResponse = await adminClient.from("business_admin_overrides").upsert({
      business_id: business.id,
      plan,
      updated_by: user.id,
    });

    if (businessOverrideResponse.error) {
      throw businessOverrideResponse.error;
    }

    await safeInsertAuditLog({
      action: "subscription.self_service_updated",
      adminClient,
      businessId: business.id,
      detail: {
        amount,
        billing_cycle: billingCycle,
        description: `${business.name} updated its workspace subscription to the ${plan} plan.`,
        plan,
        provider: "manual",
      },
      entityId: business.id,
      summary: "Workspace subscription updated",
      userId: user.id,
    });

    return json(
      buildActivatedResponse({
        amount,
        billingCycle,
        business,
        nextRenewalAt,
        plan,
        provider: "manual",
        status: "active",
      }),
    );
  } catch (error) {
    console.error("workspace-subscriptions error", error);
    const errorMessage = error instanceof Error ? error.message : "The workspace subscription request failed.";
    const normalizedErrorMessage = errorMessage.toLowerCase();
    return json(
      {
        error: errorMessage,
      },
      normalizedErrorMessage.includes("invalid email address")
        ? 400
        : 500,
    );
  }
});
