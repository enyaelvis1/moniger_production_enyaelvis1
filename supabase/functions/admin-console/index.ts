import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { buildPasswordResetEmail } from "../_shared/auth-reset-email.ts";
import { buildBulkTestDataConfirmation, canManageTestData, isMarkedTestData, isSafeToDeletePayment, isSafeToDeletePayout, validateTestDataDeletionBatch } from "../_shared/test-data-policy.ts";

type AdminConsoleAction =
  | "overview"
  | "businesses.list"
  | "businesses.detail"
  | "businesses.invoices"
  | "businesses.export"
  | "businesses.action"
  | "users.list"
  | "users.action"
  | "subscriptions.list"
  | "subscriptions.update"
  | "payments.list"
  | "payments.export"
  | "payments.reconcile"
  | "testData.preview"
  | "testData.delete"
  | "payouts.list"
  | "payouts.export"
  | "content.list"
  | "content.save"
  | "content.delete"
  | "signupAlerts.list"
  | "announcements.list"
  | "announcements.save"
  | "announcements.delete"
  | "announcements.duplicate"
  | "support.lookup"
  | "support.quickAction"
  | "audit.list"
  | "health.check"
  | "settings.get"
  | "settings.adminUser"
  | "settings.platformConfig"
  | "settings.dangerAction";

type AdminConsoleRequest = {
  action: AdminConsoleAction;
  payload?: Record<string, unknown>;
};

type AuthUserRecord = {
  app_metadata?: Record<string, unknown>;
  created_at?: string;
  email?: string | null;
  id: string;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
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

const normalizeSearch = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");
const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asNullableString = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const asNumber = (value: unknown) => (typeof value === "number" ? value : Number(value ?? 0));
const asNullableNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};
const asRecord = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});
const todayDate = () => new Date().toISOString().slice(0, 10);
const monthStamp = (value: string | null | undefined) => (value ? value.slice(0, 7) : "");
const toDateOnly = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.slice(0, 10);
    }
  }

  return todayDate();
};

const toResponseMs = (startedAt: number) => Math.max(0, Math.round(performance.now() - startedAt));

const buildMarketplaceRoutingSummary = (metadataValue: unknown) => {
  const metadata = asRecord(metadataValue);
  const routing = asRecord(metadata.marketplace_routing);

  if (Object.keys(routing).length === 0) {
    return null;
  }

  const settlement = asRecord(routing.settlement);

  return {
    enabled: typeof routing.enabled === "boolean" ? routing.enabled : true,
    mode: asNullableString(routing.mode),
    payoutAccountId: asNullableString(routing.payout_account_id),
    providerSplitCode: asNullableString(routing.provider_split_code),
    providerSubaccountCode: asNullableString(routing.provider_subaccount_code),
    splitConfigId: asNullableString(routing.split_config_id),
    transactionChargeKobo: asNullableNumber(routing.transaction_charge_kobo),
    settlement: Object.keys(settlement).length === 0
      ? null
      : {
        amountKobo: asNullableNumber(settlement.amount_kobo),
        currency: asNullableString(settlement.currency),
        feesKobo: asNullableNumber(settlement.fees_kobo),
        gatewayResponse: asNullableString(settlement.gateway_response),
        paidAt: asNullableString(settlement.paid_at),
        providerReference: asNullableString(settlement.provider_reference),
        providerStatus: asNullableString(settlement.provider_status),
        transactionDate: asNullableString(settlement.transaction_date),
        verifiedAt: asNullableString(settlement.verified_at),
      },
  };
};

const buildPaymentReconciliationSummary = ({
  bill,
  invoice,
  payment,
}: {
  bill: Record<string, unknown> | null;
  invoice: Record<string, unknown> | null;
  payment: Record<string, unknown>;
}) => {
  const metadata = asRecord(payment.metadata);
  const lastCheck = asRecord(metadata.admin_reconciliation);
  const paymentStatus = asString(payment.status);
  const source = invoice ? "invoice" : bill ? "bill" : null;
  const linkedDocumentNumber = invoice
    ? asNullableString(invoice.invoice_number)
    : bill
      ? asNullableString(bill.bill_number)
      : null;
  const linkedDueDate = invoice
    ? asNullableString(invoice.due_date)
    : bill
      ? asNullableString(bill.due_date)
      : null;
  const linkedStatus = invoice
    ? asString(invoice.status)
    : bill
      ? asString(bill.status)
      : null;

  if (!source) {
    return {
      canReconcile: paymentStatus === "pending" || paymentStatus === "scheduled",
      expectedStatus: null,
      lastCheckedAt: asNullableString(lastCheck.checked_at),
      linkedDocumentNumber: null,
      linkedDueDate: null,
      needsAttention: paymentStatus === "pending" || paymentStatus === "scheduled",
      sourceStatus: null,
      sourceType: null,
      summary:
        paymentStatus === "pending" || paymentStatus === "scheduled"
          ? "No linked invoice or bill was found, so this payment cannot be auto-resolved yet."
          : "No linked invoice or bill is attached to this payment.",
      tone: paymentStatus === "pending" || paymentStatus === "scheduled" ? "warning" : "neutral",
    };
  }

  if (source === "invoice") {
    if (linkedStatus === "paid") {
      return {
        canReconcile: paymentStatus !== "completed",
        expectedStatus: paymentStatus === "completed" ? null : "completed",
        lastCheckedAt: asNullableString(lastCheck.checked_at),
        linkedDocumentNumber,
        linkedDueDate,
        needsAttention: paymentStatus !== "completed",
        sourceStatus: linkedStatus,
        sourceType: source,
        summary:
          paymentStatus === "completed"
            ? "Invoice and payment are both marked paid."
            : "Invoice is already marked paid, but this payment record has not been completed yet.",
        tone: paymentStatus === "completed" ? "success" : "warning",
      };
    }

    if (linkedStatus === "cancelled") {
      return {
        canReconcile: paymentStatus !== "failed",
        expectedStatus: paymentStatus === "failed" ? null : "failed",
        lastCheckedAt: asNullableString(lastCheck.checked_at),
        linkedDocumentNumber,
        linkedDueDate,
        needsAttention: paymentStatus !== "failed",
        sourceStatus: linkedStatus,
        sourceType: source,
        summary:
          paymentStatus === "failed"
            ? "Invoice and payment are both closed out."
            : "Invoice was cancelled, so this payment should no longer remain open.",
        tone: paymentStatus === "failed" ? "neutral" : "warning",
      };
    }

    if (linkedStatus === "overdue") {
      return {
        canReconcile: true,
        expectedStatus: null,
        lastCheckedAt: asNullableString(lastCheck.checked_at),
        linkedDocumentNumber,
        linkedDueDate,
        needsAttention: true,
        sourceStatus: linkedStatus,
        sourceType: source,
        summary: "Invoice is overdue and still unpaid. Pending here means the receivable is still open, not that it has settled.",
        tone: "warning",
      };
    }

    return {
      canReconcile: true,
      expectedStatus: paymentStatus === "pending" ? null : "pending",
      lastCheckedAt: asNullableString(lastCheck.checked_at),
      linkedDocumentNumber,
      linkedDueDate,
      needsAttention: paymentStatus !== "pending",
      sourceStatus: linkedStatus,
      sourceType: source,
      summary:
        linkedStatus === "sent"
          ? "Invoice has been sent and is still awaiting customer payment."
          : "Invoice is still open and awaiting payment activity.",
      tone: paymentStatus === "pending" ? "info" : "warning",
    };
  }

  if (linkedStatus === "paid") {
    return {
      canReconcile: paymentStatus !== "completed",
      expectedStatus: paymentStatus === "completed" ? null : "completed",
      lastCheckedAt: asNullableString(lastCheck.checked_at),
      linkedDocumentNumber,
      linkedDueDate,
      needsAttention: paymentStatus !== "completed",
      sourceStatus: linkedStatus,
      sourceType: source,
      summary:
        paymentStatus === "completed"
          ? "Bill and payment are both marked paid."
          : "Bill is already marked paid, but this payable payment has not been completed yet.",
      tone: paymentStatus === "completed" ? "success" : "warning",
    };
  }

  if (linkedStatus === "scheduled") {
    return {
      canReconcile: paymentStatus !== "scheduled",
      expectedStatus: paymentStatus === "scheduled" ? null : "scheduled",
      lastCheckedAt: asNullableString(lastCheck.checked_at),
      linkedDocumentNumber,
      linkedDueDate,
      needsAttention: paymentStatus !== "scheduled",
      sourceStatus: linkedStatus,
      sourceType: source,
      summary:
        paymentStatus === "scheduled"
          ? "Bill and payment are both scheduled."
          : "Bill is scheduled, so this payment should still be in the scheduled state.",
      tone: paymentStatus === "scheduled" ? "info" : "warning",
    };
  }

  if (linkedStatus === "overdue") {
    return {
      canReconcile: true,
      expectedStatus: paymentStatus === "pending" ? null : "pending",
      lastCheckedAt: asNullableString(lastCheck.checked_at),
      linkedDocumentNumber,
      linkedDueDate,
      needsAttention: true,
      sourceStatus: linkedStatus,
      sourceType: source,
      summary: "Bill is past due and still unpaid. Pending here means Moniger has not recorded a completed settlement yet.",
      tone: "warning",
    };
  }

  return {
    canReconcile: true,
    expectedStatus: paymentStatus === "pending" ? null : "pending",
    lastCheckedAt: asNullableString(lastCheck.checked_at),
    linkedDocumentNumber,
    linkedDueDate,
    needsAttention: true,
    sourceStatus: linkedStatus,
    sourceType: source,
    summary: "The linked bill returned to an open state while the payment record still exists. Review and reconcile it before reporting on this payment.",
    tone: "warning",
  };
};

const loadLinkedPaymentContext = async (
  adminClient: ReturnType<typeof createClient>,
  payments: Array<Record<string, unknown>>,
) => {
  const invoiceIds = Array.from(
    new Set(
      payments
        .map((payment) => asNullableString(payment.invoice_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const billIds = Array.from(
    new Set(
      payments
        .map((payment) => asNullableString(payment.bill_id))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [invoicesResponse, billsResponse] = await Promise.all([
    invoiceIds.length > 0
      ? adminClient.from("invoices").select("id, invoice_number, status, due_date, paid_at, issue_date").in("id", invoiceIds)
      : Promise.resolve({ data: [], error: null }),
    billIds.length > 0
      ? adminClient.from("bills").select("id, bill_number, status, due_date, bill_date, scheduled_payment_date, updated_at").in("id", billIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (invoicesResponse.error) {
    throw invoicesResponse.error;
  }

  if (billsResponse.error) {
    throw billsResponse.error;
  }

  return {
    billsById: new Map((billsResponse.data ?? []).map((row) => [asString(row.id), row as Record<string, unknown>])),
    invoicesById: new Map((invoicesResponse.data ?? []).map((row) => [asString(row.id), row as Record<string, unknown>])),
  };
};

const buildAdminPaymentRow = ({
  billsById,
  businessNameById,
  invoicesById,
  payment,
}: {
  billsById: Map<string, Record<string, unknown>>;
  businessNameById: Map<string, string>;
  invoicesById: Map<string, Record<string, unknown>>;
  payment: Record<string, unknown>;
}) => {
  const invoice = invoicesById.get(asString(payment.invoice_id)) ?? null;
  const bill = billsById.get(asString(payment.bill_id)) ?? null;

  return {
    amount: asNumber(payment.amount),
    businessId: asString(payment.business_id),
    businessName: businessNameById.get(asString(payment.business_id)) ?? "Workspace",
    date: asString(payment.created_at),
    gatewayResponse: asNullableString(payment.gateway_response),
    marketplaceRouting: buildMarketplaceRoutingSummary(payment.metadata),
    paymentId: asString(payment.id),
    paymentReference: asString(payment.payment_reference),
    paymentType: asString(payment.payment_type),
    isTestData: isMarkedTestData(payment),
    reconciliation: buildPaymentReconciliationSummary({
      bill,
      invoice,
      payment,
    }),
    status: asString(payment.status),
  };
};

const buildAdminPayoutRow = ({
  businessNameById,
  payout,
}: {
  businessNameById: Map<string, string>;
  payout: Record<string, unknown>;
}) => {
  const bill = Array.isArray((payout as Record<string, unknown>).bill) ? (payout as Record<string, unknown>).bill[0] : (payout as Record<string, unknown>).bill;
  const vendor = Array.isArray((payout as Record<string, unknown>).vendor) ? (payout as Record<string, unknown>).vendor[0] : (payout as Record<string, unknown>).vendor;
  const bank = Array.isArray((payout as Record<string, unknown>).bank) ? (payout as Record<string, unknown>).bank[0] : (payout as Record<string, unknown>).bank;

  return {
    amount: asNumber((payout as Record<string, unknown>).amount),
    bankName: asNullableString((bank as Record<string, unknown> | null | undefined)?.name ?? null),
    billNumber: asNullableString((bill as Record<string, unknown> | null | undefined)?.bill_number ?? null),
    businessId: asString((payout as Record<string, unknown>).business_id),
    businessName: businessNameById.get(asString((payout as Record<string, unknown>).business_id)) ?? "Workspace",
    cancelledAt: asNullableString((payout as Record<string, unknown>).cancelled_at ?? null),
    completedAt: asNullableString((payout as Record<string, unknown>).completed_at ?? null),
    createdAt: asString((payout as Record<string, unknown>).created_at),
    currency: asString((payout as Record<string, unknown>).currency) || "NGN",
    failureReason: asNullableString((payout as Record<string, unknown>).failure_reason ?? null),
    failedAt: asNullableString((payout as Record<string, unknown>).failed_at ?? null),
    lastAttemptAt: asNullableString((payout as Record<string, unknown>).last_attempt_at ?? null),
    nextRetryAt: asNullableString((payout as Record<string, unknown>).next_retry_at ?? null),
    payoutId: asString((payout as Record<string, unknown>).id),
    isTestData: isMarkedTestData(payout),
    providerReference: asNullableString((payout as Record<string, unknown>).provider_reference ?? null),
    providerTransferCode: asNullableString((payout as Record<string, unknown>).provider_transfer_code ?? null),
    recipientBankCode: asNullableString((bank as Record<string, unknown> | null | undefined)?.bank_code ?? null),
    retryCount: asNumber((payout as Record<string, unknown>).retry_count),
    scheduledFor: asNullableString((payout as Record<string, unknown>).scheduled_for ?? null),
    status: asString((payout as Record<string, unknown>).status),
    submittedAt: asNullableString((payout as Record<string, unknown>).submitted_at ?? null),
    vendorName: asNullableString((vendor as Record<string, unknown> | null | undefined)?.business_name ?? null),
  };
};

const getAppBaseUrl = (_request: Request) => {
  const configuredUrl = Deno.env.get("APP_BASE_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  throw new Error("APP_BASE_URL is required for admin-triggered email links.");
};

const sendViaResend = async ({
  fromAddress,
  html,
  recipientEmail,
  resendApiKey,
  subject,
  text,
}: {
  fromAddress: string;
  html: string;
  recipientEmail: string;
  resendApiKey: string;
  subject: string;
  text: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof payload?.message === "string" ? payload.message : "The email provider rejected the delivery request.";
    throw new Error(errorMessage);
  }

  return payload as { id?: string };
};

const sendPasswordResetEmail = async ({
  adminClient,
  email,
  request,
}: {
  adminClient: ReturnType<typeof createClient>;
  email: string;
  request: Request;
}) => {
  const redirectTo = `${getAppBaseUrl(request)}/reset-password`;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";

  const response = await adminClient.auth.admin.generateLink({
    email,
    options: {
      redirectTo,
    },
    type: "recovery",
  });

  if (response.error) {
    throw response.error;
  }

  const actionLink = typeof response.data.properties?.action_link === "string"
    ? response.data.properties.action_link
    : "";

  if (!actionLink) {
    throw new Error("The password reset link could not be generated.");
  }

  if (!resendApiKey || !fromAddress) {
    throw new Error("Password reset email delivery is not configured. Add RESEND_API_KEY and EMAIL_FROM_ADDRESS.");
  }

  const emailContent = buildPasswordResetEmail({
    actionLink,
    recipientEmail: email,
    appBaseUrl: getAppBaseUrl(request),
    recipientName: asString(response.data.user?.user_metadata?.full_name ?? response.data.user?.user_metadata?.name ?? "").trim() || null,
    requestedByAdmin: true,
  });

  await sendViaResend({
    fromAddress,
    html: emailContent.html,
    recipientEmail: email,
    resendApiKey,
    subject: emailContent.subject,
    text: emailContent.text,
  });

  return {
    actionLink,
    email,
    redirectTo,
  };
};

const listAllAuthUsers = async (adminClient: ReturnType<typeof createClient>) => {
  const users: AuthUserRecord[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const response = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (response.error) {
      throw response.error;
    }

    const pageUsers = (response.data.users ?? []) as AuthUserRecord[];
    users.push(...pageUsers);

    if (pageUsers.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
};

const getActorAuditBusinessId = async (adminClient: ReturnType<typeof createClient>, actorUserId: string) => {
  const { data: directBusiness } = await adminClient
    .from("businesses")
    .select("id")
    .eq("owner_user_id", actorUserId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (directBusiness?.id) {
    return directBusiness.id as string;
  }

  const { data: membership } = await adminClient
    .from("business_members")
    .select("business_id")
    .eq("user_id", actorUserId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membership?.business_id) {
    return membership.business_id as string;
  }

  const { data: anyBusiness } = await adminClient
    .from("businesses")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (anyBusiness?.id as string | null) ?? null;
};

const insertAdminAuditLog = async ({
  action,
  actorUserId,
  adminClient,
  businessId,
  detail,
  entityId,
  entityType,
  summary,
}: {
  action: string;
  actorUserId: string;
  adminClient: ReturnType<typeof createClient>;
  businessId: string | null;
  detail?: Record<string, unknown>;
  entityId?: string | null;
  entityType: string;
  summary: string;
}) => {
  const resolvedBusinessId = businessId ?? await getActorAuditBusinessId(adminClient, actorUserId);

  if (!resolvedBusinessId) {
    return;
  }

  await adminClient.from("audit_logs").insert({
    action,
    actor_user_id: actorUserId,
    business_id: resolvedBusinessId,
    detail: {
      admin_action: true,
      ...(detail ?? {}),
    },
    entity_id: entityId ?? null,
    entity_type: entityType,
    summary,
  });
};

const getAnnouncementStatus = ({
  expiresAt,
  publishedAt,
}: {
  expiresAt: string | null;
  publishedAt: string | null;
}) => {
  const now = Date.now();

  if (expiresAt && new Date(expiresAt).getTime() < now) {
    return "expired";
  }

  if (publishedAt && new Date(publishedAt).getTime() <= now) {
    return "live";
  }

  return "scheduled";
};

const defaultBillingCatalog = {
  business: { amount: 89000, billingCycle: "monthly", currency: "NGN" },
  growth: { amount: 29000, billingCycle: "monthly", currency: "NGN" },
  starter: { amount: 0, billingCycle: "free", currency: "NGN" },
} as const;

const getDefaultSubscriptionConfig = (plan: "business" | "growth" | "starter") =>
  defaultBillingCatalog[plan] ?? defaultBillingCatalog.starter;

const normalizeSubscriptionStatus = (
  value: string,
): "active" | "cancelled" | "past_due" | "paused" | "trial" => {
  if (value === "trial" || value === "past_due" || value === "paused" || value === "cancelled") {
    return value;
  }

  return "active";
};

const normalizeBillingCycle = (
  value: string,
): "annual" | "free" | "manual" | "monthly" => {
  if (value === "annual" || value === "free" || value === "manual") {
    return value;
  }

  return "monthly";
};

const getMonthlyRecurringValue = ({
  amount,
  billingCycle,
  status,
}: {
  amount: number;
  billingCycle: "annual" | "free" | "manual" | "monthly";
  status: "active" | "cancelled" | "past_due" | "paused" | "trial";
}) => {
  if (status === "cancelled" || billingCycle === "free") {
    return 0;
  }

  if (billingCycle === "annual") {
    return amount / 12;
  }

  if (billingCycle === "manual") {
    return 0;
  }

  return amount;
};

const groupLatestHealthChecks = (rows: Array<Record<string, unknown>>) => {
  const latestByService = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const service = asString(row.service);
    if (!service || latestByService.has(service)) {
      continue;
    }

    latestByService.set(service, row);
  }

  return Array.from(latestByService.values()).map((row) => ({
    checkedAt: asString(row.checked_at),
    responseMs: row.response_ms === null ? null : asNumber(row.response_ms),
    service: asString(row.service),
    status: asString(row.status) as "degraded" | "down" | "operational",
  }));
};

const buildSubscriptionRows = async (adminClient: ReturnType<typeof createClient>) => {
  const [businessRows, subscriptionsResponse] = await Promise.all([
    buildBusinessRows(adminClient),
    adminClient.from("business_subscriptions").select("*"),
  ]);

  if (subscriptionsResponse.error) {
    throw subscriptionsResponse.error;
  }

  const subscriptionsByBusinessId = new Map(
    (subscriptionsResponse.data ?? []).map((row) => [asString(row.business_id), row]),
  );

  return businessRows.map((business) => {
    const subscription = subscriptionsByBusinessId.get(business.businessId);
    const plan = (asString(subscription?.plan) || business.plan) as "business" | "growth" | "starter";
    const defaults = getDefaultSubscriptionConfig(plan);
    const status = normalizeSubscriptionStatus(
      asString(subscription?.status) || (business.status === "suspended" ? "paused" : "active"),
    );
    const billingCycle = normalizeBillingCycle(asString(subscription?.billing_cycle) || defaults.billingCycle);
    const amount = subscription?.amount === null || typeof subscription?.amount === "undefined"
      ? defaults.amount
      : asNumber(subscription.amount);

    return {
      amount,
      billingCycle,
      businessId: business.businessId,
      businessName: business.businessName,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      cancelledAt: asNullableString(subscription?.cancelled_at),
      currency: asString(subscription?.currency) || business.defaultCurrency || defaults.currency,
      nextRenewalAt: asNullableString(subscription?.next_renewal_at),
      notes: asNullableString(subscription?.notes),
      ownerEmail: business.ownerEmail,
      plan,
      provider: asString(subscription?.provider) || "manual",
      providerCustomerId: asNullableString(subscription?.provider_customer_id),
      providerSubscriptionId: asNullableString(subscription?.provider_subscription_id),
      startedAt: asString(subscription?.started_at) || business.createdAt,
      status,
      updatedAt: asNullableString(subscription?.updated_at),
    };
  });
};

const getResponseTimeSamples = (rows: Array<Record<string, unknown>>) => {
  const hourlyBuckets = new Map<string, number[]>();

  for (const row of rows) {
    if (row.response_ms === null || !row.checked_at) {
      continue;
    }

    const checkedAt = new Date(asString(row.checked_at));
    const label = `${checkedAt.getHours().toString().padStart(2, "0")}:00`;
    const existing = hourlyBuckets.get(label) ?? [];
    existing.push(asNumber(row.response_ms));
    hourlyBuckets.set(label, existing);
  }

  return Array.from(hourlyBuckets.entries())
    .slice(-12)
    .map(([label, samples]) => ({
      label,
      value: Math.round(samples.reduce((sum, sample) => sum + sample, 0) / samples.length),
    }));
};

const pingService = async ({
  adminClient,
  check,
  service,
}: {
  adminClient: ReturnType<typeof createClient>;
  check: () => Promise<void>;
  service: string;
}) => {
  const startedAt = performance.now();

  try {
    await check();
    const responseMs = toResponseMs(startedAt);
    await adminClient.from("platform_health_checks").insert({
      response_ms: responseMs,
      service,
      status: "operational",
    });

    return {
      checkedAt: new Date().toISOString(),
      responseMs,
      service,
      status: "operational" as const,
    };
  } catch (error) {
    const responseMs = toResponseMs(startedAt);
    await adminClient.from("platform_health_checks").insert({
      response_ms: responseMs,
      service,
      status: "down",
    });

    return {
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Service unavailable",
      responseMs,
      service,
      status: "down" as const,
    };
  }
};

const resolveAuthUserById = async (
  adminClient: ReturnType<typeof createClient>,
  userId: string,
) => {
  const response = await adminClient.auth.admin.getUserById(userId);

  if (response.error) {
    throw response.error;
  }

  const authUser = response.data.user;
  if (!authUser) {
    throw new Error("That user no longer exists.");
  }

  return authUser as AuthUserRecord;
};

const recordAnnouncementNotifications = async ({
  adminClient,
  announcement,
}: {
  adminClient: ReturnType<typeof createClient>;
  announcement: {
    body: string;
    id: string;
    published_at: string | null;
    target: string;
    target_filters: Record<string, unknown>;
    title: string;
  };
}) => {
  if (!announcement.published_at) {
    return;
  }

  const { data: businessMembers } = await adminClient
    .from("business_members")
    .select("business_id, user_id")
    .eq("status", "active");

  const { data: businessOverrides } = await adminClient
    .from("business_admin_overrides")
    .select("business_id, plan");

  const planByBusinessId = new Map(
    (businessOverrides ?? []).map((row) => [asString(row.business_id), asString(row.plan) || "starter"]),
  );
  const customBusinessIds = Array.isArray(announcement.target_filters.businessIds)
    ? announcement.target_filters.businessIds.map((businessId) => String(businessId))
    : [];
  const targetUserIds = Array.isArray(announcement.target_filters.userIds)
    ? announcement.target_filters.userIds.map((userId) => String(userId))
    : [];
  const seenRecipients = new Set<string>();
  const rows = (businessMembers ?? [])
    .filter((row) => {
      const userId = asString(row.user_id);
      const businessPlan = planByBusinessId.get(asString(row.business_id)) ?? "starter";

      if (targetUserIds.length > 0) {
        return targetUserIds.includes(userId);
      }

      if (announcement.target === "all") {
        return true;
      }

      if (announcement.target === "starter" || announcement.target === "growth" || announcement.target === "business") {
        return businessPlan === announcement.target;
      }

      return customBusinessIds.includes(asString(row.business_id));
    })
    .filter((row) => {
      const uniqueKey = `${asString(row.business_id)}:${asString(row.user_id)}`;

      if (seenRecipients.has(uniqueKey)) {
        return false;
      }

      seenRecipients.add(uniqueKey);
      return true;
    })
    .map((row) => ({
      body: announcement.body,
      business_id: row.business_id,
      link: "/dashboard",
      recipient_user_id: row.user_id,
      title: announcement.title,
      type: "system",
    }));

  if (rows.length === 0) {
    return;
  }

  await adminClient.from("notifications").insert(rows);
};

const buildBusinessRows = async (adminClient: ReturnType<typeof createClient>) => {
  const [
    businessesResponse,
    overridesResponse,
    invoiceCountsResponse,
    memberCountsResponse,
    authUsers,
  ] = await Promise.all([
    adminClient.from("businesses").select("id, name, email, created_at, owner_user_id, default_currency"),
    adminClient.from("business_admin_overrides").select(
      "business_id, status, plan, payouts_frozen, payout_approval_threshold_amount, payout_limit_per_transaction_amount, payout_limit_daily_amount, payout_limit_weekly_amount",
    ),
    adminClient.from("invoices").select("id, business_id"),
    adminClient.from("business_members").select("id, business_id").eq("status", "active"),
    listAllAuthUsers(adminClient),
  ]);

  if (businessesResponse.error) throw businessesResponse.error;
  if (overridesResponse.error) throw overridesResponse.error;
  if (invoiceCountsResponse.error) throw invoiceCountsResponse.error;
  if (memberCountsResponse.error) throw memberCountsResponse.error;

  const authUserById = new Map(authUsers.map((user) => [user.id, user]));
  const overridesByBusinessId = new Map(
    (overridesResponse.data ?? []).map((row) => [asString(row.business_id), row]),
  );
  const invoiceCountByBusinessId = new Map<string, number>();
  const memberCountByBusinessId = new Map<string, number>();

  for (const row of invoiceCountsResponse.data ?? []) {
    const businessId = asString(row.business_id);
    invoiceCountByBusinessId.set(businessId, (invoiceCountByBusinessId.get(businessId) ?? 0) + 1);
  }

  for (const row of memberCountsResponse.data ?? []) {
    const businessId = asString(row.business_id);
    memberCountByBusinessId.set(businessId, (memberCountByBusinessId.get(businessId) ?? 0) + 1);
  }

  return (businessesResponse.data ?? []).map((business) => {
    const override = overridesByBusinessId.get(asString(business.id));
    const owner = authUserById.get(asString(business.owner_user_id));

    return {
      businessId: asString(business.id),
      businessName: asString(business.name),
      createdAt: asString(business.created_at),
      defaultCurrency: asString(business.default_currency) || "NGN",
      email: asNullableString(business.email),
      invoiceCount: invoiceCountByBusinessId.get(asString(business.id)) ?? 0,
      memberCount: memberCountByBusinessId.get(asString(business.id)) ?? 0,
      ownerEmail: owner?.email ?? "Unknown",
      ownerName: typeof owner?.user_metadata?.name === "string" ? owner.user_metadata.name : null,
      plan: (asString(override?.plan) || "starter") as "business" | "growth" | "starter",
      payoutsFrozen: Boolean(asRecord(override ?? {}).payouts_frozen),
      payoutApprovalThresholdAmount: asNumber(asRecord(override ?? {}).payout_approval_threshold_amount),
      payoutLimitDailyAmount: asNumber(asRecord(override ?? {}).payout_limit_daily_amount),
      payoutLimitPerTransactionAmount: asNumber(asRecord(override ?? {}).payout_limit_per_transaction_amount),
      payoutLimitWeeklyAmount: asNumber(asRecord(override ?? {}).payout_limit_weekly_amount),
      status: (asString(override?.status) || "active") as "active" | "pending" | "suspended",
    };
  });
};

const buildUserRows = async (adminClient: ReturnType<typeof createClient>, search = "") => {
  const [userOverridesResponse, businessMembersResponse, businessesResponse, authUsers] = await Promise.all([
    adminClient.from("user_admin_overrides").select("user_id, status"),
    adminClient.from("business_members").select("user_id, role, business_id, status"),
    adminClient.from("businesses").select("id, name"),
    listAllAuthUsers(adminClient),
  ]);

  if (userOverridesResponse.error) throw userOverridesResponse.error;
  if (businessMembersResponse.error) throw businessMembersResponse.error;
  if (businessesResponse.error) throw businessesResponse.error;

  const businessNameById = new Map((businessesResponse.data ?? []).map((business) => [asString(business.id), asString(business.name)]));
  const overrideByUserId = new Map((userOverridesResponse.data ?? []).map((row) => [asString(row.user_id), asString(row.status)]));
  const membersByUserId = new Map<string, Array<Record<string, unknown>>>();

  for (const member of businessMembersResponse.data ?? []) {
    const userId = asString(member.user_id);
    const existing = membersByUserId.get(userId) ?? [];
    existing.push(asRecord(member));
    membersByUserId.set(userId, existing);
  }

  return authUsers.map((authUser) => {
    const memberships = membersByUserId.get(authUser.id) ?? [];
    const workspaceNames = memberships.map((membership) => businessNameById.get(asString(membership.business_id)) ?? "Workspace");
    const role = asString(memberships[0]?.role) || "viewer";
    const authFactors = Array.isArray((authUser.app_metadata ?? {}).providers)
      ? (authUser.app_metadata?.providers as unknown[])
      : [];
    const userMetadata = asRecord(authUser.user_metadata ?? {});
    const appMetadata = asRecord(authUser.app_metadata ?? {});
    const isTestUser = userMetadata.is_test_user === true || userMetadata.test_user === true || [
      asString(userMetadata.environment),
      asString(appMetadata.environment),
    ].some((value) => ["test", "qa", "sandbox"].includes(value.toLowerCase()));

    return {
      email: authUser.email ?? "Unknown",
      fullName: typeof authUser.user_metadata?.name === "string" ? authUser.user_metadata.name : null,
      isTestUser,
      lastActive: authUser.last_sign_in_at ?? null,
      mfaEnabled: authFactors.length > 1 || Boolean((authUser.app_metadata ?? {}).aal),
      role,
      status: (overrideByUserId.get(authUser.id) || (authUser.last_sign_in_at ? "active" : "inactive")) as "active" | "inactive" | "suspended",
      userId: authUser.id,
      workspaces: workspaceNames,
    };
  }).filter((row) => {
    if (!search) {
      return true;
    }

    return `${row.email} ${row.fullName ?? ""} ${row.workspaces.join(" ")}`.toLowerCase().includes(search);
  });
};

const getOwnedBusinessNames = async (adminClient: ReturnType<typeof createClient>, userId: string) => {
  const response = await adminClient
    .from("businesses")
    .select("name")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });

  if (response.error) {
    throw response.error;
  }

  return (response.data ?? []).map((row) => asString(row.name)).filter(Boolean);
};

const buildOverview = async (adminClient: ReturnType<typeof createClient>) => {
  const [businessRows, subscriptionRows, invoicesResponse, paymentsResponse, healthChecksResponse, webhookEventsResponse, authUsers] = await Promise.all([
    buildBusinessRows(adminClient),
    buildSubscriptionRows(adminClient),
    adminClient.from("invoices").select("id, business_id, created_at, total_amount"),
    adminClient.from("payments").select("id, amount, status, created_at, paid_on"),
    adminClient.from("platform_health_checks").select("*").order("checked_at", { ascending: false }).limit(200),
    adminClient.from("platform_webhook_events").select("*").order("received_at", { ascending: false }).limit(20),
    listAllAuthUsers(adminClient),
  ]);

  if (invoicesResponse.error) throw invoicesResponse.error;
  if (paymentsResponse.error) throw paymentsResponse.error;
  if (healthChecksResponse.error) throw healthChecksResponse.error;
  if (webhookEventsResponse.error) throw webhookEventsResponse.error;

  const now = new Date();
  const currentMonth = monthStamp(now.toISOString());
  const previousWindowStart = new Date(now);
  previousWindowStart.setDate(previousWindowStart.getDate() - 60);
  const recentWindowStart = new Date(now);
  recentWindowStart.setDate(recentWindowStart.getDate() - 30);
  const currentDate = todayDate();
  const healthRows = (healthChecksResponse.data ?? []).map((row) => asRecord(row));
  const latestHealthChecks = groupLatestHealthChecks(healthRows);
  const uptimeOperationalChecks = latestHealthChecks.filter((row) => row.status === "operational").length;
  const uptimeLabel = latestHealthChecks.length === 0
    ? "100.0%"
    : `${((uptimeOperationalChecks / latestHealthChecks.length) * 100).toFixed(1)}%`;

  const currentWindowUsers = authUsers.filter((user) => {
    const createdAt = asNullableString(user.created_at);
    return createdAt ? new Date(createdAt) >= recentWindowStart : false;
  }).length;
  const previousWindowUsers = authUsers.filter((user) => {
    const createdAt = asNullableString(user.created_at);
    if (!createdAt) {
      return false;
    }

    const createdDate = new Date(createdAt);
    return createdDate >= previousWindowStart && createdDate < recentWindowStart;
  }).length;

  const activeUsersChangePct = previousWindowUsers === 0
    ? currentWindowUsers > 0 ? 100 : 0
    : Math.round(((currentWindowUsers - previousWindowUsers) / previousWindowUsers) * 100);

  const registrationBuckets = new Map<string, number>();
  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - offset);
    registrationBuckets.set(date.toISOString().slice(0, 10), 0);
  }

  for (const business of businessRows) {
    const key = business.createdAt.slice(0, 10);
    if (registrationBuckets.has(key)) {
      registrationBuckets.set(key, (registrationBuckets.get(key) ?? 0) + 1);
    }
  }

  const recentRegistrations = Array.from(registrationBuckets.entries()).map(([date, count]) => ({
    count,
    date,
    label: date.slice(5),
  }));

  const latestBusinesses = [...businessRows]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);

  const completedPayments = (paymentsResponse.data ?? []).filter((payment) => asString(payment.status) === "completed");
  const completedPaymentsAmount = completedPayments.reduce((sum, payment) => sum + asNumber(payment.amount), 0);
  const platformRevenueThisMonth = subscriptionRows.reduce(
    (sum, row) => sum + getMonthlyRecurringValue({
      amount: row.amount,
      billingCycle: row.billingCycle,
      status: row.status,
    }),
    0,
  );
  const paymentsConfirmedToday = completedPayments.filter((payment) => asString(payment.paid_on) === currentDate).length;
  const invoiceVolumeToday = (invoicesResponse.data ?? []).filter((invoice) => asString(invoice.created_at).slice(0, 10) === currentDate).length;
  const failedWebhookEvents24h = (webhookEventsResponse.data ?? []).filter((event) => {
    const receivedAt = asNullableString(event.received_at);
    return asString(event.status) === "failed" && receivedAt ? new Date(receivedAt).getTime() >= now.getTime() - (24 * 60 * 60 * 1000) : false;
  }).length;

  return {
    generatedAt: new Date().toISOString(),
    health: {
      allSystemsOperational: latestHealthChecks.every((row) => row.status === "operational"),
      failedWebhookEvents24h,
      invoiceVolumeToday,
      paymentsConfirmedToday,
      responseTimeSamples: getResponseTimeSamples(healthRows.filter((row) => asString(row.service) === "Supabase Database")),
      services: latestHealthChecks,
      uptimeLabel,
      webhookEvents: (webhookEventsResponse.data ?? []).map((row) => ({
        amount: row.amount === null ? null : asNumber(row.amount),
        businessName: "Platform",
        eventType: asString(row.event_type),
        id: asString(row.id),
        processingTimeMs: row.processing_time_ms === null ? null : asNumber(row.processing_time_ms),
        receivedAt: asString(row.received_at),
        status: asString(row.status),
      })),
    },
    latestBusinesses,
    metrics: {
      activeUsers: {
        changePct: activeUsersChangePct,
        value: currentWindowUsers,
      },
      platformRevenueThisMonth,
      platformUptime: uptimeLabel,
      totalBusinesses: {
        monthlyDelta: businessRows.filter((row) => monthStamp(row.createdAt) === currentMonth).length,
        value: businessRows.length,
      },
      totalInvoices: (invoicesResponse.data ?? []).length,
      totalPaymentsProcessed: completedPaymentsAmount,
    },
    recentRegistrations,
  };
};

const sendBusinessNotice = async ({
  adminClient,
  businessId,
  message,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  message: string;
}) => {
  const { data: business } = await adminClient.from("businesses").select("name").eq("id", businessId).maybeSingle();
  const { data: members } = await adminClient
    .from("business_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("status", "active");

  if ((members ?? []).length === 0) {
    return;
  }

  await adminClient.from("notifications").insert(
    (members ?? []).map((member) => ({
      body: message,
      business_id: businessId,
      link: "/dashboard",
      recipient_user_id: member.user_id,
      title: `Notice from Moniger`,
      type: "system",
    })),
  );

  await adminClient.from("announcements").insert({
    body: message,
    created_by: null,
    published_at: new Date().toISOString(),
    target: "all",
    target_filters: { businessIds: [businessId] },
    title: `Notice for ${asString(business?.name) || "workspace"}`,
    type: "info",
  });
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

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for the admin console." }, 500);
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
    return json({ error: "You need an active session before using the admin console." }, 401);
  }

  const { data: adminAccess } = await adminClient
    .from("admin_users")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!adminAccess) {
    return json({ error: "Access denied. This area is restricted." }, 403);
  }

  let requestBody: AdminConsoleRequest;

  try {
    requestBody = (await request.json()) as AdminConsoleRequest;
  } catch {
    return json({ error: "The admin console request body is invalid." }, 400);
  }

  const payload = requestBody.payload ?? {};

  try {
    switch (requestBody.action) {
      case "overview": {
        return json(await buildOverview(adminClient));
      }

      case "businesses.list": {
        const search = normalizeSearch(payload.search);
        const statusFilter = normalizeSearch(payload.status);
        const planFilter = normalizeSearch(payload.plan);
        const joinedFilter = normalizeSearch(payload.joined);
        const rows = await buildBusinessRows(adminClient);
        const now = new Date();
        const currentMonth = monthStamp(now.toISOString());
        const lastMonthDate = new Date(now);
        lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
        const lastMonth = monthStamp(lastMonthDate.toISOString());
        const filteredRows = rows.filter((row) => {
          if (search) {
            const haystack = `${row.businessId} ${row.businessName} ${row.ownerEmail}`.toLowerCase();
            if (!haystack.includes(search)) {
              return false;
            }
          }

          if (statusFilter && statusFilter !== "all" && row.status !== statusFilter) {
            return false;
          }

          if (planFilter && planFilter !== "all" && row.plan !== planFilter) {
            return false;
          }

          if (joinedFilter === "this month" && monthStamp(row.createdAt) !== currentMonth) {
            return false;
          }

          if (joinedFilter === "last month" && monthStamp(row.createdAt) !== lastMonth) {
            return false;
          }

          return true;
        });

        return json({
          rows: filteredRows.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
          total: filteredRows.length,
        });
      }

      case "businesses.detail": {
        const businessId = asString(payload.businessId);
        if (!businessId) {
          return json({ error: "Business id is required." }, 400);
        }

        const [businessRows, businessResponse, profilesResponse, membersResponse, customersResponse, invoicesResponse, billsResponse, paymentsResponse, auditResponse, overrideResponse] = await Promise.all([
          buildBusinessRows(adminClient),
          adminClient.from("businesses").select("*").eq("id", businessId).maybeSingle(),
          adminClient.from("profiles").select("id, full_name, phone"),
          adminClient.from("business_members").select("*").eq("business_id", businessId).order("joined_at", { ascending: false }),
          adminClient.from("customers").select("id, name").eq("business_id", businessId),
          adminClient.from("invoices").select("id, invoice_number, total_amount, status, customer_id").eq("business_id", businessId).order("created_at", { ascending: false }).limit(10),
          adminClient.from("bills").select("id").eq("business_id", businessId),
          adminClient.from("payments").select("id, amount, status").eq("business_id", businessId),
          adminClient.from("audit_logs").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
          adminClient.from("business_admin_overrides").select(
            "business_id, payouts_frozen, payout_approval_threshold_amount, payout_limit_per_transaction_amount, payout_limit_daily_amount, payout_limit_weekly_amount",
          ).eq("business_id", businessId).maybeSingle(),
        ]);

        if (businessResponse.error) throw businessResponse.error;
        if (profilesResponse.error) throw profilesResponse.error;
        if (membersResponse.error) throw membersResponse.error;
        if (customersResponse.error) throw customersResponse.error;
        if (invoicesResponse.error) throw invoicesResponse.error;
        if (billsResponse.error) throw billsResponse.error;
        if (paymentsResponse.error) throw paymentsResponse.error;
        if (auditResponse.error) throw auditResponse.error;
        if (overrideResponse.error) throw overrideResponse.error;

        const businessListRow = businessRows.find((row) => row.businessId === businessId);
        if (!businessResponse.data || !businessListRow) {
          return json({ error: "Business not found." }, 404);
        }

        const authUsers = await listAllAuthUsers(adminClient);
        const authUserById = new Map(authUsers.map((authUser) => [authUser.id, authUser]));
        const profilesById = new Map((profilesResponse.data ?? []).map((profile) => [asString(profile.id), profile]));
        const customersById = new Map((customersResponse.data ?? []).map((customer) => [asString(customer.id), asString(customer.name)]));

        return json({
          activity: (auditResponse.data ?? []).map((row) => ({
            action: asString(row.action),
            createdAt: asString(row.created_at),
            detail: asRecord(row.detail),
            id: row.id as number | string,
            summary: asString(row.summary),
          })),
          business: {
            address: asNullableString(businessResponse.data.address),
            businessId,
            businessName: businessListRow.businessName,
            createdAt: businessListRow.createdAt,
            email: asNullableString(businessResponse.data.email),
            legalName: asNullableString(businessResponse.data.legal_name),
            ownerEmail: businessListRow.ownerEmail,
            ownerName: businessListRow.ownerName,
            phone: asNullableString(businessResponse.data.phone),
            plan: businessListRow.plan,
            payoutsFrozen: Boolean(overrideResponse.data?.payouts_frozen ?? businessListRow.payoutsFrozen),
            payoutApprovalThresholdAmount: asNumber(
              overrideResponse.data?.payout_approval_threshold_amount ?? businessListRow.payoutApprovalThresholdAmount,
            ),
            payoutLimitDailyAmount: asNumber(overrideResponse.data?.payout_limit_daily_amount ?? businessListRow.payoutLimitDailyAmount),
            payoutLimitPerTransactionAmount: asNumber(
              overrideResponse.data?.payout_limit_per_transaction_amount ?? businessListRow.payoutLimitPerTransactionAmount,
            ),
            payoutLimitWeeklyAmount: asNumber(overrideResponse.data?.payout_limit_weekly_amount ?? businessListRow.payoutLimitWeeklyAmount),
            status: businessListRow.status,
          },
          invoices: (invoicesResponse.data ?? []).map((invoice) => ({
            amount: asNumber(invoice.total_amount),
            customerName: customersById.get(asString(invoice.customer_id)) ?? "Customer",
            invoiceId: asString(invoice.id),
            invoiceNumber: asString(invoice.invoice_number),
            status: asString(invoice.status),
          })),
          members: (membersResponse.data ?? []).map((member) => {
            const profile = profilesById.get(asString(member.user_id));
            const authUser = authUserById.get(asString(member.user_id));

            return {
              email: authUser?.email ?? "Unknown",
              fullName: typeof profile?.full_name === "string" ? profile.full_name : null,
              lastActive: authUser?.last_sign_in_at ?? null,
              membershipId: asString(member.id),
              role: asString(member.role),
              status: asString(member.status),
              userId: asString(member.user_id),
            };
          }),
          stats: {
            totalBills: (billsResponse.data ?? []).length,
            totalInvoices: (invoicesResponse.data ?? []).length,
            totalPaymentsProcessed: (paymentsResponse.data ?? [])
              .filter((payment) => asString(payment.status) === "completed")
              .reduce((sum, payment) => sum + asNumber(payment.amount), 0),
          },
        });
      }

      case "businesses.invoices": {
        const businessId = asString(payload.businessId);
        const [businessResponse, customersResponse, invoicesResponse] = await Promise.all([
          adminClient.from("businesses").select("name").eq("id", businessId).maybeSingle(),
          adminClient.from("customers").select("id, name").eq("business_id", businessId),
          adminClient.from("invoices").select("id, invoice_number, issue_date, due_date, total_amount, status, customer_id").eq("business_id", businessId).order("created_at", { ascending: false }),
        ]);

        if (businessResponse.error) throw businessResponse.error;
        if (customersResponse.error) throw customersResponse.error;
        if (invoicesResponse.error) throw invoicesResponse.error;

        const customersById = new Map((customersResponse.data ?? []).map((customer) => [asString(customer.id), asString(customer.name)]));

        return json({
          businessName: asString(businessResponse.data?.name) || "Business",
          invoices: (invoicesResponse.data ?? []).map((invoice) => ({
            amount: asNumber(invoice.total_amount),
            customerName: customersById.get(asString(invoice.customer_id)) ?? "Customer",
            dueDate: asNullableString(invoice.due_date),
            invoiceId: asString(invoice.id),
            invoiceNumber: asString(invoice.invoice_number),
            issueDate: asString(invoice.issue_date),
            status: asString(invoice.status),
          })),
        });
      }

      case "businesses.export": {
        const businessId = asString(payload.businessId);
        const [business, members, invoices, bills, payments, audit] = await Promise.all([
          adminClient.from("businesses").select("*").eq("id", businessId).maybeSingle(),
          adminClient.from("business_members").select("*").eq("business_id", businessId),
          adminClient.from("invoices").select("*").eq("business_id", businessId),
          adminClient.from("bills").select("*").eq("business_id", businessId),
          adminClient.from("payments").select("*").eq("business_id", businessId),
          adminClient.from("audit_logs").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
        ]);

        await insertAdminAuditLog({
          action: "admin_business_exported",
          actorUserId: user.id,
          adminClient,
          businessId,
          detail: { business_id: businessId },
          entityId: businessId,
          entityType: "business",
          summary: "Business data exported",
        });

        return json({
          audit: audit.data ?? [],
          bills: bills.data ?? [],
          business: business.data ?? null,
          invoices: invoices.data ?? [],
          members: members.data ?? [],
          payments: payments.data ?? [],
        });
      }

      case "businesses.action": {
        const businessId = asString(payload.businessId);
        const action = asString(payload.type);
        const message = asString(payload.message);

        if (!businessId || !action) {
          return json({ error: "Missing business action context." }, 400);
        }

        if (action === "suspend" || action === "unsuspend") {
          const nextStatus = action === "suspend" ? "suspended" : "active";
          await adminClient.from("business_admin_overrides").upsert({
            business_id: businessId,
            status: nextStatus,
            updated_by: user.id,
          });
          await insertAdminAuditLog({
            action: `admin_business_${action}`,
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: { business_id: businessId, next_status: nextStatus },
            entityId: businessId,
            entityType: "business",
            summary: action === "suspend" ? "Business suspended" : "Business restored",
          });
          return json({ ok: true });
        }

        if (action === "freeze_payouts" || action === "unfreeze_payouts") {
          const payoutsFrozen = action === "freeze_payouts";
          await adminClient.from("business_admin_overrides").upsert({
            business_id: businessId,
            payouts_frozen: payoutsFrozen,
            updated_by: user.id,
          });
          await insertAdminAuditLog({
            action: payoutsFrozen ? "admin_business_payouts_frozen" : "admin_business_payouts_unfrozen",
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: { business_id: businessId, payouts_frozen: payoutsFrozen },
            entityId: businessId,
            entityType: "business",
            summary: payoutsFrozen ? "Business payouts frozen" : "Business payouts unfrozen",
          });
          return json({ ok: true });
        }

        if (action === "set_payout_threshold") {
          const thresholdAmount = asNumber(payload.thresholdAmount);

          if (!Number.isFinite(thresholdAmount) || thresholdAmount < 0) {
            return json({ error: "Enter a valid payout approval threshold." }, 400);
          }

          await adminClient.from("business_admin_overrides").upsert({
            business_id: businessId,
            payout_approval_threshold_amount: thresholdAmount,
            updated_by: user.id,
          });

          await insertAdminAuditLog({
            action: "admin_business_payout_threshold_updated",
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: { business_id: businessId, payout_approval_threshold_amount: thresholdAmount },
            entityId: businessId,
            entityType: "business",
            summary: "Business payout approval threshold updated",
          });

          return json({ ok: true });
        }

        if (action === "set_payout_limits") {
          const perTransactionAmount = asNumber(payload.perTransactionAmount);
          const dailyAmount = asNumber(payload.dailyAmount);
          const weeklyAmount = asNumber(payload.weeklyAmount);

          if (
            !Number.isFinite(perTransactionAmount) ||
            perTransactionAmount < 0 ||
            !Number.isFinite(dailyAmount) ||
            dailyAmount < 0 ||
            !Number.isFinite(weeklyAmount) ||
            weeklyAmount < 0
          ) {
            return json({ error: "Enter valid payout limits." }, 400);
          }

          await adminClient.from("business_admin_overrides").upsert({
            business_id: businessId,
            payout_limit_daily_amount: dailyAmount,
            payout_limit_per_transaction_amount: perTransactionAmount,
            payout_limit_weekly_amount: weeklyAmount,
            updated_by: user.id,
          });

          await insertAdminAuditLog({
            action: "admin_business_payout_limits_updated",
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: {
              business_id: businessId,
              payout_limit_daily_amount: dailyAmount,
              payout_limit_per_transaction_amount: perTransactionAmount,
              payout_limit_weekly_amount: weeklyAmount,
            },
            entityId: businessId,
            entityType: "business",
            summary: "Business payout limits updated",
          });

          return json({ ok: true });
        }

        if (action === "send_notice") {
          if (!message) {
            return json({ error: "Notice message is required." }, 400);
          }

          await sendBusinessNotice({
            adminClient,
            businessId,
            message,
          });
          await insertAdminAuditLog({
            action: "admin_business_notice_sent",
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: { business_id: businessId, message },
            entityId: businessId,
            entityType: "business",
            summary: "Business notice sent",
          });
          return json({ ok: true });
        }

        if (action === "delete") {
          if (asString(adminAccess.role) !== "super_admin") {
            return json({ error: "Only super admins can delete businesses." }, 403);
          }

          await adminClient.from("businesses").delete().eq("id", businessId);
          await insertAdminAuditLog({
            action: "admin_business_deleted",
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: { business_id: businessId },
            entityId: businessId,
            entityType: "business",
            summary: "Business deleted",
          });
          return json({ ok: true });
        }

        if (action === "impersonate") {
          await insertAdminAuditLog({
            action: "admin_impersonate_start",
            actorUserId: user.id,
            adminClient,
            businessId,
            detail: { business_id: businessId },
            entityId: businessId,
            entityType: "business",
            summary: "Admin impersonation started",
          });

          return json({
            expiresInMinutes: 30,
            launchUrl: `/dashboard?admin_impersonate=true&business_id=${encodeURIComponent(businessId)}`,
          });
        }

        return json({ error: "Unsupported business action." }, 400);
      }

      case "users.list": {
        const search = normalizeSearch(payload.search);
        const rows = await buildUserRows(adminClient, search);

        return json({
          rows,
          total: rows.length,
        });
      }

      case "users.action": {
        const targetUserId = asString(payload.userId);
        const action = asString(payload.type);

        if (!targetUserId || !action) {
          return json({ error: "Missing user action context." }, 400);
        }

        if (action === "suspend" || action === "unsuspend") {
          await adminClient.from("user_admin_overrides").upsert({
            status: action === "suspend" ? "suspended" : "active",
            updated_by: user.id,
            user_id: targetUserId,
          });

          await insertAdminAuditLog({
            action: action === "suspend" ? "admin_user_suspended" : "admin_user_restored",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: { target_user_id: targetUserId },
            entityId: targetUserId,
            entityType: "profile",
            summary: action === "suspend" ? "User suspended" : "User restored",
          });

          return json({ ok: true });
        }

        if (action === "delete") {
          if (asString(adminAccess.role) !== "super_admin") {
            return json({ error: "Only super admins can delete users." }, 403);
          }

          if (targetUserId === user.id) {
            return json({ error: "You cannot delete your own admin account from the admin console." }, 400);
          }

          const ownedBusinessNames = await getOwnedBusinessNames(adminClient, targetUserId);
          if (ownedBusinessNames.length > 0) {
            return json({
              error: `This user cannot be deleted yet because they still own workspace${ownedBusinessNames.length === 1 ? "" : "s"}: ${ownedBusinessNames.join(", ")}. Transfer or remove those workspaces first.`,
            }, 400);
          }

          const deleteResponse = await adminClient.auth.admin.deleteUser(targetUserId);
          if (deleteResponse.error) {
            throw deleteResponse.error;
          }

          await insertAdminAuditLog({
            action: "admin_user_deleted",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: { target_user_id: targetUserId },
            entityId: targetUserId,
            entityType: "profile",
            summary: "User deleted",
          });

          return json({ ok: true });
        }

        if (action === "reset_password") {
          const authUser = await resolveAuthUserById(adminClient, targetUserId);
          const email = asNullableString(authUser.email);

          if (!email) {
            return json({ error: "That account does not have an email address to reset." }, 400);
          }

          const { redirectTo } = await sendPasswordResetEmail({
            adminClient,
            email,
            request,
          });

          await insertAdminAuditLog({
            action: "admin_user_password_reset_requested",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              email,
              redirect_to: redirectTo,
              target_user_id: targetUserId,
            },
            entityId: targetUserId,
            entityType: "profile",
            summary: "Password reset requested",
          });

          return json({
            ok: true,
            message: `Password reset email sent to ${email}.`,
          });
        }

        if (action === "revoke_sessions") {
          await insertAdminAuditLog({
            action: "admin_user_sessions_revoked",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: { target_user_id: targetUserId },
            entityId: targetUserId,
            entityType: "profile",
            summary: "User sessions revoked",
          });

          return json({
            ok: true,
            message: "Session revocation recorded.",
          });
        }

        return json({ error: "Unsupported user action." }, 400);
      }

      case "subscriptions.list": {
        const search = normalizeSearch(payload.search);
        const statusFilter = normalizeSearch(payload.status);
        const planFilter = normalizeSearch(payload.plan);
        const billingCycleFilter = normalizeSearch(payload.billingCycle);
        const rows = await buildSubscriptionRows(adminClient);
        const now = Date.now();
        const filteredRows = rows.filter((row) => {
          if (search) {
            const haystack = `${row.businessId} ${row.businessName} ${row.ownerEmail} ${row.provider}`.toLowerCase();
            if (!haystack.includes(search)) {
              return false;
            }
          }

          if (statusFilter && statusFilter !== "all" && row.status !== statusFilter) {
            return false;
          }

          if (planFilter && planFilter !== "all" && row.plan !== planFilter) {
            return false;
          }

          if (billingCycleFilter && billingCycleFilter !== "all" && row.billingCycle !== billingCycleFilter) {
            return false;
          }

          return true;
        }).sort((left, right) => {
          const leftRenewal = left.nextRenewalAt ? new Date(left.nextRenewalAt).getTime() : Number.MAX_SAFE_INTEGER;
          const rightRenewal = right.nextRenewalAt ? new Date(right.nextRenewalAt).getTime() : Number.MAX_SAFE_INTEGER;
          return leftRenewal - rightRenewal;
        });

        return json({
          metrics: {
            activeSubscriptions: filteredRows.filter((row) => row.status === "active" || row.status === "trial").length,
            annualizedRevenue: filteredRows.reduce(
              (sum, row) =>
                sum + (
                  getMonthlyRecurringValue({
                    amount: row.amount,
                    billingCycle: row.billingCycle,
                    status: row.status,
                  }) * 12
                ),
              0,
            ),
            monthlyRecurringRevenue: filteredRows.reduce(
              (sum, row) =>
                sum + getMonthlyRecurringValue({
                  amount: row.amount,
                  billingCycle: row.billingCycle,
                  status: row.status,
                }),
              0,
            ),
            renewalsDueSoon: filteredRows.filter((row) => {
              if (!row.nextRenewalAt || row.status === "cancelled") {
                return false;
              }

              const renewalTime = new Date(row.nextRenewalAt).getTime();
              return renewalTime >= now && renewalTime <= now + (14 * 24 * 60 * 60 * 1000);
            }).length,
          },
          rows: filteredRows,
          total: filteredRows.length,
        });
      }

      case "subscriptions.update": {
        const businessId = asString(payload.businessId);
        if (!businessId) {
          return json({ error: "Business id is required." }, 400);
        }

        const plan = (asString(payload.plan) || "starter") as "business" | "growth" | "starter";
        const defaults = getDefaultSubscriptionConfig(plan);
        const status = normalizeSubscriptionStatus(asString(payload.status) || "active");
        const billingCycle = normalizeBillingCycle(asString(payload.billingCycle) || defaults.billingCycle);
        const amountValue = payload.amount === null || typeof payload.amount === "undefined"
          ? defaults.amount
          : asNumber(payload.amount);
        const nextRenewalAt = asNullableString(payload.nextRenewalAt);
        const cancelAtPeriodEnd = Boolean(payload.cancelAtPeriodEnd);
        const cancelledAt = status === "cancelled"
          ? asNullableString(payload.cancelledAt) ?? new Date().toISOString()
          : null;

        const subscriptionUpdateResponse = await adminClient.from("business_subscriptions").upsert({
          amount: amountValue,
          billing_cycle: billingCycle,
          business_id: businessId,
          cancel_at_period_end: cancelAtPeriodEnd,
          cancelled_at: cancelledAt,
          currency: asString(payload.currency) || defaults.currency,
          next_renewal_at: nextRenewalAt,
          notes: asNullableString(payload.notes),
          plan,
          provider: asString(payload.provider) || "manual",
          provider_customer_id: asNullableString(payload.providerCustomerId),
          provider_subscription_id: asNullableString(payload.providerSubscriptionId),
          started_at: asNullableString(payload.startedAt) ?? new Date().toISOString(),
          status,
          updated_by: user.id,
        });

        if (subscriptionUpdateResponse.error) {
          throw subscriptionUpdateResponse.error;
        }

        const businessOverrideResponse = await adminClient.from("business_admin_overrides").upsert({
          business_id: businessId,
          plan,
          updated_by: user.id,
        });

        if (businessOverrideResponse.error) {
          throw businessOverrideResponse.error;
        }

        await insertAdminAuditLog({
          action: "admin_subscription_updated",
          actorUserId: user.id,
          adminClient,
          businessId,
          detail: {
            amount: amountValue,
            billing_cycle: billingCycle,
            business_id: businessId,
            cancel_at_period_end: cancelAtPeriodEnd,
            next_renewal_at: nextRenewalAt,
            plan,
            provider: asString(payload.provider) || "manual",
            status,
          },
          entityId: businessId,
          entityType: "subscription",
          summary: "Business subscription updated",
        });

        return json({ ok: true });
      }

      case "payments.list":
      case "payments.export": {
        const businessRows = await buildBusinessRows(adminClient);
        const paymentsResponse = await adminClient
          .from("payments")
          .select("id, business_id, payment_reference, payment_type, amount, status, gateway_response, created_at, metadata, is_test_data, bill_id, invoice_id")
          .order("created_at", { ascending: false });

        if (paymentsResponse.error) throw paymentsResponse.error;

        const businessNameById = new Map(businessRows.map((row) => [row.businessId, row.businessName]));
        const payments = (paymentsResponse.data ?? []).map((row) => row as Record<string, unknown>);
        const { billsById, invoicesById } = await loadLinkedPaymentContext(adminClient, payments);
        const rows = payments.map((payment) =>
          buildAdminPaymentRow({
            billsById,
            businessNameById,
            invoicesById,
            payment,
          })
        );
        const currentMonth = monthStamp(new Date().toISOString());
        const completedRows = rows.filter((row) => row.status === "completed");

        if (requestBody.action === "payments.export") {
          await insertAdminAuditLog({
            action: "admin_payments_exported",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: { row_count: rows.length },
            entityId: null,
            entityType: "payment_export",
            summary: "Payments exported",
          });
        }

        return json({
          metrics: {
            failedThisMonth: rows.filter((row) => row.status === "failed" && monthStamp(row.date) === currentMonth).length,
            processedThisMonth: completedRows
              .filter((row) => monthStamp(row.date) === currentMonth)
              .reduce((sum, row) => sum + row.amount, 0),
            totalProcessedAllTime: completedRows.reduce((sum, row) => sum + row.amount, 0),
          },
          rows,
        });
      }

      case "payments.reconcile": {
        const paymentId = asString(payload.paymentId);

        if (!paymentId) {
          return json({ error: "Payment id is required." }, 400);
        }

        const paymentResponse = await adminClient
          .from("payments")
          .select("id, business_id, payment_reference, payment_type, amount, status, gateway_response, created_at, metadata, bill_id, invoice_id, paid_on")
          .eq("id", paymentId)
          .single();

        if (paymentResponse.error) {
          if ("code" in paymentResponse.error && paymentResponse.error.code === "PGRST116") {
            return json({ error: "Payment not found." }, 404);
          }

          throw paymentResponse.error;
        }

        const payment = paymentResponse.data as Record<string, unknown>;
        const businessId = asString(payment.business_id);
        const businessRows = await buildBusinessRows(adminClient);
        const businessNameById = new Map(businessRows.map((row) => [row.businessId, row.businessName]));
        const { billsById, invoicesById } = await loadLinkedPaymentContext(adminClient, [payment]);
        const invoice = invoicesById.get(asString(payment.invoice_id)) ?? null;
        const bill = billsById.get(asString(payment.bill_id)) ?? null;
        const reconciliation = buildPaymentReconciliationSummary({ bill, invoice, payment });
        const checkedAt = new Date().toISOString();
        const paymentMetadata = asRecord(payment.metadata);
        let nextStatus = asString(payment.status);
        let nextGatewayResponse = asNullableString(payment.gateway_response);
        let nextPaidOn = asNullableString(payment.paid_on);
        let resolutionMessage = reconciliation.summary;

        if (invoice) {
          const invoiceStatus = asString(invoice.status);

          if (invoiceStatus === "paid") {
            nextStatus = "completed";
            nextPaidOn = toDateOnly(asNullableString(invoice.paid_at), nextPaidOn, asNullableString(invoice.due_date), asNullableString(invoice.issue_date));
            nextGatewayResponse = "Reconciled from the linked invoice. Invoice is marked paid in Moniger.";
            resolutionMessage = "Payment marked completed from linked invoice status.";
          } else if (invoiceStatus === "cancelled") {
            nextStatus = "failed";
            nextGatewayResponse = "Reconciled from the linked invoice. Invoice was cancelled in Moniger.";
            resolutionMessage = "Payment marked failed because the linked invoice was cancelled.";
          } else if (invoiceStatus === "overdue") {
            nextStatus = "pending";
            nextPaidOn = toDateOnly(nextPaidOn, asNullableString(invoice.due_date), asNullableString(invoice.issue_date));
            nextGatewayResponse = "Invoice is overdue and still unpaid. Pending means the receivable remains open.";
            resolutionMessage = "Payment remains pending because the linked invoice is overdue and still open.";
          } else {
            nextStatus = "pending";
            nextPaidOn = toDateOnly(nextPaidOn, asNullableString(invoice.due_date), asNullableString(invoice.issue_date));
            nextGatewayResponse = "Invoice is still awaiting customer payment.";
            resolutionMessage = "Payment remains pending because the linked invoice is still open.";
          }
        } else if (bill) {
          const billStatus = asString(bill.status);

          if (billStatus === "paid") {
            nextStatus = "completed";
            nextPaidOn = toDateOnly(
              asNullableString(bill.scheduled_payment_date),
              asNullableString(bill.due_date),
              asNullableString(bill.updated_at),
              asNullableString(bill.bill_date),
              nextPaidOn,
            );
            nextGatewayResponse = "Reconciled from the linked bill. Bill is marked paid in Moniger.";
            resolutionMessage = "Payment marked completed from linked bill status.";
          } else if (billStatus === "scheduled") {
            nextStatus = "scheduled";
            nextPaidOn = toDateOnly(
              asNullableString(bill.scheduled_payment_date),
              asNullableString(bill.due_date),
              asNullableString(bill.bill_date),
              nextPaidOn,
            );
            nextGatewayResponse = `Bill remains scheduled for ${nextPaidOn}.`;
            resolutionMessage = "Payment remains scheduled because the linked bill is still scheduled.";
          } else if (billStatus === "overdue") {
            nextStatus = "pending";
            nextPaidOn = toDateOnly(
              asNullableString(bill.scheduled_payment_date),
              asNullableString(bill.due_date),
              asNullableString(bill.bill_date),
              nextPaidOn,
            );
            nextGatewayResponse = "Bill is overdue and still unpaid. Pending means the payable remains open.";
            resolutionMessage = "Payment remains pending because the linked bill is overdue and still open.";
          } else {
            nextGatewayResponse = "Bill returned to an open state while the payment record remained. Manual review is required.";
            resolutionMessage = "Payment could not be auto-resolved because the linked bill is open again.";
          }
        } else {
          nextGatewayResponse = "No linked invoice or bill was found for this payment. Manual review is required.";
          resolutionMessage = "Payment could not be auto-resolved because its linked document is missing.";
        }

        const nextMetadata = {
          ...paymentMetadata,
          admin_reconciliation: {
            checked_at: checkedAt,
            checked_by: user.id,
            previous_status: asString(payment.status),
            resolution: resolutionMessage,
            resolved_status: nextStatus,
            source_status: reconciliation.sourceStatus,
            source_type: reconciliation.sourceType,
          },
          synced_status: reconciliation.sourceStatus ?? paymentMetadata.synced_status ?? null,
        };

        const updateResponse = await adminClient
          .from("payments")
          .update({
            gateway_response: nextGatewayResponse,
            metadata: nextMetadata,
            paid_on: nextPaidOn,
            status: nextStatus,
          })
          .eq("id", paymentId)
          .select("id, business_id, payment_reference, payment_type, amount, status, gateway_response, created_at, metadata, bill_id, invoice_id")
          .single();

        if (updateResponse.error) {
          throw updateResponse.error;
        }

        await insertAdminAuditLog({
          action: "admin_payment_reconciled",
          actorUserId: user.id,
          adminClient,
          businessId,
          detail: {
            next_status: nextStatus,
            payment_id: paymentId,
            payment_reference: asString(payment.payment_reference),
            previous_status: asString(payment.status),
            resolution: resolutionMessage,
            source_status: reconciliation.sourceStatus,
            source_type: reconciliation.sourceType,
          },
          entityId: paymentId,
          entityType: "payment",
          summary: "Payment reconciled from linked source",
        });

        return json({
          message: resolutionMessage,
          ok: true,
          row: buildAdminPaymentRow({
            billsById,
            businessNameById,
            invoicesById,
            payment: updateResponse.data as Record<string, unknown>,
          }),
        });
      }

      case "testData.preview":
      case "testData.delete": {
        if (!canManageTestData(adminAccess.role)) {
          return json({ error: "Only super admins can manage test data." }, 403);
        }

        const resource = asString(payload.resource);
        if (resource !== "payments" && resource !== "payouts" && resource !== "all") {
          return json({ error: "Choose payments, payouts, or all test data." }, 400);
        }

        const [paymentsResponse, payoutsResponse] = await Promise.all([
          resource === "payouts" ? Promise.resolve({ data: [], error: null }) : adminClient.from("payments").select("id, payment_reference, status, amount, created_at, is_test_data, metadata, gateway, invoice_id, bill_id").limit(501),
          resource === "payments" ? Promise.resolve({ data: [], error: null }) : adminClient.from("workspace_payouts").select("id, status, amount, created_at, is_test_data, provider_metadata").limit(501),
        ]);
        if (paymentsResponse.error) throw paymentsResponse.error;
        if (payoutsResponse.error) throw payoutsResponse.error;

        const markedPaymentRows = (paymentsResponse.data ?? []).map((row) => asRecord(row)).filter(isMarkedTestData);
        const paymentRows = markedPaymentRows.filter((row) => isSafeToDeletePayment(row) && !asString(row.invoice_id) && !asString(row.bill_id));
        const blockedPaymentRows = markedPaymentRows.filter((row) => !paymentRows.includes(row));
        const payoutRows = (payoutsResponse.data ?? []).map((row) => asRecord(row)).filter(isMarkedTestData);
        try {
          validateTestDataDeletionBatch(paymentRows.length);
          validateTestDataDeletionBatch(payoutRows.length);
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "Test data cleanup batch is too large." }, 409);
        }
        const deletablePayoutRows = payoutRows.filter((row) => isSafeToDeletePayout(row.status));
        const blockedPayoutRows = payoutRows.filter((row) => !deletablePayoutRows.includes(row));

        if (requestBody.action === "testData.preview") {
          return json({
            payments: markedPaymentRows,
            payouts: payoutRows,
            deletable: { payments: paymentRows.length, payouts: deletablePayoutRows.length },
            blocked: {
              payments: blockedPaymentRows.map((row) => ({
                id: asString(row.id),
                reason: asString(row.invoice_id) || asString(row.bill_id) ? "linked_financial_record" : "provider_state_not_proven_test",
              })),
              payouts: blockedPayoutRows.map((row) => ({ id: asString(row.id), status: asString(row.status) })),
            },
          });
        }

        if (asString(payload.confirmation) !== "DELETE TEST DATA") {
          return json({ error: "Type DELETE TEST DATA to confirm cleanup." }, 400);
        }

        const reason = asString(payload.reason).trim();
        if (reason.length < 10) {
          return json({ error: "Provide a cleanup reason with at least 10 characters." }, 400);
        }

        const paymentIds = paymentRows.map((row) => asString(row.id)).filter(Boolean);
        const payoutIds = deletablePayoutRows.map((row) => asString(row.id)).filter(Boolean);
        const deletionCount = paymentIds.length + payoutIds.length;
        if (deletionCount > 1 && asString(payload.bulkConfirmation).trim().toUpperCase() !== buildBulkTestDataConfirmation(deletionCount)) {
          return json({ error: `Type ${buildBulkTestDataConfirmation(deletionCount)} to confirm bulk cleanup.` }, 400);
        }
        const manifestResponse = await adminClient.from("admin_test_data_deletion_manifests").insert({
          actor_user_id: user.id,
          blocked_payouts: blockedPayoutRows.map((row) => ({ id: asString(row.id), status: asString(row.status) })),
          payment_ids: paymentIds,
          payout_ids: payoutIds,
          reason,
          resource,
        }).select("id").single();
        if (manifestResponse.error) throw manifestResponse.error;
        const manifestId = asString(manifestResponse.data?.id);

        if (paymentIds.length > 0) {
          const response = await adminClient.from("payments").delete().in("id", paymentIds);
          if (response.error) {
            await adminClient.from("admin_test_data_deletion_manifests").update({ status: "failed", failure_reason: response.error.message }).eq("id", manifestId);
            throw response.error;
          }
        }
        if (payoutIds.length > 0) {
          const response = await adminClient.from("workspace_payouts").delete().in("id", payoutIds);
          if (response.error) {
            await adminClient.from("admin_test_data_deletion_manifests").update({ status: "failed", failure_reason: response.error.message }).eq("id", manifestId);
            throw response.error;
          }
        }

        const manifestUpdate = await adminClient.from("admin_test_data_deletion_manifests").update({
          completed_at: new Date().toISOString(),
          status: "completed",
        }).eq("id", manifestId);
        if (manifestUpdate.error) throw manifestUpdate.error;

        const [remainingPayments, remainingPayouts] = await Promise.all([
          paymentIds.length > 0 ? adminClient.from("payments").select("id").in("id", paymentIds) : Promise.resolve({ data: [], error: null }),
          payoutIds.length > 0 ? adminClient.from("workspace_payouts").select("id").in("id", payoutIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (remainingPayments.error) throw remainingPayments.error;
        if (remainingPayouts.error) throw remainingPayouts.error;
        if ((remainingPayments.data?.length ?? 0) > 0 || (remainingPayouts.data?.length ?? 0) > 0) {
          await adminClient.from("admin_test_data_deletion_manifests").update({
            failure_reason: "Post-delete reconciliation found records that remain.",
            status: "failed",
          }).eq("id", manifestId);
          return json({ error: "Cleanup did not reconcile completely; review the deletion manifest." }, 409);
        }

        await insertAdminAuditLog({
          action: "admin_test_data_deleted",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: { manifest_id: manifestId, payment_count: paymentIds.length, payout_count: payoutIds.length, blocked_payout_count: blockedPayoutRows.length, reason, resource },
          entityId: null,
          entityType: "test_data_cleanup",
          summary: "Marked test data deleted",
        });

        return json({
          ok: true,
          deleted: { payments: paymentIds.length, payouts: payoutIds.length },
          blocked: {
            payments: blockedPaymentRows.map((row) => ({
              id: asString(row.id),
              reason: asString(row.invoice_id) || asString(row.bill_id) ? "linked_financial_record" : "provider_state_not_proven_test",
            })),
            payouts: blockedPayoutRows.map((row) => ({ id: asString(row.id), status: asString(row.status) })),
          },
        });
      }

      case "payouts.list":
      case "payouts.export": {
        const businessRows = await buildBusinessRows(adminClient);
        const payoutsResponse = await adminClient
          .from("workspace_payouts")
          .select(
            `
              id,
              business_id,
              amount,
              currency,
              status,
              failure_reason,
              provider_reference,
              provider_transfer_code,
              submitted_at,
              completed_at,
              failed_at,
              reversed_at,
              cancelled_at,
              created_at,
              scheduled_for,
              last_attempt_at,
              next_retry_at,
              retry_count,
              is_test_data,
              provider_metadata,
              bill:bills (
                bill_number
              ),
              vendor:vendors (
                business_name
              ),
              bank:banks (
                name,
                bank_code
              )
            `,
          )
          .order("created_at", { ascending: false });

        if (payoutsResponse.error) throw payoutsResponse.error;

        const businessNameById = new Map(businessRows.map((row) => [row.businessId, row.businessName]));
        const rows = (payoutsResponse.data ?? []).map((row) =>
          buildAdminPayoutRow({
            businessNameById,
            payout: row as Record<string, unknown>,
          }),
        );
        const currentMonth = monthStamp(new Date().toISOString());

        if (requestBody.action === "payouts.export") {
          await insertAdminAuditLog({
            action: "admin_payouts_exported",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: { row_count: rows.length },
            entityId: null,
            entityType: "payout_export",
            summary: "Payouts exported",
          });
        }

        return json({
          metrics: {
            completedThisMonth: rows.filter((row) => row.status === "completed" && monthStamp(row.completedAt ?? row.createdAt) === currentMonth).length,
            failedThisMonth: rows.filter((row) => row.status === "failed" && monthStamp(row.failedAt ?? row.createdAt) === currentMonth).length,
            reservedTotal: rows
              .filter((row) => ["reserved", "submitted", "processing"].includes(row.status))
              .reduce((sum, row) => sum + row.amount, 0),
            totalCount: rows.length,
            totalValue: rows.reduce((sum, row) => sum + row.amount, 0),
          },
          rows,
        });
      }

      case "content.list": {
        const contentType = asString(payload.contentType);
        if (contentType !== "help_article" && contentType !== "changelog") {
          return json({ error: "Unsupported content type." }, 400);
        }

        const response = await adminClient.from("content_items").select("*").eq("content_type", contentType).eq("locale", "en").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
        if (response.error) throw response.error;

        return json({
          items: (response.data ?? []).map((row) => ({
            body: asString(row.body),
            category: asNullableString(row.category),
            changes: Array.isArray(row.changes) ? row.changes : [],
            contentType: asString(row.content_type),
            excerpt: asNullableString(row.excerpt),
            id: asString(row.id),
            published: Boolean(row.published),
            releaseDate: asNullableString(row.release_date),
            relatedHelpSlugs: Array.isArray(row.related_help_slugs) ? row.related_help_slugs.filter((slug): slug is string => typeof slug === "string") : [],
            slug: asString(row.slug),
            sortOrder: Number(row.sort_order ?? 0),
            tag: asNullableString(row.tag),
            title: asString(row.title),
            version: asNullableString(row.version),
          })),
        });
      }

      case "content.save": {
        const contentType = asString(payload.contentType);
        if (contentType !== "help_article" && contentType !== "changelog") {
          return json({ error: "Unsupported content type." }, 400);
        }

        const contentId = asNullableString(payload.id);
        const published = Boolean(payload.published);
        const changes = Array.isArray(payload.changes)
          ? payload.changes.filter((change): change is Record<string, unknown> => Boolean(change && typeof change === "object"))
          : [];
        const relatedHelpSlugs = Array.isArray(payload.relatedHelpSlugs)
          ? payload.relatedHelpSlugs.filter((slug): slug is string => typeof slug === "string" && Boolean(slug.trim())).map((slug) => slug.trim().toLowerCase())
          : [];
        const contentPayload = {
          body: asString(payload.body),
          category: asNullableString(payload.category),
          changes,
          content_type: contentType,
          excerpt: asNullableString(payload.excerpt),
          locale: "en",
          published,
          published_at: published ? new Date().toISOString() : null,
          release_date: asNullableString(payload.releaseDate),
          related_help_slugs: contentType === "changelog" ? relatedHelpSlugs : [],
          slug: asString(payload.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "") || crypto.randomUUID(),
          sort_order: Math.round(asNumber(payload.sortOrder)),
          tag: asNullableString(payload.tag),
          title: asString(payload.title),
          updated_by: user.id,
          version: asNullableString(payload.version),
        };
        if (!contentPayload.title) return json({ error: "A title is required." }, 400);

        const response = contentId
          ? await adminClient.from("content_items").update(contentPayload).eq("id", contentId).select("id").single()
          : await adminClient.from("content_items").insert({ ...contentPayload, created_by: user.id }).select("id").single();
        if (response.error) throw response.error;

        await insertAdminAuditLog({
          action: published ? "admin_content_published" : "admin_content_saved",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: { content_id: asString(response.data.id), content_type: contentType, published },
          entityId: asString(response.data.id),
          entityType: "content_item",
          summary: published ? "Public content published" : "Public content saved",
        });
        return json({ id: asString(response.data.id), ok: true });
      }

      case "content.delete": {
        const contentId = asString(payload.id);
        if (!contentId) return json({ error: "Content id is required." }, 400);
        const response = await adminClient.from("content_items").delete().eq("id", contentId);
        if (response.error) throw response.error;
        await insertAdminAuditLog({
          action: "admin_content_deleted",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: { content_id: contentId },
          entityId: contentId,
          entityType: "content_item",
          summary: "Public content deleted",
        });
        return json({ ok: true });
      }

      case "signupAlerts.list": {
        const response = await adminClient
          .from("signup_alert_events")
          .select("id, email, full_name, business_name, plan, signup_status, environment, delivery_status, provider_message_id, failure_reason, created_at, delivered_at")
          .order("created_at", { ascending: false })
          .limit(100);

        if (response.error) throw response.error;

        return json({
          rows: (response.data ?? []).map((row) => ({
            businessName: asNullableString(row.business_name),
            createdAt: asString(row.created_at),
            deliveredAt: asNullableString(row.delivered_at),
            deliveryStatus: asString(row.delivery_status),
            email: asString(row.email),
            environment: asString(row.environment),
            failureReason: asNullableString(row.failure_reason),
            fullName: asNullableString(row.full_name),
            id: asString(row.id),
            plan: asString(row.plan),
            providerMessageId: asNullableString(row.provider_message_id),
            signupStatus: asString(row.signup_status),
          })),
        });
      }

      case "announcements.list": {
        const announcementsResponse = await adminClient
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false });

        if (announcementsResponse.error) throw announcementsResponse.error;

        return json({
          rows: (announcementsResponse.data ?? []).map((row) => ({
            announcementId: asString(row.id),
            body: asString(row.body),
            createdAt: asString(row.created_at),
            expiresAt: asNullableString(row.expires_at),
            publishedAt: asNullableString(row.published_at),
            status: getAnnouncementStatus({
              expiresAt: asNullableString(row.expires_at),
              publishedAt: asNullableString(row.published_at),
            }),
            target: asString(row.target),
            title: asString(row.title),
            type: asString(row.type),
          })),
        });
      }

      case "announcements.save": {
        const announcementId = asNullableString(payload.announcementId);
        const publishNow = Boolean(payload.publishNow);
        const announcementPayload = {
          body: asString(payload.body),
          created_by: user.id,
          expires_at: asNullableString(payload.expiresAt),
          published_at: publishNow ? new Date().toISOString() : asNullableString(payload.publishedAt),
          target: asString(payload.target) || "all",
          target_filters: asRecord(payload.targetFilters),
          title: asString(payload.title),
          type: asString(payload.type) || "info",
        };

        const response = announcementId
          ? await adminClient.from("announcements").update(announcementPayload).eq("id", announcementId).select("*").single()
          : await adminClient.from("announcements").insert(announcementPayload).select("*").single();

        if (response.error) {
          throw response.error;
        }

        await recordAnnouncementNotifications({
          adminClient,
          announcement: {
            body: asString(response.data.body),
            id: asString(response.data.id),
            published_at: asNullableString(response.data.published_at),
            target: asString(response.data.target),
            target_filters: asRecord(response.data.target_filters),
            title: asString(response.data.title),
          },
        });

        await insertAdminAuditLog({
          action: announcementPayload.published_at ? "admin_announcement_published" : "admin_announcement_saved",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: {
            announcement_id: asString(response.data.id),
            target: announcementPayload.target,
          },
          entityId: asString(response.data.id),
          entityType: "announcement",
          summary: announcementPayload.published_at ? "Announcement published" : "Announcement saved",
        });

        return json({
          announcementId: asString(response.data.id),
          ok: true,
        });
      }

      case "announcements.delete": {
        const announcementId = asString(payload.announcementId);
        await adminClient.from("announcements").delete().eq("id", announcementId);
        await insertAdminAuditLog({
          action: "admin_announcement_deleted",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: { announcement_id: announcementId },
          entityId: announcementId,
          entityType: "announcement",
          summary: "Announcement deleted",
        });

        return json({ ok: true });
      }

      case "announcements.duplicate": {
        const announcementId = asString(payload.announcementId);
        const sourceResponse = await adminClient.from("announcements").select("*").eq("id", announcementId).single();
        if (sourceResponse.error) throw sourceResponse.error;

        const duplicateResponse = await adminClient.from("announcements").insert({
          body: sourceResponse.data.body,
          created_by: user.id,
          target: sourceResponse.data.target,
          target_filters: sourceResponse.data.target_filters,
          title: `${sourceResponse.data.title} (Copy)`,
          type: sourceResponse.data.type,
        }).select("*").single();

        if (duplicateResponse.error) throw duplicateResponse.error;

        await insertAdminAuditLog({
          action: "admin_announcement_duplicated",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: {
            source_announcement_id: announcementId,
            target_announcement_id: asString(duplicateResponse.data.id),
          },
          entityId: asString(duplicateResponse.data.id),
          entityType: "announcement",
          summary: "Announcement duplicated",
        });

        return json({
          announcementId: asString(duplicateResponse.data.id),
          ok: true,
        });
      }

      case "support.lookup": {
        const search = normalizeSearch(payload.search);
        if (!search) {
          return json({
            businesses: [],
            invoices: [],
            payoutAudits: [],
            payouts: [],
            users: [],
          });
        }

        const [businesses, users, invoices, payouts, payoutAudits] = await Promise.all([
          buildBusinessRows(adminClient),
          buildUserRows(adminClient, search),
          adminClient.from("invoices").select("id, invoice_number, total_amount, status, business_id").ilike("invoice_number", `%${search}%`).limit(10),
          adminClient
            .from("workspace_payouts")
            .select(
              `
                id,
                business_id,
                amount,
                currency,
                status,
                failure_reason,
                provider_reference,
                provider_transfer_code,
                submitted_at,
                completed_at,
                failed_at,
                reversed_at,
                cancelled_at,
                created_at,
                scheduled_for,
                last_attempt_at,
                next_retry_at,
                retry_count,
                bill:bills (
                  bill_number
                ),
                vendor:vendors (
                  business_name
                ),
                bank:banks (
                  name,
                  bank_code
                )
              `,
            )
            .or(
              `provider_reference.ilike.%${search}%,provider_transfer_code.ilike.%${search}%,failure_reason.ilike.%${search}%`,
            )
            .order("created_at", { ascending: false })
            .limit(10),
          adminClient
            .from("audit_logs")
            .select("id, action, business_id, created_at, detail, summary")
            .or(`action.ilike.%${search}%,summary.ilike.%${search}%`)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        if (invoices.error) throw invoices.error;
        if (payouts.error) throw payouts.error;
        if (payoutAudits.error) throw payoutAudits.error;

        const businessMatches = businesses.filter((row) =>
          `${row.businessId} ${row.businessName} ${row.ownerEmail}`.toLowerCase().includes(search),
        );
        const businessNameById = new Map(businesses.map((row) => [row.businessId, row.businessName]));
        const payoutBusinessNameById = new Map(businesses.map((row) => [row.businessId, row.businessName]));

        return json({
          businesses: businessMatches.slice(0, 8),
          invoices: (invoices.data ?? []).map((invoice) => ({
            amount: asNumber(invoice.total_amount),
            businessName: businessNameById.get(asString(invoice.business_id)) ?? "Workspace",
            invoiceId: asString(invoice.id),
            invoiceNumber: asString(invoice.invoice_number),
            status: asString(invoice.status),
          })),
          payoutAudits: (payoutAudits.data ?? []).map((row) => ({
            action: asString(row.action),
            businessName: businessNameById.get(asString(row.business_id)) ?? null,
            createdAt: asString(row.created_at),
            detail: asRecord(row.detail),
            id: row.id as number | string,
            summary: asString(row.summary),
          })),
          payouts: (payouts.data ?? []).map((row) => {
            const bill = Array.isArray((row as Record<string, unknown>).bill) ? (row as Record<string, unknown>).bill[0] : (row as Record<string, unknown>).bill;
            const vendor = Array.isArray((row as Record<string, unknown>).vendor) ? (row as Record<string, unknown>).vendor[0] : (row as Record<string, unknown>).vendor;
            const bank = Array.isArray((row as Record<string, unknown>).bank) ? (row as Record<string, unknown>).bank[0] : (row as Record<string, unknown>).bank;

            return {
              amount: asNumber((row as Record<string, unknown>).amount),
              bankName: asNullableString((bank as Record<string, unknown> | null | undefined)?.name ?? null),
              billNumber: asNullableString((bill as Record<string, unknown> | null | undefined)?.bill_number ?? null),
              businessName: payoutBusinessNameById.get(asString((row as Record<string, unknown>).business_id)) ?? "Workspace",
              completedAt: asNullableString((row as Record<string, unknown>).completed_at ?? null),
              createdAt: asString((row as Record<string, unknown>).created_at),
              currency: asString((row as Record<string, unknown>).currency) || "NGN",
              failureReason: asNullableString((row as Record<string, unknown>).failure_reason ?? null),
              lastAttemptAt: asNullableString((row as Record<string, unknown>).last_attempt_at ?? null),
              nextRetryAt: asNullableString((row as Record<string, unknown>).next_retry_at ?? null),
              payoutId: asString((row as Record<string, unknown>).id),
              providerReference: asNullableString((row as Record<string, unknown>).provider_reference ?? null),
              providerTransferCode: asNullableString((row as Record<string, unknown>).provider_transfer_code ?? null),
              recipientBankCode: asNullableString((bank as Record<string, unknown> | null | undefined)?.bank_code ?? null),
              retryCount: asNumber((row as Record<string, unknown>).retry_count),
              scheduledFor: asNullableString((row as Record<string, unknown>).scheduled_for ?? null),
              status: asString((row as Record<string, unknown>).status),
              submittedAt: asNullableString((row as Record<string, unknown>).submitted_at ?? null),
              vendorName: asNullableString((vendor as Record<string, unknown> | null | undefined)?.business_name ?? null),
            };
          }),
          users: users.slice(0, 8),
        });
      }

      case "support.quickAction": {
        const type = asString(payload.type);

        if (type === "send_notice") {
          await sendBusinessNotice({
            adminClient,
            businessId: asString(payload.businessId),
            message: asString(payload.message),
          });

          await insertAdminAuditLog({
            action: "admin_support_notice_sent",
            actorUserId: user.id,
            adminClient,
            businessId: asString(payload.businessId),
            detail: {
              business_id: asString(payload.businessId),
              message: asString(payload.message),
            },
            entityId: asString(payload.businessId),
            entityType: "business",
            summary: "Support notice sent",
          });
          return json({ ok: true });
        }

        if (type === "lookup_payment") {
          const reference = asString(payload.reference);
          const paymentResponse = await adminClient
            .from("payments")
            .select("id, business_id, payment_reference, amount, status, payment_type, created_at")
            .ilike("payment_reference", `%${reference}%`)
            .order("created_at", { ascending: false })
            .limit(10);

          if (paymentResponse.error) throw paymentResponse.error;

          await insertAdminAuditLog({
            action: "admin_support_payment_lookup",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              reference,
              result_count: paymentResponse.data?.length ?? 0,
            },
            entityId: null,
            entityType: "payment",
            summary: "Support payment lookup run",
          });

          return json({
            rows: paymentResponse.data ?? [],
          });
        }

        if (type === "lookup_payout") {
          const reference = asString(payload.reference);
          const payoutResponse = await adminClient
            .from("workspace_payouts")
            .select("id, business_id, amount, status, provider_reference, provider_transfer_code, created_at")
            .or(
              `provider_reference.ilike.%${reference}%,provider_transfer_code.ilike.%${reference}%`,
            )
            .order("created_at", { ascending: false })
            .limit(10);

          if (payoutResponse.error) throw payoutResponse.error;

          await insertAdminAuditLog({
            action: "admin_support_payout_lookup",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              reference,
              result_count: payoutResponse.data?.length ?? 0,
            },
            entityId: null,
            entityType: "payout",
            summary: "Support payout lookup run",
          });

          return json({
            rows: payoutResponse.data ?? [],
          });
        }

        if (type === "reset_password") {
          const email = normalizeSearch(payload.email);

          if (!email) {
            return json({ error: "Enter the user's email address first." }, 400);
          }

          const authUsers = await listAllAuthUsers(adminClient);
          const match = authUsers.find((authUser) => (authUser.email ?? "").toLowerCase() === email);

          if (!match?.email) {
            return json({ error: "That email does not belong to an existing Moniger account." }, 404);
          }

          const { redirectTo } = await sendPasswordResetEmail({
            adminClient,
            email: match.email,
            request,
          });

          await insertAdminAuditLog({
            action: "admin_support_password_reset_requested",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              email: match.email,
              redirect_to: redirectTo,
              target_user_id: match.id,
            },
            entityId: match.id,
            entityType: "profile",
            summary: "Support password reset requested",
          });

          return json({
            ok: true,
            message: `Password reset email sent to ${match.email}.`,
          });
        }

        return json({ error: "Unsupported support action." }, 400);
      }

      case "audit.list": {
        const auditResponse = await adminClient
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        const businessesResponse = await adminClient.from("businesses").select("id, name");
        const authUsers = await listAllAuthUsers(adminClient);

        if (auditResponse.error) throw auditResponse.error;
        if (businessesResponse.error) throw businessesResponse.error;

        const businessNameById = new Map((businessesResponse.data ?? []).map((business) => [asString(business.id), asString(business.name)]));
        const authEmailById = new Map(authUsers.map((authUser) => [authUser.id, authUser.email ?? null]));

        return json({
          rows: (auditResponse.data ?? []).map((row) => ({
            action: asString(row.action),
            actorEmail: authEmailById.get(asString(row.actor_user_id)) ?? null,
            businessName: businessNameById.get(asString(row.business_id)) ?? null,
            createdAt: asString(row.created_at),
            detail: asRecord(row.detail),
            id: row.id as number | string,
            isAdminAction: Boolean(asRecord(row.detail).admin_action) || asString(row.action).startsWith("admin_"),
            summary: asString(row.summary),
          })),
        });
      }

      case "health.check": {
        const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
        const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")?.trim() ?? "";
        const currentDate = todayDate();
        const todayStart = new Date();
        todayStart.setUTCHours(0, 0, 0, 0);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
        const checks = await Promise.all([
          pingService({
            adminClient,
            check: async () => {
              const response = await adminClient.from("businesses").select("id").limit(1);
              if (response.error) throw response.error;
            },
            service: "Supabase Database",
          }),
          pingService({
            adminClient,
            check: async () => {
              const response = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1 });
              if (response.error) throw response.error;
            },
            service: "Supabase Auth",
          }),
          pingService({
            adminClient,
            check: async () => {
              const response = await adminClient.storage.listBuckets();
              if (response.error) throw response.error;
            },
            service: "Supabase Storage",
          }),
          pingService({
            adminClient,
            check: async () => {
              if (!resendApiKey) {
                throw new Error("Resend API key not configured.");
              }

              const response = await fetch("https://api.resend.com/domains", {
                headers: { Authorization: `Bearer ${resendApiKey}` },
              });

              if (!response.ok) {
                throw new Error("Resend API unavailable.");
              }
            },
            service: "Email Delivery (Resend)",
          }),
          pingService({
            adminClient,
            check: async () => {
              if (!paystackSecretKey) {
                throw new Error("Paystack secret key not configured.");
              }

              const response = await fetch("https://api.paystack.co/bank?perPage=1", {
                headers: { Authorization: `Bearer ${paystackSecretKey}` },
              });

              if (!response.ok) {
                throw new Error("Paystack API unavailable.");
              }
            },
            service: "Payment Webhooks (Paystack)",
          }),
          pingService({
            adminClient,
            check: async () => {
              const response = await fetch(`${supabaseUrl}/functions/v1/admin-console`, {
                method: "OPTIONS",
              });

              if (!response.ok) {
                throw new Error("Edge Functions unavailable.");
              }
            },
            service: "Edge Functions",
          }),
        ]);

        const platformHealthResponse = await adminClient
          .from("platform_health_checks")
          .select("*")
          .order("checked_at", { ascending: false })
          .limit(200);
        const webhookEventsResponse = await adminClient
          .from("platform_webhook_events")
          .select("*")
          .order("received_at", { ascending: false })
          .limit(20);
        const invoiceVolumeResponse = await adminClient
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .gte("created_at", todayStart.toISOString())
          .lt("created_at", tomorrowStart.toISOString());
        const paymentsConfirmedResponse = await adminClient
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("paid_on", currentDate);

        if (platformHealthResponse.error) throw platformHealthResponse.error;
        if (webhookEventsResponse.error) throw webhookEventsResponse.error;
        if (invoiceVolumeResponse.error) throw invoiceVolumeResponse.error;
        if (paymentsConfirmedResponse.error) throw paymentsConfirmedResponse.error;

        return json({
          allSystemsOperational: checks.every((check) => check.status === "operational"),
          failedWebhookEvents24h: (webhookEventsResponse.data ?? []).filter((row) => asString(row.status) === "failed").length,
          invoiceVolumeToday: invoiceVolumeResponse.count ?? 0,
          paymentsConfirmedToday: paymentsConfirmedResponse.count ?? 0,
          responseTimeSamples: getResponseTimeSamples(
            (platformHealthResponse.data ?? []).map((row) => asRecord(row)).filter((row) => asString(row.service) === "Supabase Database"),
          ),
          services: checks,
          uptimeLabel: `${((checks.filter((check) => check.status === "operational").length / checks.length) * 100).toFixed(1)}%`,
          webhookEvents: (webhookEventsResponse.data ?? []).map((row) => ({
            amount: row.amount === null ? null : asNumber(row.amount),
            businessName: "Platform",
            eventType: asString(row.event_type),
            id: asString(row.id),
            processingTimeMs: row.processing_time_ms === null ? null : asNumber(row.processing_time_ms),
            receivedAt: asString(row.received_at),
            status: asString(row.status),
          })),
        });
      }

      case "settings.get": {
        const [adminUsersResponse, platformConfigResponse, authUsers] = await Promise.all([
          adminClient.from("admin_users").select("*").order("created_at", { ascending: true }),
          adminClient.from("platform_config").select("*").order("key", { ascending: true }),
          listAllAuthUsers(adminClient),
        ]);

        if (adminUsersResponse.error) throw adminUsersResponse.error;
        if (platformConfigResponse.error) throw platformConfigResponse.error;

        const authUserById = new Map(authUsers.map((authUser) => [authUser.id, authUser]));

        return json({
          adminUsers: (adminUsersResponse.data ?? []).map((row) => {
            const authUser = authUserById.get(asString(row.user_id));
            return {
              addedAt: asString(row.created_at),
              adminUserId: asString(row.id),
              email: authUser?.email ?? "Unknown",
              fullName: typeof authUser?.user_metadata?.name === "string" ? authUser.user_metadata.name : null,
              role: asString(row.role),
              userId: asString(row.user_id),
            };
          }),
          platformConfig: (platformConfigResponse.data ?? []).map((row) => ({
            key: asString(row.key),
            updatedAt: asString(row.updated_at),
            value: row.value ? asRecord(row.value) : null,
          })),
        });
      }

      case "settings.adminUser": {
        if (asString(adminAccess.role) !== "super_admin") {
          return json({ error: "Only super admins can manage admin users." }, 403);
        }

        const type = asString(payload.type);

        if (type === "add") {
          const email = normalizeSearch(payload.email);
          const role = asString(payload.role) || "support";
          if (!email || !email.includes("@") || !["support", "super_admin"].includes(role)) {
            return json({ error: "Enter a valid email and supported admin role." }, 400);
          }

          const authUsers = await listAllAuthUsers(adminClient);
          let match = authUsers.find((authUser) => (authUser.email ?? "").toLowerCase() === email);
          let invited = false;

          if (!match) {
            const inviteResponse = await adminClient.auth.admin.inviteUserByEmail(email, {
              redirectTo: `${getAppBaseUrl(request)}/accept-invite`,
            });

            if (inviteResponse.error || !inviteResponse.data.user) {
              throw inviteResponse.error ?? new Error("The admin invitation could not be created.");
            }

            match = inviteResponse.data.user as AuthUserRecord;
            invited = true;
          }

          await adminClient.from("admin_users").upsert({
            role,
            user_id: match.id,
          });

          await insertAdminAuditLog({
            action: "admin_access_granted",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: { target_user_id: match.id, role },
            entityId: match.id,
            entityType: "profile",
            summary: "Admin access granted",
          });

          return json({ invited, ok: true });
        }

        if (type === "update") {
          await adminClient.from("admin_users").update({
            role: asString(payload.role),
          }).eq("id", asString(payload.adminUserId));

          await insertAdminAuditLog({
            action: "admin_access_role_updated",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              admin_user_id: asString(payload.adminUserId),
              role: asString(payload.role),
            },
            entityId: asString(payload.adminUserId),
            entityType: "admin_user",
            summary: "Admin role updated",
          });

          return json({ ok: true });
        }

        if (type === "remove") {
          await adminClient.from("admin_users").delete().eq("id", asString(payload.adminUserId));

          await insertAdminAuditLog({
            action: "admin_access_revoked",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              admin_user_id: asString(payload.adminUserId),
            },
            entityId: asString(payload.adminUserId),
            entityType: "admin_user",
            summary: "Admin access revoked",
          });
          return json({ ok: true });
        }

        return json({ error: "Unsupported admin user action." }, 400);
      }

      case "settings.platformConfig": {
        await adminClient.from("platform_config").upsert({
          key: asString(payload.key),
          value: asRecord(payload.value),
        }, {
          onConflict: "key",
        });

        await insertAdminAuditLog({
          action: "admin_platform_config_updated",
          actorUserId: user.id,
          adminClient,
          businessId: null,
          detail: { key: asString(payload.key) },
          entityId: null,
          entityType: "platform_config",
          summary: "Platform configuration updated",
        });

        return json({ ok: true });
      }

      case "settings.dangerAction": {
        if (asString(adminAccess.role) !== "super_admin") {
          return json({ error: "Only super admins can run danger-zone actions." }, 403);
        }

        const type = asString(payload.type);

        if (type === "export_platform_data") {
          const [businesses, members, invoices, bills, payments] = await Promise.all([
            adminClient.from("businesses").select("*"),
            adminClient.from("business_members").select("*"),
            adminClient.from("invoices").select("*"),
            adminClient.from("bills").select("*"),
            adminClient.from("payments").select("*"),
          ]);

          await insertAdminAuditLog({
            action: "admin_platform_exported",
            actorUserId: user.id,
            adminClient,
            businessId: null,
            detail: {
              bill_count: bills.data?.length ?? 0,
              business_count: businesses.data?.length ?? 0,
              invoice_count: invoices.data?.length ?? 0,
              member_count: members.data?.length ?? 0,
              payment_count: payments.data?.length ?? 0,
            },
            entityId: null,
            entityType: "platform_export",
            summary: "Platform data exported",
          });

          return json({
            bills: bills.data ?? [],
            businesses: businesses.data ?? [],
            invoices: invoices.data ?? [],
            members: members.data ?? [],
            payments: payments.data ?? [],
          });
        }

        if (type === "purge_demo_data") {
          return json({
            ok: false,
            message: "Demo data purge is not wired in this environment.",
          });
        }

        return json({ error: "Unsupported danger action." }, 400);
      }

      default:
        return json({ error: "Unsupported admin action." }, 400);
    }
  } catch (error) {
    console.error("admin-console error", error);
    return json(
      {
        error: error instanceof Error ? error.message : "The admin console request failed.",
      },
      500,
    );
  }
});
