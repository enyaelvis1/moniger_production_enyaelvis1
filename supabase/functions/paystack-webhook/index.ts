import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { recordFinanceAuditLog } from "../_shared/finance-audit.ts";
import { notifyFinanceUsers } from "../_shared/finance-notifications.ts";
import { deliverPaymentReceipt } from "../_shared/payment-receipts.ts";
import {
  fetchInvoiceContextByInvoiceId,
  fetchInvoiceContextByPaymentToken,
  fetchLinkedPayment,
  settleInvoicePaystackPayment,
  validateVerifiedPaystackPayment,
  verifyPaystackTransaction,
} from "../_shared/paystack.ts";
import {
  fetchPaystackSubscription,
  buildSubscriptionPaymentFailureNotification,
  getCanonicalSummaryFromPaystackSubscription,
  getSubscriptionCodeFromWebhookPayload,
  normalizePlan,
  resolveCanonicalPaystackSubscription,
  syncBusinessSubscriptionFromPaystack,
  type ManagedSubscriptionPlan,
} from "../_shared/paystack-subscriptions.ts";
import { disablePaystackSubscription } from "../_shared/paystack-subscriptions.ts";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

const isValidUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const createWebhookSignature = async (body: string, secret: string) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    {
      hash: "SHA-512",
      name: "HMAC",
    },
    false,
    ["sign"],
  );

  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
};

const verifyWebhookSignature = async (body: string, providedSignature: string | null, secret: string) => {
  if (!providedSignature?.trim()) {
    return false;
  }

  const expectedSignature = await createWebhookSignature(body, secret);
  return expectedSignature === providedSignature.trim().toLowerCase();
};

const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const asNullableString = (value: unknown) => {
  const normalizedValue = asString(value);
  return normalizedValue || null;
};

const recordPayoutAuditLog = async ({
  action,
  adminClient,
  businessId,
  detail = {},
  entityId,
  summary,
}: {
  action: string;
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  detail?: Record<string, unknown>;
  entityId: string;
  summary: string;
}) =>
  recordFinanceAuditLog({
    action,
    adminClient,
    businessId,
    detail,
    entityId,
    entityType: "payout",
    summary,
  });

type PaystackWebhookEvent = {
  data?: Record<string, unknown>;
  event?: string;
};

type ExistingSubscriptionRow = {
  amount: number | null;
  billing_cycle: string | null;
  business_id: string;
  cancel_at_period_end: boolean | null;
  cancelled_at: string | null;
  currency: string | null;
  plan: string | null;
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
  payer_email: string;
  payer_name: string | null;
  plan: string;
  provider_plan_code: string | null;
  replacing_email_token?: string | null;
  replacing_subscription_id?: string | null;
  reference: string;
  status: string;
  switch_kind?: string | null;
};

type WalletFundingSessionRow = {
  amount: number;
  business_id: string;
  completed_at: string | null;
  currency: string;
  failure_reason: string | null;
  id: string;
  ledger_entry_id: string | null;
  payer_email: string;
  payer_name: string | null;
  provider_reference: string;
  status: string;
  wallet_id: string;
};

type WorkspacePayoutRow = {
  amount: number;
  bill_id: string | null;
  business_id: string;
  id: string;
  provider_reference: string | null;
  provider_transfer_code: string | null;
  provider_metadata: Record<string, unknown> | null;
  status: string;
  wallet_id: string;
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
      "amount, billing_cycle, business_id, cancel_at_period_end, cancelled_at, currency, plan, provider_customer_id, provider_email_token, provider_plan_code, provider_subscription_id, started_at, status",
    )
    .eq("business_id", businessId)
    .maybeSingle<ExistingSubscriptionRow>();

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
      "amount, billing_cycle, business_id, payer_email, payer_name, plan, provider_plan_code, reference, replacing_email_token, replacing_subscription_id, status, switch_kind",
    )
    .eq("reference", reference)
    .maybeSingle<CheckoutSessionRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadWalletFundingSessionByReference = async ({
  adminClient,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  reference: string;
}) => {
  const response = await adminClient
    .from("workspace_wallet_funding_sessions")
    .select("amount, business_id, completed_at, currency, failure_reason, id, ledger_entry_id, payer_email, payer_name, provider_reference, status, wallet_id")
    .eq("provider_reference", reference)
    .maybeSingle<WalletFundingSessionRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadCheckoutSessionBySubscriptionMatch = async ({
  adminClient,
  payerEmail,
  planCode,
}: {
  adminClient: ReturnType<typeof createClient>;
  payerEmail: string | null;
  planCode: string | null;
}) => {
  if (!payerEmail || !planCode) {
    return null;
  }

  const response = await adminClient
    .from("subscription_checkout_sessions")
    .select(
      "amount, billing_cycle, business_id, payer_email, payer_name, plan, provider_plan_code, reference, replacing_email_token, replacing_subscription_id, status, switch_kind",
    )
    .eq("payer_email", payerEmail.toLowerCase())
    .eq("provider_plan_code", planCode)
    .in("status", ["completed", "initialized"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CheckoutSessionRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

const loadSubscriptionByProviderCode = async ({
  adminClient,
  subscriptionCode,
}: {
  adminClient: ReturnType<typeof createClient>;
  subscriptionCode: string;
}) => {
  const response = await adminClient
    .from("business_subscriptions")
    .select(
      "amount, billing_cycle, business_id, cancel_at_period_end, cancelled_at, currency, plan, provider_customer_id, provider_email_token, provider_plan_code, provider_subscription_id, started_at, status",
    )
    .eq("provider_subscription_id", subscriptionCode)
    .maybeSingle<ExistingSubscriptionRow>();

  if (response.error) {
    throw response.error;
  }

  return response.data;
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

const updateSubscriptionFromEventOverride = async ({
  adminClient,
  businessId,
  canonicalSummary,
  eventType,
  plan,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  canonicalSummary: ReturnType<typeof getCanonicalSummaryFromPaystackSubscription>;
  eventType: string;
  plan: ManagedSubscriptionPlan;
}) => {
  const values =
    eventType === "subscription.disable"
      ? {
        cancel_at_period_end: false,
        cancelled_at: canonicalSummary.cancelledAt ?? new Date().toISOString(),
        next_renewal_at: canonicalSummary.nextRenewalAt,
        plan,
        status: "cancelled",
      }
      : eventType === "subscription.not_renew"
        ? {
          cancel_at_period_end: true,
          cancelled_at: null,
          next_renewal_at: canonicalSummary.nextRenewalAt,
          plan,
          expired_at: null,
          status: "active",
        }
        : {
          cancel_at_period_end: false,
          cancelled_at: null,
          next_renewal_at: canonicalSummary.nextRenewalAt,
          plan,
          status: "past_due",
        };

  const response = await adminClient.from("business_subscriptions").update(values).eq("business_id", businessId);

  if (response.error) {
    throw response.error;
  }
};

const loadWorkspacePayoutByReference = async ({
  adminClient,
  businessId,
  reference,
  transferCode,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string | null;
  reference: string | null;
  transferCode: string | null;
}): Promise<WorkspacePayoutRow | null> => {
  if (reference) {
    let referenceQuery = adminClient
      .from("workspace_payouts")
      .select("id, business_id, bill_id, wallet_id, amount, status, provider_reference, provider_transfer_code, provider_metadata");

    if (businessId) {
      referenceQuery = referenceQuery.eq("business_id", businessId);
    }

    const referenceResponse = await referenceQuery.eq("provider_reference", reference).maybeSingle();
    if (referenceResponse.error) {
      throw referenceResponse.error;
    }

    if (referenceResponse.data) {
      return referenceResponse.data as WorkspacePayoutRow;
    }
  }

  if (transferCode) {
    let transferQuery = adminClient
      .from("workspace_payouts")
      .select("id, business_id, bill_id, wallet_id, amount, status, provider_reference, provider_transfer_code, provider_metadata");

    if (businessId) {
      transferQuery = transferQuery.eq("business_id", businessId);
    }

    const transferResponse = await transferQuery.eq("provider_transfer_code", transferCode).maybeSingle();

    if (transferResponse.error) {
      throw transferResponse.error;
    }

    return transferResponse.data as WorkspacePayoutRow | null;
  }

  return null;
};

const notifyPayoutStatus = async ({
  adminClient,
  body,
  payout,
  title,
}: {
  adminClient: ReturnType<typeof createClient>;
  body: string;
  payout: WorkspacePayoutRow;
  title: string;
}) => {
  try {
    await notifyFinanceUsers({
      adminClient,
      body,
      businessId: payout.business_id,
      link: "/wallet",
      title,
      type: "payment",
    });
  } catch (notificationError) {
    console.error("paystack-webhook payout notification failure", notificationError);
  }
};

const settleWorkspacePayout = async ({
  adminClient,
  eventData,
  eventType,
  payout,
  transferVerification,
}: {
  adminClient: ReturnType<typeof createClient>;
  eventData: Record<string, unknown>;
  eventType: string;
  payout: WorkspacePayoutRow;
  transferVerification: Record<string, unknown>;
}) => {
  const reference = asString(eventData.reference);
  const transferCode = asString(eventData.transfer_code);
  const providerAmount =
    typeof eventData.amount === "number" || typeof eventData.amount === "string" ? Number(eventData.amount) / 100 : NaN;
  const providerCurrency = asString(eventData.currency).toUpperCase();
  const providerMetadata =
    eventData.metadata && typeof eventData.metadata === "object"
      ? (eventData.metadata as Record<string, unknown>)
      : {};
  const now = new Date().toISOString();

  if (reference && payout.provider_reference && reference !== payout.provider_reference) {
    return json({
      accepted: true,
      ignored: true,
      reason: "The transfer reference did not match the local payout record.",
      reference,
    });
  }

  if (providerAmount && Number.isFinite(providerAmount) && providerAmount !== Number(payout.amount)) {
    return json({
      accepted: true,
      ignored: true,
      reason: "The transfer amount did not match the local payout record.",
      reference: reference || payout.provider_reference,
    });
  }

  if (providerCurrency && providerCurrency !== "NGN") {
    return json({
      accepted: true,
      ignored: true,
      reason: "The transfer currency did not match the local payout record.",
      reference: reference || payout.provider_reference,
    });
  }

  if (eventType === "transfer.success") {
    const completionResponse = await adminClient.rpc("apply_workspace_payout_completion", {
      p_business_id: payout.business_id,
      p_paid_at: now,
      p_payout_id: payout.id,
      p_provider_metadata: {
        paystack_transfer: eventData,
        paystack_webhook: providerMetadata,
      },
      p_reference: reference || payout.provider_reference || "",
      p_transfer_code: transferCode || payout.provider_transfer_code || "",
      p_updated_by: null,
    });

    if (completionResponse.error) {
      throw completionResponse.error;
    }

    await notifyPayoutStatus({
      adminClient,
      body: `Bill payout ${payout.provider_reference || payout.id} has been completed successfully.`,
      payout,
      title: "Payout completed",
    });

    await recordPayoutAuditLog({
      action: "payout.completed",
      adminClient,
      businessId: payout.business_id,
      detail: {
        payout_id: payout.id,
        provider_reference: reference || payout.provider_reference,
        provider_transfer_code: transferCode || payout.provider_transfer_code,
        transfer_amount: providerAmount,
      },
      entityId: payout.id,
      summary: `Payout completed for payout ${payout.id}`,
    });

    await settleWorkspaceBillFromPayout({
      adminClient,
      eventType,
      payout,
      transferVerification,
    });

    return json({
      accepted: true,
      businessId: payout.business_id,
      payoutId: payout.id,
      status: "completed",
    });
  }

  if (eventType === "transfer.failed") {
    const failureReason = asString(eventData.reason) || "The payout transfer failed.";
    const failureResponse = await adminClient.rpc("apply_workspace_payout_failure", {
      p_business_id: payout.business_id,
      p_failed_at: now,
      p_failure_reason: failureReason,
      p_payout_id: payout.id,
      p_provider_metadata: {
        paystack_transfer: eventData,
        paystack_webhook: providerMetadata,
      },
      p_reference: reference || payout.provider_reference || "",
      p_transfer_code: transferCode || payout.provider_transfer_code || "",
      p_updated_by: null,
    });

    if (failureResponse.error) {
      throw failureResponse.error;
    }

    await notifyPayoutStatus({
      adminClient,
      body: `Bill payout ${payout.provider_reference || payout.id} failed: ${failureReason}`,
      payout,
      title: "Payout failed",
    });

    await recordPayoutAuditLog({
      action: "payout.failed",
      adminClient,
      businessId: payout.business_id,
      detail: {
        failure_reason: failureReason,
        payout_id: payout.id,
        provider_reference: reference || payout.provider_reference,
        provider_transfer_code: transferCode || payout.provider_transfer_code,
        transfer_amount: providerAmount,
      },
      entityId: payout.id,
      summary: `Payout failed for payout ${payout.id}`,
    });

    await settleWorkspaceBillFromPayout({
      adminClient,
      eventType,
      payout,
      transferVerification,
    });

    return json({
      accepted: true,
      businessId: payout.business_id,
      payoutId: payout.id,
      status: "failed",
    });
  }

  if (eventType === "transfer.reversed") {
    const reversalReason = asString(eventData.reason) || "The payout was reversed by the provider.";
    const reversalResponse = await adminClient.rpc("apply_workspace_payout_reversal", {
      p_business_id: payout.business_id,
      p_payout_id: payout.id,
      p_provider_metadata: {
        paystack_transfer: eventData,
        paystack_webhook: providerMetadata,
      },
      p_reason: reversalReason,
      p_reference: reference || payout.provider_reference || "",
      p_reversed_at: now,
      p_transfer_code: transferCode || payout.provider_transfer_code || "",
      p_updated_by: null,
    });

    if (reversalResponse.error) {
      throw reversalResponse.error;
    }

    await notifyPayoutStatus({
      adminClient,
      body: `Bill payout ${payout.provider_reference || payout.id} was reversed by the provider.`,
      payout,
      title: "Payout reversed",
    });

    await recordPayoutAuditLog({
      action: "payout.reversed",
      adminClient,
      businessId: payout.business_id,
      detail: {
        payout_id: payout.id,
        provider_reference: reference || payout.provider_reference,
        provider_transfer_code: transferCode || payout.provider_transfer_code,
        transfer_amount: providerAmount,
      },
      entityId: payout.id,
      summary: `Payout reversed for payout ${payout.id}`,
    });

    await settleWorkspaceBillFromPayout({
      adminClient,
      eventType: "transfer.failed",
      payout,
      transferVerification,
    });

    return json({
      accepted: true,
      businessId: payout.business_id,
      payoutId: payout.id,
      status: "reversed",
    });
  }

  return json({
    accepted: true,
    ignored: true,
    reason: "Unsupported transfer event type.",
    reference: reference || payout.provider_reference,
  });
};

const settleWorkspaceBillFromPayout = async ({
  adminClient,
  eventType,
  payout,
  transferVerification,
}: {
  adminClient: ReturnType<typeof createClient>;
  eventType: string;
  payout: WorkspacePayoutRow;
  transferVerification: Record<string, unknown>;
}) => {
  if (!payout.bill_id) {
    return;
  }

  const settledStatus = eventType === "transfer.success" ? "completed" : "failed";
  const settledReason =
    eventType === "transfer.success"
      ? null
      : asString(transferVerification.reason) || asString(transferVerification.message) || "The payout transfer failed.";
  const payoutReference =
    asString(transferVerification.reference) || payout.provider_reference || payout.provider_transfer_code || payout.id;

  const settlementResponse = await adminClient.rpc("apply_workspace_bill_payout_settlement", {
    p_bill_id: payout.bill_id,
    p_business_id: payout.business_id,
    p_failure_reason: settledReason,
    p_gateway_response:
      eventType === "transfer.success"
        ? "Bill paid through Paystack transfer settlement."
        : settledReason || "The payout transfer failed.",
    p_paid_at: new Date().toISOString(),
    p_payment_reference: payoutReference,
    p_payout_id: payout.id,
    p_provider_metadata: {
      paystack_transfer: transferVerification,
      payout_id: payout.id,
      payout_reference: payoutReference,
      payout_status: payout.status,
      source_event: eventType,
    },
    p_status: settledStatus,
    p_updated_by: null,
  });

  if (settlementResponse.error) {
    throw settlementResponse.error;
  }
};

Deno.serve(async (request) => {
  const requestStartedAt = performance.now();
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")?.trim() ?? "";
  const webhookSignature = request.headers.get("x-paystack-signature");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for online payments." }, 500);
  }

  if (!paystackSecretKey) {
    return json({ error: "Paystack is not configured yet." }, 500);
  }

  const body = await request.text();
  const isSignatureValid = await verifyWebhookSignature(body, webhookSignature, paystackSecretKey);

  if (!isSignatureValid) {
    return json({ error: "Invalid Paystack signature." }, 401);
  }

  let payload: PaystackWebhookEvent;
  try {
    payload = JSON.parse(body) as PaystackWebhookEvent;
  } catch {
    return json({ error: "The webhook payload is invalid." }, 400);
  }

  const eventType = typeof payload.event === "string" ? payload.event : "unknown";
  const eventData = payload.data && typeof payload.data === "object" ? payload.data : {};
  const reference = asString(eventData.reference);
  const metadata =
    eventData.metadata && typeof eventData.metadata === "object"
      ? (eventData.metadata as Record<string, unknown>)
      : {};
  const metadataSource = asString(metadata.source);

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const webhookEventResponse = await adminClient
    .from("platform_webhook_events")
    .insert({
      amount:
        typeof eventData.amount === "number" || typeof eventData.amount === "string"
          ? Number(eventData.amount) / 100
          : null,
      business_id:
        typeof metadata.business_id === "string" && isValidUuid(metadata.business_id.trim()) ? metadata.business_id.trim() : null,
      event_type: eventType,
      payload,
      provider: "paystack",
      status: "received",
    })
    .select("id")
    .maybeSingle();
  const webhookEventId = webhookEventResponse.data?.id ?? null;

  const updateWebhookEvent = async (values: {
    businessId?: string | null;
    errorMessage?: string | null;
    status: "failed" | "processed" | "received" | "retried";
  }) => {
    if (!webhookEventId) {
      return;
    }

    await adminClient.from("platform_webhook_events").update({
      business_id: values.businessId ?? undefined,
      error_message: values.errorMessage ?? null,
      processed_at: new Date().toISOString(),
      processing_time_ms: Math.max(0, Math.round(performance.now() - requestStartedAt)),
      status: values.status,
    }).eq("id", webhookEventId);
  };

  try {
    if (eventType === "charge.success" && metadataSource === "workspace_wallet_funding") {
      if (!reference) {
        await updateWebhookEvent({
          errorMessage: "Missing Paystack reference in wallet funding webhook payload.",
          status: "failed",
        });
        return json({ error: "Missing Paystack reference in webhook payload." }, 400);
      }

      const fundingSession = await loadWalletFundingSessionByReference({
        adminClient,
        reference,
      });

      if (!fundingSession) {
        await updateWebhookEvent({
          errorMessage: "No wallet funding session matched this Paystack reference.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No wallet funding session matched this Paystack reference.",
          reference,
        });
      }

      const walletResponse = await adminClient
        .from("workspace_wallets")
        .select("id, business_id, currency, balance, reserved_balance")
        .eq("id", fundingSession.wallet_id)
        .eq("business_id", fundingSession.business_id)
        .maybeSingle();

      if (walletResponse.error) {
        throw walletResponse.error;
      }

      if (!walletResponse.data) {
        await updateWebhookEvent({
          businessId: fundingSession.business_id,
          errorMessage: "The workspace wallet could not be found for this funding session.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The workspace wallet could not be found for this funding session.",
          reference,
        });
      }

      const wallet = walletResponse.data;
      const paystackVerification = await verifyPaystackTransaction(reference, paystackSecretKey);
      const providerStatus = asString(paystackVerification.status).toLowerCase();
      const providerAmount =
        typeof paystackVerification.amount === "number" || typeof paystackVerification.amount === "string"
          ? Number(paystackVerification.amount)
          : NaN;
      const providerCurrency = asString(paystackVerification.currency).toUpperCase();
      const providerMetadata =
        paystackVerification.metadata && typeof paystackVerification.metadata === "object"
          ? (paystackVerification.metadata as Record<string, unknown>)
          : {};

      if (providerStatus !== "success") {
        await updateWebhookEvent({
          businessId: fundingSession.business_id,
          errorMessage: "The Paystack transaction is not marked as successful yet.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The Paystack transaction is not marked as successful yet.",
          reference,
        });
      }

      if (providerAmount !== Math.round(Number(fundingSession.amount) * 100)) {
        await updateWebhookEvent({
          businessId: fundingSession.business_id,
          errorMessage: "The wallet funding amount does not match the verified Paystack transaction.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The wallet funding amount does not match the verified Paystack transaction.",
          reference,
        });
      }

      if (providerCurrency && providerCurrency !== fundingSession.currency.toUpperCase()) {
        await updateWebhookEvent({
          businessId: fundingSession.business_id,
          errorMessage: "The wallet funding currency does not match the verified Paystack transaction.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The wallet funding currency does not match the verified Paystack transaction.",
          reference,
        });
      }

      if (asString(providerMetadata.source) !== "workspace_wallet_funding") {
        await updateWebhookEvent({
          businessId: fundingSession.business_id,
          errorMessage: "The wallet funding metadata could not be verified.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The wallet funding metadata could not be verified.",
          reference,
        });
      }

      const completionResponse = await adminClient.rpc("apply_wallet_funding_completion", {
        p_amount: fundingSession.amount,
        p_business_id: fundingSession.business_id,
        p_currency: fundingSession.currency,
        p_funding_session_id: fundingSession.id,
        p_paid_at:
          typeof paystackVerification.paid_at === "string" && paystackVerification.paid_at.trim()
            ? paystackVerification.paid_at
            : new Date().toISOString(),
        p_provider_metadata: {
          paystack_verification: paystackVerification,
        },
        p_reference: reference,
        p_updated_by: null,
        p_wallet_id: fundingSession.wallet_id,
      });

      if (completionResponse.error) {
        throw completionResponse.error;
      }

      await updateWebhookEvent({
        businessId: fundingSession.business_id,
        status: "processed",
      });

      const settlementResult = Array.isArray(completionResponse.data)
        ? (completionResponse.data[0] as Record<string, unknown> | undefined)
        : (completionResponse.data as Record<string, unknown> | undefined);

      return json({
        accepted: true,
        applied: settlementResult?.applied === true,
        balanceAfter: Number(settlementResult?.balance_after ?? wallet.balance ?? fundingSession.amount),
        businessId: fundingSession.business_id,
        fundingSessionId: fundingSession.id,
        ledgerEntryId: typeof settlementResult?.ledger_entry_id === "string" ? settlementResult.ledger_entry_id : null,
        reference,
        status: settlementResult?.status ?? fundingSession.status,
      });
    }

    if (eventType === "charge.success" && metadataSource === "paystack_public_link") {
      const invoiceId =
        typeof metadata.invoice_id === "string" && isValidUuid(metadata.invoice_id.trim()) ? metadata.invoice_id.trim() : "";
      const paymentToken =
        typeof metadata.payment_public_token === "string" ? metadata.payment_public_token.trim().toLowerCase() : "";
      const invoiceContext = invoiceId
        ? await fetchInvoiceContextByInvoiceId(adminClient, invoiceId)
        : paymentToken
          ? await fetchInvoiceContextByPaymentToken(adminClient, paymentToken)
          : null;

      if (!invoiceContext) {
        await updateWebhookEvent({
          errorMessage: "No linked invoice could be resolved from webhook metadata.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No linked invoice could be resolved from webhook metadata.",
          reference,
        });
      }

      const existingPayment = await fetchLinkedPayment(adminClient, invoiceContext.invoice.business_id, invoiceContext.invoice.id);
      if (invoiceContext.invoice.status === "paid" && existingPayment?.status === "completed") {
        try {
          await deliverPaymentReceipt({
            adminClient,
            fallbackRecipientEmail: invoiceContext.customer?.email?.trim().toLowerCase() ?? null,
            paymentId: existingPayment.id,
          });
        } catch (receiptError) {
          console.error("Unable to deliver payment receipt", receiptError);
        }

        await updateWebhookEvent({
          businessId: invoiceContext.invoice.business_id,
          status: "processed",
        });

        return json({
          accepted: true,
          alreadyProcessed: true,
          paymentId: existingPayment.id,
          reference,
        });
      }

      const paystackVerification = await verifyPaystackTransaction(reference, paystackSecretKey);

      try {
        validateVerifiedPaystackPayment({
          invoice: invoiceContext.invoice,
          paystackVerification,
          paymentToken: paymentToken || invoiceContext.invoice.payment_public_token,
          reference,
        });
      } catch (error) {
        await updateWebhookEvent({
          businessId: invoiceContext.invoice.business_id,
          errorMessage: error instanceof Error ? error.message : "The payment verification failed.",
          status: "failed",
        });
        return json(
          {
            accepted: true,
            ignored: true,
            reason: error instanceof Error ? error.message : "The payment verification failed.",
            reference,
          },
          200,
        );
      }

      const settlement = await settleInvoicePaystackPayment({
        adminClient,
        context: invoiceContext,
        paidAt:
          typeof paystackVerification.paid_at === "string" && paystackVerification.paid_at.trim()
            ? paystackVerification.paid_at
            : new Date().toISOString(),
        paystackPayload: paystackVerification,
        reference,
      });

      await updateWebhookEvent({
        businessId: invoiceContext.invoice.business_id,
        status: "processed",
      });

      return json({
        accepted: true,
        alreadyProcessed: false,
        invoiceId: invoiceContext.invoice.id,
        paidAt: settlement.paidAt,
        paymentId: settlement.paymentId,
        reference,
      });
    }

    if (eventType === "charge.success" && metadataSource === "workspace_subscription") {
      if (!reference) {
        await updateWebhookEvent({
          errorMessage: "Missing Paystack reference in subscription charge webhook payload.",
          status: "failed",
        });
        return json({ error: "Missing Paystack reference in webhook payload." }, 400);
      }

      const checkoutSession = await loadCheckoutSessionByReference({
        adminClient,
        reference,
      });

      if (!checkoutSession) {
        await updateWebhookEvent({
          errorMessage: "No workspace subscription checkout session matched this Paystack reference.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No workspace subscription checkout session matched this Paystack reference.",
          reference,
        });
      }

      const existingSubscription = await loadExistingSubscription({
        adminClient,
        businessId: checkoutSession.business_id,
      });
      const paystackVerification = await verifyPaystackTransaction(reference, paystackSecretKey);
      const providerStatus = asString(paystackVerification.status).toLowerCase();

      if (providerStatus !== "success") {
        await markCheckoutSession({
          adminClient,
          reference,
          status: "failed",
          verificationError: "The Paystack transaction is not marked as successful yet.",
        });
        await updateWebhookEvent({
          businessId: checkoutSession.business_id,
          errorMessage: "The Paystack transaction is not marked as successful yet.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The Paystack transaction is not marked as successful yet.",
          reference,
        });
      }

      const canonicalSubscription = await resolveCanonicalPaystackSubscription({
        checkoutSession,
        paystackSecretKey,
        transactionVerification: paystackVerification,
      });

      if (!canonicalSubscription) {
        await markCheckoutSession({
          adminClient,
          reference,
          status: "failed",
          verificationError: "No Paystack subscription record could be resolved from the completed checkout.",
        });
        await updateWebhookEvent({
          businessId: checkoutSession.business_id,
          errorMessage: "No Paystack subscription record could be resolved from the completed checkout.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No Paystack subscription record could be resolved from the completed checkout.",
          reference,
        });
      }

      const canonicalSummary = await syncBusinessSubscriptionFromPaystack({
        adminClient,
        businessId: checkoutSession.business_id,
        checkoutSession,
        existingSubscription,
        plan: normalizePlan(checkoutSession.plan),
        reference,
        subscription: canonicalSubscription,
        updatedBy: null,
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

      await updateWebhookEvent({
        businessId: checkoutSession.business_id,
        status: "processed",
      });

      return json({
        accepted: true,
        alreadyProcessed: checkoutSession.status === "completed",
        businessId: checkoutSession.business_id,
        providerSubscriptionId: canonicalSummary.paystackSubscriptionId,
        replacedPreviousSubscription: replacementResult.replacedPreviousSubscription,
        reference,
      });
    }

    if (eventType === "transfer.success" || eventType === "transfer.failed" || eventType === "transfer.reversed") {
      const payout = await loadWorkspacePayoutByReference({
        adminClient,
        businessId:
          typeof metadata.business_id === "string" && isValidUuid(metadata.business_id.trim())
            ? metadata.business_id.trim()
            : null,
        reference,
        transferCode: asString(eventData.transfer_code),
      });

      if (!payout) {
        await updateWebhookEvent({
          errorMessage: "No local workspace payout record matched this Paystack transfer event.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No local workspace payout record matched this Paystack transfer event.",
          reference,
        });
      }

      const transferVerification = await verifyPaystackTransaction(reference || asString(eventData.reference), paystackSecretKey);
      const verifiedStatus = asString(transferVerification.status).toLowerCase();

      if (
        (eventType === "transfer.success" && verifiedStatus !== "success") ||
        (eventType === "transfer.failed" && verifiedStatus !== "failed") ||
        (eventType === "transfer.reversed" && verifiedStatus !== "reversed")
      ) {
        await updateWebhookEvent({
          businessId: payout.business_id,
          errorMessage: "The Paystack transfer verification status did not match the webhook event.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "The Paystack transfer verification status did not match the webhook event.",
          reference,
        });
      }

      const settlement = await settleWorkspacePayout({
        adminClient,
        eventData,
        eventType,
        payout,
        transferVerification,
      });

      await updateWebhookEvent({
        businessId: payout.business_id,
        status: "processed",
      });

      return settlement;
    }

    if (
      eventType === "subscription.create" ||
      eventType === "subscription.disable" ||
      eventType === "subscription.not_renew" ||
      eventType === "invoice.update" ||
      eventType === "invoice.payment_failed"
    ) {
      const subscriptionCode = getSubscriptionCodeFromWebhookPayload(eventData);

      if (!subscriptionCode) {
        await updateWebhookEvent({
          errorMessage: "No subscription code was present in the Paystack webhook payload.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No subscription code was present in the Paystack webhook payload.",
        });
      }

      const canonicalSubscription = await fetchPaystackSubscription({
        paystackSecretKey,
        subscriptionCode,
      });
      const canonicalCustomer =
        canonicalSubscription.customer && typeof canonicalSubscription.customer === "object"
          ? (canonicalSubscription.customer as Record<string, unknown>)
          : {};
      const canonicalPlan =
        canonicalSubscription.plan && typeof canonicalSubscription.plan === "object"
          ? (canonicalSubscription.plan as Record<string, unknown>)
          : {};
      const canonicalCustomerEmail = asNullableString(canonicalCustomer.email)?.toLowerCase() ?? null;
      const canonicalPlanCode = asNullableString(canonicalPlan.plan_code);
      const matchedSubscription = await loadSubscriptionByProviderCode({
        adminClient,
        subscriptionCode,
      });
      const matchedCheckoutSession = matchedSubscription
        ? null
        : await loadCheckoutSessionBySubscriptionMatch({
          adminClient,
          payerEmail: canonicalCustomerEmail,
          planCode: canonicalPlanCode,
        });

      if (!matchedSubscription && !matchedCheckoutSession) {
        await updateWebhookEvent({
          errorMessage: "No local workspace subscription record could be matched to this Paystack subscription.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No local workspace subscription record could be matched to this Paystack subscription.",
          subscriptionCode,
        });
      }

      const businessId = matchedSubscription?.business_id ?? matchedCheckoutSession?.business_id ?? null;
      if (!businessId) {
        await updateWebhookEvent({
          errorMessage: "No business could be resolved for this Paystack subscription event.",
          status: "failed",
        });
        return json({
          accepted: true,
          ignored: true,
          reason: "No business could be resolved for this Paystack subscription event.",
          subscriptionCode,
        });
      }

      const existingSubscription = matchedSubscription ?? (await loadExistingSubscription({
        adminClient,
        businessId,
      }));
      const plan = normalizePlan(matchedSubscription?.plan ?? matchedCheckoutSession?.plan);

      if (eventType === "invoice.payment_failed" || eventType === "subscription.disable" || eventType === "subscription.not_renew") {
        const canonicalSummary = getCanonicalSummaryFromPaystackSubscription({
          checkoutSession: matchedCheckoutSession,
          existingSubscription,
          subscription: canonicalSubscription,
        });

        await updateSubscriptionFromEventOverride({
          adminClient,
          businessId,
          canonicalSummary,
          eventType,
          plan,
        });

        if (eventType === "invoice.payment_failed") {
          try {
            const notification = buildSubscriptionPaymentFailureNotification(plan);
            await notifyFinanceUsers({
              adminClient,
              body: notification.body,
              businessId,
              link: notification.link,
              title: notification.title,
              type: notification.type,
            });
          } catch (notificationError) {
            console.error("Unable to create subscription payment failure notifications", notificationError);
          }
        }
      } else {
        const canonicalSummary = await syncBusinessSubscriptionFromPaystack({
          adminClient,
          businessId,
          checkoutSession: matchedCheckoutSession,
          existingSubscription,
          plan,
          reference,
          subscription: canonicalSubscription,
          updatedBy: null,
        });

        if (matchedCheckoutSession?.reference) {
          await markCheckoutSession({
            adminClient,
            providerCustomerId: canonicalSummary.paystackCustomerId,
            providerSubscriptionId: canonicalSummary.paystackSubscriptionId,
            reference: matchedCheckoutSession.reference,
            status: "completed",
            verifiedAt: new Date().toISOString(),
          });
        }
      }

      await updateWebhookEvent({
        businessId,
        status: "processed",
      });

      return json({
        accepted: true,
        businessId,
        eventType,
        providerSubscriptionId: subscriptionCode,
      });
    }

    await updateWebhookEvent({
      status: "processed",
    });

    return json({
      accepted: true,
      ignored: true,
      reason: "Unsupported event type.",
    });
  } catch (error) {
    await updateWebhookEvent({
      errorMessage: error instanceof Error ? error.message : "The Paystack webhook handler failed.",
      status: "failed",
    });
    return json(
      {
        accepted: true,
        ignored: false,
        reason: error instanceof Error ? error.message : "The Paystack webhook handler failed.",
      },
      200,
    );
  }
});
