import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export type ManagedSubscriptionBillingCycle = "annual" | "free" | "manual" | "monthly";
export type ManagedSubscriptionPlan = "business" | "growth" | "starter";
export type LocalSubscriptionStatus = "active" | "cancelled" | "past_due" | "paused" | "trial";

export const buildSubscriptionPaymentFailureNotification = (plan: ManagedSubscriptionPlan) => ({
  body: `The ${plan} workspace subscription renewal could not be collected. Paid-plan features are paused until billing is updated.`,
  link: "/settings?tab=profile",
  title: "Subscription payment failed",
  type: "system" as const,
});

type SubscriptionDefaults = {
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  currency: string;
};

type PaystackPlanCatalogEntry = {
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  createdAt: string;
  currency: string;
  interval: "annually" | "monthly";
  planCode: string;
  planId: number | null;
};

type PaystackPlanCatalog = Record<string, PaystackPlanCatalogEntry>;

type ExistingSubscriptionRow = {
  amount?: unknown;
  billing_cycle?: unknown;
  cancel_at_period_end?: unknown;
  cancelled_at?: unknown;
  currency?: unknown;
  provider_customer_id?: unknown;
  provider_email_token?: unknown;
  provider_plan_code?: unknown;
  provider_subscription_id?: unknown;
  started_at?: unknown;
  status?: unknown;
};

type CheckoutSessionRow = {
  amount?: unknown;
  billing_cycle?: unknown;
  business_id?: unknown;
  currency?: unknown;
  payer_email?: unknown;
  payer_name?: unknown;
  plan?: unknown;
  provider_plan_code?: unknown;
};

type CanonicalSubscriptionSummary = {
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  currency: string;
  nextRenewalAt: string | null;
  paystackCustomerId: string | null;
  paystackEmailToken: string | null;
  paystackPlanCode: string | null;
  paystackSubscriptionId: string | null;
  startedAt: string;
  status: LocalSubscriptionStatus;
};

const defaultBillingCatalog: Record<ManagedSubscriptionPlan, SubscriptionDefaults> = {
  business: { amount: 89000, billingCycle: "monthly", currency: "NGN" },
  growth: { amount: 29000, billingCycle: "monthly", currency: "NGN" },
  starter: { amount: 0, billingCycle: "free", currency: "NGN" },
};

const paystackPlanCatalogConfigKey = "paystack_subscription_plan_catalog";

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

const isManagedSubscriptionPlan = (value: unknown): value is ManagedSubscriptionPlan =>
  value === "business" || value === "growth" || value === "starter";

export const normalizePlan = (value: unknown): ManagedSubscriptionPlan => {
  const candidate = asString(value);

  if (candidate === "business" || candidate === "growth") {
    return candidate;
  }

  return "starter";
};

export const normalizeBillingCycle = (value: unknown): ManagedSubscriptionBillingCycle => {
  const candidate = asString(value);

  if (candidate === "annual" || candidate === "free" || candidate === "manual") {
    return candidate;
  }

  return "monthly";
};

export const getDefaultSubscriptionConfig = (plan: ManagedSubscriptionPlan) =>
  defaultBillingCatalog[plan] ?? defaultBillingCatalog.starter;

export const getResolvedAmount = ({
  billingCycle,
  defaults,
}: {
  billingCycle: ManagedSubscriptionBillingCycle;
  defaults: SubscriptionDefaults;
}) => {
  if (billingCycle === "free") {
    return 0;
  }

  if (billingCycle === "annual") {
    return defaults.amount * 12;
  }

  return defaults.amount;
};

export const getNextRenewalAt = (billingCycle: ManagedSubscriptionBillingCycle, fromDate = new Date()) => {
  if (billingCycle === "free" || billingCycle === "manual") {
    return null;
  }

  const nextRenewal = new Date(fromDate);

  if (billingCycle === "annual") {
    nextRenewal.setUTCFullYear(nextRenewal.getUTCFullYear() + 1);
  } else {
    nextRenewal.setUTCMonth(nextRenewal.getUTCMonth() + 1);
  }

  return nextRenewal.toISOString();
};

export const getAppBaseUrl = (_request: Request) => {
  const configuredUrl = Deno.env.get("APP_BASE_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  throw new Error("APP_BASE_URL is required for Paystack checkout callbacks.");
};

export const createSubscriptionCheckoutReference = (plan: ManagedSubscriptionPlan) => {
  const planPrefix = plan.slice(0, 3).toUpperCase();
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()
      : Math.random().toString(36).slice(2, 12).toUpperCase();

  return `SUB-${planPrefix}-${suffix}`;
};

const toKobo = (amount: number) => Math.round(amount * 100);

const toPaystackPath = (path: string) => `https://api.paystack.co${path.startsWith("/") ? path : `/${path}`}`;

const sendPaystackRequest = async <TPayload>(
  path: string,
  method: "GET" | "POST",
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
    ...(method === "POST" ? { body: JSON.stringify(payload ?? {}) } : {}),
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

type PaystackPlanResponse = {
  data?: {
    amount?: number;
    id?: number;
    interval?: string;
    plan_code?: string;
    currency?: string;
  };
};

type PaystackSubscriptionRecord = {
  amount?: number | string;
  createdAt?: string;
  customer?: Record<string, unknown>;
  email_token?: string;
  next_payment_date?: string;
  plan?: Record<string, unknown>;
  status?: string;
  subscription_code?: string;
  updatedAt?: string;
};

type PaystackListSubscriptionsResponse = {
  data?: PaystackSubscriptionRecord[];
};

export const createPaystackPlan = async ({
  amount,
  billingCycle,
  currency,
  paystackSecretKey,
  plan,
}: {
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  currency: string;
  paystackSecretKey: string;
  plan: ManagedSubscriptionPlan;
}) => {
  const interval = billingCycle === "annual" ? "annually" : "monthly";
  const response = await sendPaystackRequest<PaystackPlanResponse>("/plan", "POST", paystackSecretKey, {
    amount: toKobo(amount),
    currency,
    description: `Moniger ${plan} workspace subscription (${billingCycle})`,
    interval,
    invoice_limit: 0,
    name: `Moniger ${plan} ${billingCycle}`,
    send_invoices: true,
    send_sms: false,
  });

  const planCode = asNullableString(response.data?.plan_code);
  if (!planCode) {
    throw new Error("Paystack did not return a plan code for this workspace tier.");
  }

  return {
    amount,
    billingCycle,
    createdAt: new Date().toISOString(),
    currency,
    interval,
    planCode,
    planId: asNumber(response.data?.id),
  } satisfies PaystackPlanCatalogEntry;
};

export const resolvePaystackPlanCatalogEntry = async ({
  adminClient,
  amount,
  billingCycle,
  currency,
  paystackSecretKey,
  plan,
}: {
  adminClient: ReturnType<typeof createClient>;
  amount: number;
  billingCycle: ManagedSubscriptionBillingCycle;
  currency: string;
  paystackSecretKey: string;
  plan: ManagedSubscriptionPlan;
}) => {
  const catalogKey = `${plan}:${billingCycle}`;
  const configResponse = await adminClient
    .from("platform_config")
    .select("value")
    .eq("key", paystackPlanCatalogConfigKey)
    .maybeSingle();

  if (configResponse.error) {
    throw configResponse.error;
  }

  const existingCatalog =
    configResponse.data?.value && typeof configResponse.data.value === "object"
      ? (configResponse.data.value as PaystackPlanCatalog)
      : {};
  const existingEntry = existingCatalog[catalogKey];
  const expectedInterval = billingCycle === "annual" ? "annually" : "monthly";

  if (
    existingEntry &&
    existingEntry.planCode &&
    existingEntry.amount === amount &&
    existingEntry.currency === currency &&
    existingEntry.interval === expectedInterval
  ) {
    return existingEntry;
  }

  const createdEntry = await createPaystackPlan({
    amount,
    billingCycle,
    currency,
    paystackSecretKey,
    plan,
  });

  const nextCatalog: PaystackPlanCatalog = {
    ...existingCatalog,
    [catalogKey]: createdEntry,
  };

  const upsertResponse = await adminClient.from("platform_config").upsert(
    {
      key: paystackPlanCatalogConfigKey,
      value: nextCatalog,
    },
    {
      onConflict: "key",
    },
  );

  if (upsertResponse.error) {
    throw upsertResponse.error;
  }

  return createdEntry;
};

export const initializePaystackSubscriptionCheckout = async ({
  amount,
  callbackUrl,
  currency,
  email,
  metadata,
  paystackPlanCode,
  paystackSecretKey,
  reference,
}: {
  amount: number;
  callbackUrl: string;
  currency: string;
  email: string;
  metadata: Record<string, unknown>;
  paystackPlanCode: string;
  paystackSecretKey: string;
  reference: string;
}) => {
  const response = await sendPaystackRequest<{
    data?: {
      access_code?: string;
      authorization_url?: string;
      reference?: string;
    };
  }>("/transaction/initialize", "POST", paystackSecretKey, {
    amount: toKobo(amount),
    callback_url: callbackUrl,
    currency,
    email,
    metadata,
    plan: paystackPlanCode,
    reference,
  });

  const authorizationUrl = asNullableString(response.data?.authorization_url);
  const resolvedReference = asNullableString(response.data?.reference) ?? reference;

  if (!authorizationUrl) {
    throw new Error("Paystack did not return a checkout URL for this workspace subscription.");
  }

  return {
    authorizationUrl,
    reference: resolvedReference,
  };
};

export const fetchPaystackSubscription = async ({
  paystackSecretKey,
  subscriptionCode,
}: {
  paystackSecretKey: string;
  subscriptionCode: string;
}) => {
  const response = await sendPaystackRequest<{ data?: PaystackSubscriptionRecord }>(
    `/subscription/${encodeURIComponent(subscriptionCode)}`,
    "GET",
    paystackSecretKey,
  );

  if (!response.data || typeof response.data !== "object") {
    throw new Error("Paystack returned an unexpected subscription response.");
  }

  return response.data;
};

export const listPaystackSubscriptions = async ({
  customerId,
  paystackSecretKey,
  planId,
}: {
  customerId?: number | null;
  paystackSecretKey: string;
  planId?: number | null;
}) => {
  const response = await sendPaystackRequest<PaystackListSubscriptionsResponse>(
    "/subscription",
    "GET",
    paystackSecretKey,
    {
      customer: customerId ?? undefined,
      page: 1,
      perPage: 50,
      plan: planId ?? undefined,
    },
  );

  return Array.isArray(response.data) ? response.data : [];
};

export const resolveCanonicalPaystackSubscription = async ({
  checkoutSession,
  paystackSecretKey,
  transactionVerification,
}: {
  checkoutSession: CheckoutSessionRow;
  paystackSecretKey: string;
  transactionVerification: Record<string, unknown>;
}) => {
  const transactionCustomer =
    transactionVerification.customer && typeof transactionVerification.customer === "object"
      ? (transactionVerification.customer as Record<string, unknown>)
      : {};
  const transactionPlan =
    transactionVerification.plan && typeof transactionVerification.plan === "object"
      ? (transactionVerification.plan as Record<string, unknown>)
      : {};
  const customerId = asNumber(transactionCustomer.id);
  const planId = asNumber(transactionPlan.id);
  const checkoutPlanCode = asNullableString(checkoutSession.provider_plan_code);
  const checkoutEmail = asNullableString(checkoutSession.payer_email)?.toLowerCase();
  const subscriptions = await listPaystackSubscriptions({
    customerId,
    paystackSecretKey,
    planId,
  });

  const matchingSubscription =
    subscriptions
      .filter((subscription) => {
        const subscriptionPlan =
          subscription.plan && typeof subscription.plan === "object"
            ? (subscription.plan as Record<string, unknown>)
            : {};
        const subscriptionCustomer =
          subscription.customer && typeof subscription.customer === "object"
            ? (subscription.customer as Record<string, unknown>)
            : {};
        const subscriptionPlanCode = asNullableString(subscriptionPlan.plan_code);
        const subscriptionEmail = asNullableString(subscriptionCustomer.email)?.toLowerCase();

        if (checkoutPlanCode && subscriptionPlanCode !== checkoutPlanCode) {
          return false;
        }

        if (checkoutEmail && subscriptionEmail && checkoutEmail !== subscriptionEmail) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftDate = Date.parse(asString(left.createdAt) || "");
        const rightDate = Date.parse(asString(right.createdAt) || "");
        return rightDate - leftDate;
      })[0] ?? null;

  const subscriptionCode = matchingSubscription ? asNullableString(matchingSubscription.subscription_code) : null;
  if (!subscriptionCode) {
    return null;
  }

  return fetchPaystackSubscription({
    paystackSecretKey,
    subscriptionCode,
  });
};

export const getSubscriptionCodeFromWebhookPayload = (eventData: Record<string, unknown>) => {
  const directSubscriptionCode = asNullableString(eventData.subscription_code);
  if (directSubscriptionCode) {
    return directSubscriptionCode;
  }

  const nestedSubscription =
    eventData.subscription && typeof eventData.subscription === "object"
      ? (eventData.subscription as Record<string, unknown>)
      : null;
  if (nestedSubscription) {
    return (
      asNullableString(nestedSubscription.subscription_code) ??
      asNullableString(nestedSubscription.code) ??
      asNullableString(nestedSubscription.subscription)
    );
  }

  return null;
};

export const getCanonicalSummaryFromPaystackSubscription = ({
  checkoutSession,
  existingSubscription,
  subscription,
}: {
  checkoutSession?: CheckoutSessionRow | null;
  existingSubscription?: ExistingSubscriptionRow | null;
  subscription: PaystackSubscriptionRecord;
}): CanonicalSubscriptionSummary => {
  const subscriptionCustomer =
    subscription.customer && typeof subscription.customer === "object"
      ? (subscription.customer as Record<string, unknown>)
      : {};
  const subscriptionPlan =
    subscription.plan && typeof subscription.plan === "object"
      ? (subscription.plan as Record<string, unknown>)
      : {};
  const paystackStatus = asString(subscription.status).toLowerCase();
  const paystackPlanInterval = asString(subscriptionPlan.interval).toLowerCase();
  const status =
    paystackStatus === "attention"
      ? "past_due"
      : paystackStatus.includes("disable") || paystackStatus === "completed" || paystackStatus === "cancelled"
        ? "cancelled"
        : paystackStatus.includes("renew")
          ? "active"
          : paystackStatus === "trial"
            ? "trial"
            : "active";
  const cancelAtPeriodEnd = paystackStatus.includes("renew");
  const paystackAmount = asNumber(subscription.amount);
  const existingAmount = asNumber(existingSubscription?.amount);
  const checkoutAmount = asNumber(checkoutSession?.amount);
  const amount = paystackAmount !== null ? paystackAmount / 100 : existingAmount ?? checkoutAmount ?? 0;
  const currency =
    asNullableString(subscriptionPlan.currency) ??
    asNullableString(existingSubscription?.currency) ??
    asNullableString(checkoutSession?.currency) ??
    "NGN";
  const billingCycle =
    paystackPlanInterval === "annually"
      ? "annual"
      : paystackPlanInterval === "monthly"
        ? "monthly"
        : normalizeBillingCycle(existingSubscription?.billing_cycle ?? checkoutSession?.billing_cycle);
  const startedAt =
    asNullableString(subscription.createdAt) ??
    asNullableString(existingSubscription?.started_at) ??
    new Date().toISOString();

  return {
    amount,
    billingCycle,
    cancelAtPeriodEnd,
    cancelledAt:
      status === "cancelled"
        ? asNullableString(subscription.updatedAt) ?? asNullableString(existingSubscription?.cancelled_at) ?? new Date().toISOString()
        : null,
    currency,
    nextRenewalAt: asNullableString(subscription.next_payment_date) ?? getNextRenewalAt(billingCycle),
    paystackCustomerId:
      asNullableString(subscriptionCustomer.customer_code) ??
      (asNumber(subscriptionCustomer.id) !== null ? String(asNumber(subscriptionCustomer.id)) : null) ??
      asNullableString(existingSubscription?.provider_customer_id),
    paystackEmailToken:
      asNullableString(subscription.email_token) ??
      asNullableString(existingSubscription?.provider_email_token),
    paystackPlanCode:
      asNullableString(subscriptionPlan.plan_code) ??
      asNullableString(existingSubscription?.provider_plan_code) ??
      asNullableString(checkoutSession?.provider_plan_code),
    paystackSubscriptionId:
      asNullableString(subscription.subscription_code) ??
      asNullableString(existingSubscription?.provider_subscription_id),
    startedAt,
    status,
  };
};

export const syncBusinessSubscriptionFromPaystack = async ({
  adminClient,
  businessId,
  checkoutSession,
  existingSubscription,
  plan,
  reference,
  subscription,
  updatedBy,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  checkoutSession?: CheckoutSessionRow | null;
  existingSubscription?: ExistingSubscriptionRow | null;
  plan: ManagedSubscriptionPlan;
  reference?: string | null;
  subscription: PaystackSubscriptionRecord;
  updatedBy: string | null;
}) => {
  const canonicalSummary = getCanonicalSummaryFromPaystackSubscription({
    checkoutSession,
    existingSubscription,
    subscription,
  });

  const upsertResponse = await adminClient.from("business_subscriptions").upsert({
    amount: canonicalSummary.amount,
    billing_cycle: canonicalSummary.billingCycle,
    business_id: businessId,
    cancel_at_period_end: canonicalSummary.cancelAtPeriodEnd,
    cancelled_at: canonicalSummary.cancelledAt,
    currency: canonicalSummary.currency,
    last_payment_reference: reference ?? null,
    next_renewal_at: canonicalSummary.nextRenewalAt,
    plan,
    provider: "paystack",
    provider_customer_id: canonicalSummary.paystackCustomerId,
    provider_email_token: canonicalSummary.paystackEmailToken,
    provider_plan_code: canonicalSummary.paystackPlanCode,
    provider_subscription_id: canonicalSummary.paystackSubscriptionId,
    started_at: canonicalSummary.startedAt,
    status: canonicalSummary.status,
    updated_by: updatedBy,
  });

  if (upsertResponse.error) {
    throw upsertResponse.error;
  }

  const businessOverrideResponse = await adminClient.from("business_admin_overrides").upsert({
    business_id: businessId,
    plan,
    updated_by: updatedBy,
  });

  if (businessOverrideResponse.error) {
    throw businessOverrideResponse.error;
  }

  return canonicalSummary;
};

export const disablePaystackSubscription = async ({
  emailToken,
  paystackSecretKey,
  subscriptionCode,
}: {
  emailToken: string;
  paystackSecretKey: string;
  subscriptionCode: string;
}) => {
  await sendPaystackRequest(
    "/subscription/disable",
    "POST",
    paystackSecretKey,
    {
      code: subscriptionCode,
      token: emailToken,
    },
  );
};

export const getPlanFromCheckoutSession = (checkoutSession: CheckoutSessionRow | null | undefined) => {
  const candidatePlan = checkoutSession?.plan;
  return isManagedSubscriptionPlan(candidatePlan) ? candidatePlan : normalizePlan(candidatePlan);
};
