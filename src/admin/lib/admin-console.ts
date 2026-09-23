import { QueryKey, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const isResponseLike = (value: unknown): value is ResponseLike =>
  typeof value === "object" &&
  value !== null &&
  "clone" in value &&
  typeof value.clone === "function" &&
  "json" in value &&
  typeof value.json === "function" &&
  "text" in value &&
  typeof value.text === "function";

const getFunctionErrorMessage = async (error: unknown) => {
  if (typeof error === "object" && error && "context" in error) {
    const context = (error as { context?: unknown }).context;

    if (isResponseLike(context)) {
      try {
        const payload = await context.clone().json();

        if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
          return payload.error;
        }
      } catch {
        try {
          const text = await context.clone().text();

          if (text.trim()) {
            return text.trim();
          }
        } catch {
          // Fall through to the generic message below.
        }
      }
    }
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "The admin console request failed.";
};

const getResponseErrorMessage = async (response: ResponseLike | undefined) => {
  if (!response) {
    return null;
  }

  try {
    const payload = await response.clone().json();

    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    try {
      const text = await response.clone().text();

      if (text.trim()) {
        return text.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
};

export type AdminOverviewResponse = {
  generatedAt: string;
  health: {
    allSystemsOperational: boolean;
    failedWebhookEvents24h: number;
    invoiceVolumeToday: number;
    paymentsConfirmedToday: number;
    responseTimeSamples: Array<{ label: string; value: number }>;
    services: Array<{
      checkedAt: string;
      responseMs: number | null;
      service: string;
      status: "degraded" | "down" | "operational";
    }>;
    uptimeLabel: string;
    webhookEvents: Array<{
      amount: number | null;
      businessName: string;
      eventType: string;
      id: string;
      processingTimeMs: number | null;
      receivedAt: string;
      status: string;
    }>;
  };
  latestBusinesses: Array<{
    businessId: string;
    businessName: string;
    createdAt: string;
    ownerEmail: string;
    ownerName: string | null;
    status: "active" | "pending" | "suspended";
  }>;
  metrics: {
    activeUsers: { changePct: number; value: number };
    platformRevenueThisMonth: number;
    platformUptime: string;
    totalBusinesses: { monthlyDelta: number; value: number };
    totalInvoices: number;
    totalPaymentsProcessed: number;
  };
  recentRegistrations: Array<{ count: number; date: string; label: string }>;
};

export type AdminBusinessListItem = {
  businessId: string;
  businessName: string;
  createdAt: string;
  defaultCurrency: string;
  email: string | null;
  invoiceCount: number;
  memberCount: number;
  ownerEmail: string;
  ownerName: string | null;
  plan: "business" | "growth" | "starter";
  status: "active" | "pending" | "suspended";
};

export type AdminBusinessDetail = {
  activity: Array<{
    action: string;
    createdAt: string;
    detail: Record<string, unknown>;
    id: number | string;
    summary: string;
  }>;
  business: {
    address: string | null;
    businessId: string;
    businessName: string;
    createdAt: string;
    email: string | null;
    legalName: string | null;
    ownerEmail: string;
    ownerName: string | null;
    phone: string | null;
    plan: "business" | "growth" | "starter";
    payoutApprovalThresholdAmount: number;
    payoutLimitDailyAmount: number;
    payoutLimitPerTransactionAmount: number;
    payoutLimitWeeklyAmount: number;
    payoutsFrozen: boolean;
    status: "active" | "pending" | "suspended";
  };
  invoices: Array<{
    amount: number;
    customerName: string;
    invoiceId: string;
    invoiceNumber: string;
    status: string;
  }>;
  members: Array<{
    email: string;
    fullName: string | null;
    lastActive: string | null;
    membershipId: string;
    role: string;
    status: string;
    userId: string;
  }>;
  stats: {
    totalBills: number;
    totalInvoices: number;
    totalPaymentsProcessed: number;
  };
};

export type AdminBusinessesResponse = {
  rows: AdminBusinessListItem[];
  total: number;
};

export type AdminBusinessInvoicesResponse = {
  businessName: string;
  invoices: Array<{
    amount: number;
    customerName: string;
    dueDate: string | null;
    invoiceId: string;
    invoiceNumber: string;
    issueDate: string;
    status: string;
  }>;
};

export type AdminUsersResponse = {
  rows: Array<{
    email: string;
    fullName: string | null;
    isTestUser: boolean;
    lastActive: string | null;
    mfaEnabled: boolean;
    role: string;
    status: "active" | "inactive" | "suspended";
    userId: string;
    workspaces: string[];
  }>;
  total: number;
};

export type AdminVendorsResponse = {
  rows: Array<{
    accountName: string | null;
    accountNumber: string | null;
    bankName: string | null;
    billCount: number;
    businessId: string;
    businessName: string;
    contactName: string | null;
    createdAt: string;
    email: string | null;
    isTestData: boolean;
    phone: string | null;
    totalPaid: number;
    vendorId: string;
    vendorName: string;
  }>;
  total: number;
};

export type AdminPaymentsResponse = {
  metrics: {
    failedThisMonth: number;
    processedThisMonth: number;
    totalProcessedAllTime: number;
  };
  rows: Array<{
    amount: number;
    businessId: string;
    businessName: string;
    date: string;
    gatewayResponse: string | null;
    marketplaceRouting: {
      enabled: boolean;
      mode: string | null;
      payoutAccountId: string | null;
      providerSplitCode: string | null;
      providerSubaccountCode: string | null;
      splitConfigId: string | null;
      transactionChargeKobo: number | null;
      settlement: {
        amountKobo: number | null;
        currency: string | null;
        feesKobo: number | null;
        gatewayResponse: string | null;
        paidAt: string | null;
        providerReference: string | null;
        providerStatus: string | null;
        transactionDate: string | null;
        verifiedAt: string | null;
      } | null;
    } | null;
    paymentId: string;
    paymentReference: string;
    paymentType: string;
    isTestData: boolean;
    reconciliation: {
      canReconcile: boolean;
      expectedStatus: string | null;
      lastCheckedAt: string | null;
      linkedDocumentNumber: string | null;
      linkedDueDate: string | null;
      needsAttention: boolean;
      sourceStatus: string | null;
      sourceType: "bill" | "invoice" | null;
      summary: string;
      tone: "info" | "neutral" | "success" | "warning";
    };
    status: string;
  }>;
};

export type AdminTestDataDeleteResponse = {
  blocked: {
    payments: Array<{ id: string; reason: string }>;
    payouts: Array<{ id: string; status: string }>;
  };
  deleted: { payments: number; payouts: number };
  ok: boolean;
};

export type AdminReceivablesDeleteResponse = {
  deleted: { invoices: number; payments: number };
  ok: boolean;
};

export type AdminReceivablesResponse = {
  rows: Array<{
    amountPaid: number;
    balanceDue: number;
    businessId: string;
    businessName: string;
    currency: string;
    customerEmail: string | null;
    customerName: string;
    dueDate: string | null;
    invoiceId: string;
    invoiceNumber: string;
    isTestData: boolean;
    issueDate: string;
    paidAt: string | null;
    paymentGateway: string | null;
    paymentReference: string | null;
    paymentStatus: string | null;
    status: string;
    totalAmount: number;
  }>;
  total: number;
};

export type AdminPayoutsResponse = {
  metrics: {
    completedThisMonth: number;
    failedThisMonth: number;
    reservedTotal: number;
    totalCount: number;
    totalValue: number;
  };
  rows: Array<{
    amount: number;
    bankName: string | null;
    billNumber: string | null;
    businessId: string;
    businessName: string;
    cancelledAt: string | null;
    completedAt: string | null;
    createdAt: string;
    currency: string;
    failureReason: string | null;
    failedAt: string | null;
    lastAttemptAt: string | null;
    nextRetryAt: string | null;
    payoutId: string;
    isTestData: boolean;
    providerReference: string | null;
    providerTransferCode: string | null;
    recipientBankCode: string | null;
    retryCount: number;
    scheduledFor: string | null;
    status: string;
    submittedAt: string | null;
    vendorName: string | null;
  }>;
};

export type AdminSubscriptionsResponse = {
  metrics: {
    activeSubscriptions: number;
    annualizedRevenue: number;
    monthlyRecurringRevenue: number;
    renewalsDueSoon: number;
  };
  rows: Array<{
    amount: number;
    billingCycle: "annual" | "free" | "manual" | "monthly";
    businessId: string;
    businessName: string;
    cancelAtPeriodEnd: boolean;
    cancelledAt: string | null;
    currency: string;
    nextRenewalAt: string | null;
    notes: string | null;
    ownerEmail: string;
    plan: "business" | "growth" | "starter";
    provider: string;
    providerCustomerId: string | null;
    providerSubscriptionId: string | null;
    startedAt: string;
    status: "active" | "cancelled" | "past_due" | "paused" | "trial";
    updatedAt: string | null;
  }>;
  total: number;
};

export type AdminAnnouncement = {
  announcementId: string;
  body: string;
  createdAt: string;
  expiresAt: string | null;
  publishedAt: string | null;
  status: "expired" | "live" | "scheduled";
  target: string;
  title: string;
  type: "feature" | "info" | "maintenance" | "warning";
};

export type AdminAnnouncementsResponse = {
  rows: AdminAnnouncement[];
};

export type AdminContentItem = {
  body: string;
  category: string | null;
  changes: Array<{ text?: string; type?: string }>;
  contentType: "help_article" | "changelog";
  excerpt: string | null;
  id: string;
  published: boolean;
  releaseDate: string | null;
  relatedHelpSlugs: string[];
  slug: string;
  sortOrder: number;
  tag: string | null;
  title: string;
  version: string | null;
};

export type AdminContentResponse = {
  items: AdminContentItem[];
};

export type AdminSupportResponse = {
  businesses: AdminBusinessListItem[];
  invoices: Array<{
    amount: number;
    businessName: string;
    invoiceId: string;
    invoiceNumber: string;
    status: string;
  }>;
  payouts: Array<{
    amount: number;
    bankName: string | null;
    billNumber: string | null;
    businessName: string;
    completedAt: string | null;
    createdAt: string;
    currency: string;
    failureReason: string | null;
    lastAttemptAt: string | null;
    nextRetryAt: string | null;
    payoutId: string;
    providerReference: string | null;
    providerTransferCode: string | null;
    recipientBankCode: string | null;
    retryCount: number;
    scheduledFor: string | null;
    status: string;
    submittedAt: string | null;
    vendorName: string | null;
  }>;
  payoutAudits: Array<{
    action: string;
    businessName: string | null;
    createdAt: string;
    detail: Record<string, unknown>;
    id: number | string;
    summary: string;
  }>;
  users: AdminUsersResponse["rows"];
};

export type AdminAuditResponse = {
  rows: Array<{
    action: string;
    actorEmail: string | null;
    businessName: string | null;
    createdAt: string;
    detail: Record<string, unknown>;
    id: number | string;
    isAdminAction: boolean;
    summary: string;
  }>;
  total?: number;
};

export type AdminHealthResponse = AdminOverviewResponse["health"];

export type AdminSettingsResponse = {
  adminUsers: Array<{
    addedAt: string;
    adminUserId: string;
    email: string;
    fullName: string | null;
    role: "super_admin" | "support";
    userId: string;
  }>;
  platformConfig: Array<{
    key: string;
    updatedAt: string;
    value: Record<string, unknown> | null;
  }>;
};

export type AdminSignupAlertsResponse = {
  rows: Array<{
    businessName: string | null;
    createdAt: string;
    deliveredAt: string | null;
    deliveryStatus: string;
    email: string;
    environment: string;
    failureReason: string | null;
    fullName: string | null;
    id: string;
    plan: string;
    providerMessageId: string | null;
    signupStatus: string;
  }>;
};

export type AdminConsoleAction =
  | "overview"
  | "businesses.list"
  | "businesses.detail"
  | "businesses.invoices"
  | "businesses.export"
  | "businesses.action"
  | "users.list"
  | "users.action"
  | "vendors.list"
  | "subscriptions.list"
  | "subscriptions.update"
  | "payments.list"
  | "payments.export"
  | "payments.reconcile"
  | "receivables.list"
  | "receivables.export"
  | "banks.delete"
  | "testData.preview"
  | "testData.delete"
  | "testData.receivables.delete"
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

type AdminConsolePayload = {
  action: AdminConsoleAction;
  payload?: Record<string, unknown>;
};

export const invokeAdminConsole = async <T>(
  action: AdminConsoleAction,
  payload?: Record<string, unknown>,
): Promise<T> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to be signed in before using the admin console.");
  }

  const { data, error, response } = await supabase.functions.invoke("admin-console", {
    body: {
      action,
      payload,
    } satisfies AdminConsolePayload,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const responseMessage = await getResponseErrorMessage(isResponseLike(response) ? response : undefined);
    throw new Error(responseMessage ?? (await getFunctionErrorMessage(error)));
  }

  if (!data) {
    throw new Error("The admin console returned an empty response.");
  }

  return data as T;
};

export const createAdminQueryKey = (action: AdminConsoleAction, payload?: Record<string, unknown>) =>
  ["admin-console", action, payload ?? null] as const;

export const useAdminConsoleQuery = <T>(
  action: AdminConsoleAction,
  payload?: Record<string, unknown>,
  enabled = true,
) =>
  useQuery({
    enabled,
    queryKey: createAdminQueryKey(action, payload),
    queryFn: () => invokeAdminConsole<T>(action, payload),
  });

export const useAdminConsoleMutation = (
  action: AdminConsoleAction,
  invalidateQueryKeys: QueryKey[] = [],
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload?: Record<string, unknown>) => invokeAdminConsole(action, payload),
    onSuccess: async () => {
      await Promise.all(
        invalidateQueryKeys.map((queryKey) =>
          queryClient.invalidateQueries({
            queryKey,
          }),
        ),
      );
    },
  });
};
