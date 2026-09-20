import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { recordFinanceAuditLog } from "../_shared/finance-audit.ts";
import { notifyFinanceUsers } from "../_shared/finance-notifications.ts";

type PayoutAction =
  | "self.request-payout"
  | "self.release-payout"
  | "self.schedule-payout"
  | "self.process-due-payouts";

type PayoutRequest =
  | {
      action: "self.request-payout";
      billId: string;
      businessId: string;
      idempotencyKey?: string | null;
    }
  | {
      action: "self.release-payout";
      payoutId: string;
      businessId: string;
      failureReason?: string | null;
    }
  | {
      action: "self.schedule-payout";
      billId: string;
      businessId: string;
      idempotencyKey?: string | null;
      scheduledFor: string;
    }
  | {
      action: "self.process-due-payouts";
      limit?: number | null;
    }
  | {
      action: "self.cancel-scheduled-payout";
      businessId: string;
      payoutId: string;
      failureReason?: string | null;
    }
  | {
      action: "self.reschedule-scheduled-payout";
      businessId: string;
      payoutId: string;
      scheduledFor: string;
    }
  | {
      action: "self.approve-payout";
      businessId: string;
      payoutId: string;
    };

type BusinessContext = {
  defaultCurrency: string | null;
  id: string;
  name: string;
  payoutsFrozen: boolean;
  payoutApprovalThresholdAmount: number;
  payoutLimitDailyAmount: number;
  payoutLimitPerTransactionAmount: number;
  payoutLimitWeeklyAmount: number;
  role: string;
};

type BillRow = {
  amount_paid: number;
  bill_date: string;
  bill_number: string;
  currency: string;
  due_date: string | null;
  id: string;
  status: string;
  total_amount: number;
  vendor_id: string;
};

type VendorRow = {
  account_name: string | null;
  account_number: string | null;
  bank_id: string | null;
  business_name: string;
  id: string;
};

type BankRow = {
  bank_code: string | null;
  country_code: string;
  id: string;
  name: string;
};

type WalletRow = {
  balance: number | null;
  business_id: string;
  currency: string | null;
  id: string;
  reserved_balance: number | null;
};

type PayoutRow = {
  amount: number;
  business_id: string;
  bill_id: string | null;
  id: string;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  provider_recipient_code: string | null;
  provider_reference: string | null;
  provider_transfer_code: string | null;
  provider_metadata: Record<string, unknown> | null;
  scheduled_for: string | null;
  retry_count: number;
  status: string;
  wallet_id: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const MAX_PAYOUT_RETRIES = 3;
const MAX_PAYOUT_REQUESTS_PER_MINUTE = 5;

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

const toKobo = (amount: number) => Math.round(amount * 100);

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

const isTemporaryProviderFailure = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error && typeof error.message === "string"
        ? error.message
        : "";
  const normalizedMessage = message.toLowerCase();

  return (
    normalizedMessage.includes("temporarily") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("network") ||
    normalizedMessage.includes("connection") ||
    normalizedMessage.includes("unavailable") ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("gateway") ||
    normalizedMessage.includes("503") ||
    normalizedMessage.includes("502") ||
    normalizedMessage.includes("500")
  );
};

const getRetryDelayMinutes = (retryCount: number) => {
  const safeRetryCount = Math.max(0, Math.min(retryCount, 5));
  return Math.min(60, 5 * 2 ** safeRetryCount);
};

const enforcePayoutRateLimit = async ({
  adminClient,
  businessId,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  userId: string;
}) => {
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const recentAuditResponse = await adminClient
    .from("audit_logs")
    .select("id", { count: "exact" })
    .eq("business_id", businessId)
    .eq("actor_user_id", userId)
    .in("action", ["payout.requested", "payout.scheduled"])
    .gte("created_at", windowStart);

  if (recentAuditResponse.error) {
    throw recentAuditResponse.error;
  }

  if ((recentAuditResponse.count ?? 0) >= MAX_PAYOUT_REQUESTS_PER_MINUTE) {
    throw new Error("Payout requests are temporarily rate limited. Please wait a moment before trying again.");
  }
};

const recordPayoutAuditLog = async ({
  action,
  actorUserId = null,
  adminClient,
  businessId,
  detail = {},
  entityId,
  summary,
}: {
  action: string;
  actorUserId?: string | null;
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  detail?: Record<string, unknown>;
  entityId: string;
  summary: string;
}) =>
  recordFinanceAuditLog({
    action,
    actorUserId,
    adminClient,
    businessId,
    detail,
    entityId,
    entityType: "payout",
    summary,
  });

const loadManagedBusiness = async ({
  adminClient,
  businessId,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  userId: string;
}): Promise<BusinessContext | null> => {
  const [membershipResponse, businessResponse, overrideResponse] = await Promise.all([
    adminClient
      .from("business_members")
      .select("business_id, role, status")
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", ["owner", "admin", "accountant"])
      .maybeSingle(),
    adminClient
      .from("businesses")
      .select("id, name, default_currency")
      .eq("id", businessId)
      .maybeSingle(),
    adminClient
      .from("business_admin_overrides")
      .select(
        "business_id, payouts_frozen, payout_approval_threshold_amount, payout_limit_per_transaction_amount, payout_limit_daily_amount, payout_limit_weekly_amount",
      )
      .eq("business_id", businessId)
      .maybeSingle(),
  ]);

  if (membershipResponse.error) {
    throw membershipResponse.error;
  }

  if (businessResponse.error) {
    throw businessResponse.error;
  }

  if (overrideResponse.error) {
    throw overrideResponse.error;
  }

  if (!membershipResponse.data || !businessResponse.data) {
    return null;
  }

  return {
    defaultCurrency: asNullableString(businessResponse.data.default_currency),
    id: asString(businessResponse.data.id),
    name: asString(businessResponse.data.name),
    payoutApprovalThresholdAmount: asNumber(overrideResponse.data?.payout_approval_threshold_amount ?? 0),
    payoutLimitDailyAmount: asNumber(overrideResponse.data?.payout_limit_daily_amount ?? 0),
    payoutLimitPerTransactionAmount: asNumber(overrideResponse.data?.payout_limit_per_transaction_amount ?? 0),
    payoutLimitWeeklyAmount: asNumber(overrideResponse.data?.payout_limit_weekly_amount ?? 0),
    payoutsFrozen: Boolean(overrideResponse.data?.payouts_frozen),
    role: asString(membershipResponse.data.role),
  };
};

const assertPayoutsNotFrozen = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
}) => {
  const response = await adminClient
    .from("business_admin_overrides")
    .select("payouts_frozen")
    .eq("business_id", businessId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  if (response.data?.payouts_frozen) {
    throw new Error("Payouts are temporarily on hold for this workspace.");
  }
};

const needsPayoutApproval = (amount: number, threshold: number) =>
  Number.isFinite(amount) && Number.isFinite(threshold) && threshold > 0 && amount > threshold;

const payoutStatusesThatCountTowardLimits = ["pending_approval", "reserved", "submitted", "processing", "completed"] as const;

const loadPayoutLimitTotals = async ({
  adminClient,
  businessId,
}: {
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
}) => {
  const dailyWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const weeklyWindowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [dailyResponse, weeklyResponse] = await Promise.all([
    adminClient
      .from("workspace_payouts")
      .select("amount")
      .eq("business_id", businessId)
      .in("status", payoutStatusesThatCountTowardLimits as unknown as string[])
      .gte("created_at", dailyWindowStart),
    adminClient
      .from("workspace_payouts")
      .select("amount")
      .eq("business_id", businessId)
      .in("status", payoutStatusesThatCountTowardLimits as unknown as string[])
      .gte("created_at", weeklyWindowStart),
  ]);

  if (dailyResponse.error) {
    throw dailyResponse.error;
  }

  if (weeklyResponse.error) {
    throw weeklyResponse.error;
  }

  const sumAmounts = (rows: Array<{ amount: number | null }>) =>
    rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return {
    dailyAmount: sumAmounts((dailyResponse.data ?? []) as Array<{ amount: number | null }>),
    weeklyAmount: sumAmounts((weeklyResponse.data ?? []) as Array<{ amount: number | null }>),
  };
};

const assertPayoutWithinLimits = async ({
  adminClient,
  amount,
  business,
}: {
  adminClient: ReturnType<typeof createClient>;
  amount: number;
  business: BusinessContext;
}) => {
  if (business.payoutLimitPerTransactionAmount > 0 && amount > business.payoutLimitPerTransactionAmount) {
    throw new Error(`This payout exceeds the workspace per-transaction limit of ${business.payoutLimitPerTransactionAmount}.`);
  }

  if (business.payoutLimitDailyAmount > 0 || business.payoutLimitWeeklyAmount > 0) {
    const totals = await loadPayoutLimitTotals({
      adminClient,
      businessId: business.id,
    });

    if (business.payoutLimitDailyAmount > 0 && totals.dailyAmount + amount > business.payoutLimitDailyAmount) {
      throw new Error(`This payout would exceed the workspace daily payout limit of ${business.payoutLimitDailyAmount}.`);
    }

    if (business.payoutLimitWeeklyAmount > 0 && totals.weeklyAmount + amount > business.payoutLimitWeeklyAmount) {
      throw new Error(`This payout would exceed the workspace weekly payout limit of ${business.payoutLimitWeeklyAmount}.`);
    }
  }
};

const loadBill = async ({
  adminClient,
  billId,
}: {
  adminClient: ReturnType<typeof createClient>;
  billId: string;
}): Promise<BillRow | null> => {
  const response = await adminClient
    .from("bills")
    .select("id, vendor_id, bill_number, bill_date, due_date, status, total_amount, amount_paid, currency")
    .eq("id", billId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as BillRow | null;
};

const loadVendor = async ({
  adminClient,
  vendorId,
}: {
  adminClient: ReturnType<typeof createClient>;
  vendorId: string;
}): Promise<VendorRow | null> => {
  const response = await adminClient
    .from("vendors")
    .select("id, business_name, account_name, account_number, bank_id")
    .eq("id", vendorId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as VendorRow | null;
};

const loadBank = async ({
  adminClient,
  bankId,
}: {
  adminClient: ReturnType<typeof createClient>;
  bankId: string;
}): Promise<BankRow | null> => {
  const response = await adminClient
    .from("banks")
    .select("id, name, bank_code, country_code")
    .eq("id", bankId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as BankRow | null;
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
    .select("id, business_id, currency, balance, reserved_balance")
    .eq("business_id", businessId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as WalletRow | null;
};

const loadPayout = async ({
  adminClient,
  payoutId,
}: {
  adminClient: ReturnType<typeof createClient>;
  payoutId: string;
}): Promise<PayoutRow | null> => {
  const response = await adminClient
    .from("workspace_payouts")
    .select(
      "id, business_id, bill_id, wallet_id, amount, status, provider_reference, provider_recipient_code, provider_transfer_code, provider_metadata, scheduled_for, retry_count, last_attempt_at, next_retry_at",
    )
    .eq("id", payoutId)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data as PayoutRow | null;
};

const loadDuePayouts = async ({
  adminClient,
  limit,
}: {
  adminClient: ReturnType<typeof createClient>;
  limit: number;
}): Promise<PayoutRow[]> => {
  const response = await adminClient
    .from("workspace_payouts")
    .select(
      "id, business_id, bill_id, wallet_id, amount, status, provider_reference, provider_recipient_code, provider_transfer_code, provider_metadata, scheduled_for, retry_count, last_attempt_at, next_retry_at",
    )
    .eq("status", "reserved")
    .lte("scheduled_for", new Date().toISOString())
    .or("next_retry_at.is.null,next_retry_at.lte." + new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (response.error) {
    throw response.error;
  }

  return (response.data ?? []) as PayoutRow[];
};

const submitReservedPayout = async ({
  adminClient,
  bank,
  bill,
  business,
  payout,
  paystackSecretKey,
  source,
  onTransferInitiated,
  userId,
  vendor,
  wallet,
}: {
  adminClient: ReturnType<typeof createClient>;
  bank: BankRow;
  bill: BillRow;
  business: BusinessContext;
  payout: PayoutRow;
  paystackSecretKey: string;
  source: "immediate" | "scheduled" | "approved";
  onTransferInitiated?: () => void;
  userId: string | null;
  vendor: VendorRow;
  wallet: WalletRow;
}) => {
  const providerRecipientCode = payout.provider_recipient_code?.trim() || null;
  let resolvedRecipientCode = providerRecipientCode;

  if (!resolvedRecipientCode) {
    const recipientPayload = await sendPaystackRequest<{
      data?: { recipient_code?: string };
    }>(
      "/transferrecipient",
      {
        account_number: vendor.account_number,
        bank_code: bank.bank_code,
        currency: bill.currency ?? business.defaultCurrency ?? "NGN",
        metadata: {
          bank_id: bank.id,
          bill_id: bill.id,
          business_id: business.id,
          payout_id: payout.id,
          source: source === "scheduled" ? "workspace_scheduled_bill_payout" : "workspace_bill_payout",
          vendor_id: vendor.id,
          wallet_id: wallet.id,
        },
        name: vendor.account_name?.trim() || vendor.business_name,
        type: "nuban",
      },
      paystackSecretKey,
    );

    resolvedRecipientCode = recipientPayload.data?.recipient_code?.trim() ?? null;
    if (!resolvedRecipientCode) {
      throw new Error("The payment provider did not return a transfer recipient code.");
    }
  }

  const transferReference = payout.provider_reference?.trim() || `payout-${payout.id}`;
  const transferPayload = await sendPaystackRequest<{
    data?: { reference?: string; status?: string; transfer_code?: string };
  }>(
    "/transfer",
    {
      amount: toKobo(Number(payout.amount ?? 0)),
      currency: bill.currency ?? business.defaultCurrency ?? "NGN",
      reason: `Bill ${bill.bill_number} payout`,
      recipient: resolvedRecipientCode,
      reference: transferReference,
      source: "balance",
    },
    paystackSecretKey,
  );

  onTransferInitiated?.();

  const transferCode = transferPayload.data?.transfer_code?.trim() ?? null;
  const transferStatus = transferPayload.data?.status?.trim().toLowerCase() ?? "pending";

  const { error: payoutUpdateError } = await adminClient
    .from("workspace_payouts")
    .update({
      provider_recipient_code: resolvedRecipientCode,
      provider_reference: transferPayload.data?.reference?.trim() ?? transferReference,
      provider_transfer_code: transferCode,
      provider_metadata: {
        bill_id: bill.id,
        bill_number: bill.bill_number,
        bank_code: bank.bank_code,
        bank_id: bank.id,
        business_id: business.id,
        execution_source: source,
        paystack_recipient_code: resolvedRecipientCode,
        paystack_transfer_status: transferStatus,
        payout_id: payout.id,
        vendor_id: vendor.id,
        wallet_id: wallet.id,
      },
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("id", payout.id);

  if (payoutUpdateError) {
    throw payoutUpdateError;
  }

  if (source === "immediate" || source === "scheduled") {
    try {
    await notifyFinanceUsers({
      adminClient,
      body:
        source === "scheduled"
          ? `Bill ${bill.bill_number} payout was submitted for ${bill.currency ?? business.defaultCurrency ?? "NGN"}.`
          : source === "approved"
            ? `Bill ${bill.bill_number} payout was approved and submitted for ${bill.currency ?? business.defaultCurrency ?? "NGN"}.`
            : `Bill ${bill.bill_number} payout was submitted for ${bill.currency ?? business.defaultCurrency ?? "NGN"}.`,
      businessId: business.id,
      link: "/wallet",
      title: source === "scheduled" ? "Scheduled payout submitted" : source === "approved" ? "Approved payout submitted" : "Payout submitted",
      type: "payment",
    });
    } catch (notificationError) {
      console.error("workspace-payout-execution notification failure", notificationError);
    }
  }

  await recordPayoutAuditLog({
    action: source === "scheduled" ? "payout.scheduled_submitted" : source === "approved" ? "payout.approved_submitted" : "payout.submitted",
    actorUserId: userId,
    adminClient,
    businessId: business.id,
    detail: {
      amount: Number(payout.amount ?? 0),
      bill_id: bill.id,
      bill_number: bill.bill_number,
      provider_reference: transferPayload.data?.reference?.trim() ?? transferReference,
      provider_transfer_code: transferCode,
      source: source,
      vendor_id: vendor.id,
      vendor_name: vendor.business_name,
      wallet_id: wallet.id,
    },
    entityId: payout.id,
    summary:
      source === "scheduled"
        ? `Scheduled payout submitted for bill ${bill.bill_number}`
        : source === "approved"
          ? `Approved payout submitted for bill ${bill.bill_number}`
          : `Payout submitted for bill ${bill.bill_number}`,
  });

  return {
    amount: Number(payout.amount ?? 0),
    billId: bill.id,
    businessId: business.id,
    payoutId: payout.id,
    payoutStatus: "submitted",
    providerRecipientCode: resolvedRecipientCode,
    providerReference: transferPayload.data?.reference?.trim() ?? transferReference,
    providerTransferCode: transferCode,
    status: transferStatus,
    success: true as const,
  };
};

const getPaystackSecretKey = () => Deno.env.get("PAYSTACK_SECRET_KEY")?.trim() ?? "";

const getAppBaseUrl = () => Deno.env.get("APP_BASE_URL")?.trim() ?? "";

const handleRequestPayout = async ({
  adminClient,
  business,
  bill,
  idempotencyKey,
  paystackSecretKey,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  bill: BillRow;
  business: BusinessContext;
  idempotencyKey?: string | null;
  paystackSecretKey: string;
  userId: string;
}) => {
  let payoutReservationId: string | null = null;
  let transferInitiated = false;

  if (bill.status === "paid" || bill.status === "cancelled") {
    return json({ error: "Paid or cancelled bills cannot be paid out again." }, 400);
  }

  const amountDue = Number(bill.total_amount ?? 0) - Number(bill.amount_paid ?? 0);
  if (!Number.isFinite(amountDue) || amountDue <= 0) {
    return json({ error: "This bill does not have an outstanding payout amount." }, 400);
  }

  await assertPayoutWithinLimits({
    adminClient,
    amount: amountDue,
    business,
  });

  const vendor = await loadVendor({ adminClient, vendorId: bill.vendor_id });
  if (!vendor) {
    return json({ error: "We could not find the vendor for this payout." }, 404);
  }

  if (!vendor.bank_id || !vendor.account_number) {
    return json({ error: "The vendor needs bank details before this payout can be sent." }, 400);
  }

  const bank = await loadBank({ adminClient, bankId: vendor.bank_id });
  if (!bank || !bank.bank_code) {
    return json({ error: "This vendor bank needs a bank code before payout execution can continue." }, 400);
  }

  const wallet = await loadWallet({ adminClient, businessId: business.id });
  if (!wallet) {
    return json({ error: "We could not find a wallet for this workspace." }, 404);
  }

  if (!paystackSecretKey) {
    return json({ error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to your Supabase Edge Function secrets." }, 500);
  }

  await enforcePayoutRateLimit({
    adminClient,
    businessId: business.id,
    userId,
  });

  const payoutKey = idempotencyKey?.trim() || `bill-${bill.id}`;
  try {
    const reserveResult = await adminClient.rpc("reserve_workspace_payout", {
      p_amount: amountDue,
      p_bill_id: bill.id,
      p_business_id: business.id,
      p_created_by: userId,
      p_currency: bill.currency ?? business.defaultCurrency ?? "NGN",
      p_idempotency_key: payoutKey,
      p_provider_metadata: {
        bill_id: bill.id,
        bill_number: bill.bill_number,
        vendor_id: vendor.id,
        vendor_name: vendor.business_name,
        bank_id: bank.id,
        bank_code: bank.bank_code,
      },
      p_vendor_bank_id: bank.id,
      p_vendor_id: vendor.id,
      p_wallet_id: wallet.id,
    } as never);

    if (reserveResult.error) {
      throw reserveResult.error;
    }

    const reservedPayout = Array.isArray(reserveResult.data) ? reserveResult.data[0] : reserveResult.data;
    payoutReservationId = reservedPayout?.payout_id ?? null;
    if (!payoutReservationId) {
      return json({ error: "We could not reserve wallet funds for this payout." }, 500);
    }

    const approvalRequired = needsPayoutApproval(Number(bill.total_amount ?? 0) - Number(bill.amount_paid ?? 0), business.payoutApprovalThresholdAmount);
    if (approvalRequired) {
      const { error: approvalUpdateError } = await adminClient
        .from("workspace_payouts")
        .update({
          approval_required_at: new Date().toISOString(),
          provider_metadata: {
            approval_required_at: new Date().toISOString(),
            approval_threshold_amount: business.payoutApprovalThresholdAmount,
            bill_id: bill.id,
            bill_number: bill.bill_number,
            business_id: business.id,
            payout_id: payoutReservationId,
            source: "immediate",
          },
          status: "pending_approval",
          updated_by: userId,
        })
        .eq("id", payoutReservationId);

      if (approvalUpdateError) {
        throw approvalUpdateError;
      }

      await recordPayoutAuditLog({
        action: "payout.approval_required",
        actorUserId: userId,
        adminClient,
        businessId: business.id,
        detail: {
          approval_threshold_amount: business.payoutApprovalThresholdAmount,
          amount: Number(bill.total_amount ?? 0) - Number(bill.amount_paid ?? 0),
          bill_id: bill.id,
          bill_number: bill.bill_number,
          payout_id: payoutReservationId,
        },
        entityId: payoutReservationId,
        summary: `Payout for bill ${bill.bill_number} now needs approval`,
      });

      try {
        await notifyFinanceUsers({
          adminClient,
          body: `Bill ${bill.bill_number} payout now needs approval before it can be submitted.`,
          businessId: business.id,
          link: "/wallet",
          title: "Payout needs approval",
          type: "payment",
        });
      } catch (notificationError) {
        console.error("workspace-payout-execution approval notification failure", notificationError);
      }

      return {
        amount: Number(bill.total_amount ?? 0) - Number(bill.amount_paid ?? 0),
        billId: bill.id,
        businessId: business.id,
        payoutId: payoutReservationId,
        payoutStatus: "pending_approval",
        success: true as const,
        requiresApproval: true,
      };
    }

    const payoutReservation = reservedPayout;
    const payout = await loadPayout({
      adminClient,
      payoutId: payoutReservationId,
    });

    if (!payout) {
      throw new Error("The payout reservation could not be loaded for submission.");
    }

    await recordPayoutAuditLog({
      action: "payout.requested",
      actorUserId: userId,
      adminClient,
      businessId: business.id,
      detail: {
        amount: amountDue,
        bill_id: bill.id,
        bill_number: bill.bill_number,
        vendor_id: vendor.id,
        vendor_name: vendor.business_name,
      },
      entityId: payout.id,
      summary: `Payout requested for bill ${bill.bill_number}`,
    });

    const result = await submitReservedPayout({
      adminClient,
      bank,
      bill,
      business,
      payout,
      paystackSecretKey,
      source: "immediate",
      onTransferInitiated: () => {
        transferInitiated = true;
      },
      userId,
      vendor,
      wallet,
    });

    return json({
      ...result,
      amount: amountDue,
    });
  } catch (error) {
    if (payoutReservationId && !transferInitiated) {
      const releaseResult = await adminClient.rpc("release_workspace_payout_reservation", {
        p_business_id: business.id,
        p_failure_reason: error instanceof Error ? error.message : "The payout request failed before provider transfer creation.",
        p_payout_id: payoutReservationId,
        p_updated_by: userId,
      });

      if (releaseResult.error) {
        console.error("workspace-payout-execution release failure", releaseResult.error);
      }
    }

    throw error;
  }
};

const handleReleasePayout = async ({
  adminClient,
  payout,
  reason,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  payout: PayoutRow;
  reason?: string | null;
  userId: string;
}) => {
  const { error } = await adminClient.rpc("release_workspace_payout_reservation", {
    p_business_id: payout.business_id,
    p_failure_reason: reason ?? null,
    p_payout_id: payout.id,
    p_updated_by: userId,
  });

  if (error) {
    throw error;
  }

  await recordPayoutAuditLog({
    action: "payout.released",
    actorUserId: userId,
    adminClient,
    businessId: payout.business_id,
    detail: {
      failure_reason: reason ?? null,
      payout_status: payout.status,
      payout_id: payout.id,
    },
    entityId: payout.id,
    summary: `Reserved payout funds released for payout ${payout.id}`,
  });

  return json({
    payoutId: payout.id,
    success: true,
  });
};

const handleCancelScheduledPayout = async ({
  adminClient,
  payout,
  reason,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  payout: PayoutRow;
  reason?: string | null;
  userId: string;
}) => {
  const { error } = await adminClient.rpc("cancel_workspace_payout_reservation", {
    p_business_id: payout.business_id,
    p_failure_reason: reason ?? null,
    p_payout_id: payout.id,
    p_updated_by: userId,
  });

  if (error) {
    throw error;
  }

  await recordPayoutAuditLog({
    action: "payout.cancelled",
    actorUserId: userId,
    adminClient,
    businessId: payout.business_id,
    detail: {
      failure_reason: reason ?? null,
      payout_status: payout.status,
      payout_id: payout.id,
    },
    entityId: payout.id,
    summary: `Scheduled payout cancelled for payout ${payout.id}`,
  });

  return json({
    payoutId: payout.id,
    payoutStatus: "cancelled",
    success: true,
  });
};

const handleReschedulePayout = async ({
  adminClient,
  payout,
  scheduledFor,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  payout: PayoutRow;
  scheduledFor: string;
  userId: string;
}) => {
  if (payout.status !== "reserved") {
    return json({ error: "This payout can only be rescheduled while reserved." }, 400);
  }

  const scheduledDate = new Date(scheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) {
    return json({ error: "A valid scheduled execution time is required." }, 400);
  }

  if (scheduledDate.getTime() <= Date.now()) {
    return json({ error: "Scheduled payout time must be in the future." }, 400);
  }

  const { error } = await adminClient
    .from("workspace_payouts")
    .update({
      scheduled_for: scheduledDate.toISOString(),
      updated_by: userId,
    })
    .eq("id", payout.id)
    .eq("business_id", payout.business_id)
    .eq("status", "reserved");

  if (error) {
    throw error;
  }

  await recordPayoutAuditLog({
    action: "payout.rescheduled",
    actorUserId: userId,
    adminClient,
    businessId: payout.business_id,
    detail: {
      payout_id: payout.id,
      scheduled_for: scheduledDate.toISOString(),
    },
    entityId: payout.id,
    summary: `Scheduled payout rescheduled for payout ${payout.id}`,
  });

  return json({
    payoutId: payout.id,
    payoutStatus: "reserved",
    scheduledFor: scheduledDate.toISOString(),
    success: true,
  });
};

const handleApprovePayout = async ({
  adminClient,
  business,
  payout,
  paystackSecretKey,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  business: BusinessContext;
  payout: PayoutRow;
  paystackSecretKey: string;
  userId: string;
}) => {
  if (!["owner", "admin"].includes(business.role)) {
    return json({ error: "Only owners or admins can approve payouts." }, 403);
  }

  if (payout.status !== "pending_approval") {
    return json({ error: "This payout is not waiting for approval." }, 400);
  }

  const bill = payout.bill_id ? await loadBill({ adminClient, billId: payout.bill_id }) : null;
  if (!bill) {
    return json({ error: "We could not find the bill for this payout." }, 404);
  }

  const vendor = await loadVendor({ adminClient, vendorId: bill.vendor_id });
  const bank = vendor?.bank_id ? await loadBank({ adminClient, bankId: vendor.bank_id }) : null;
  const wallet = await loadWallet({ adminClient, businessId: payout.business_id });

  if (!vendor || !bank || !bank.bank_code || !wallet) {
    return json({ error: "The payout is missing vendor, bank, or wallet details." }, 400);
  }

  const { error: approveUpdateError } = await adminClient
    .from("workspace_payouts")
    .update({
      approved_at: new Date().toISOString(),
      approved_by: userId,
      provider_metadata: {
        ...(payout.provider_metadata ?? {}),
        approved_at: new Date().toISOString(),
        approved_by: userId,
      },
      updated_by: userId,
    })
    .eq("id", payout.id)
    .eq("business_id", payout.business_id)
    .eq("status", "pending_approval");

  if (approveUpdateError) {
    throw approveUpdateError;
  }

  await recordPayoutAuditLog({
    action: "payout.approved",
    actorUserId: userId,
    adminClient,
    businessId: payout.business_id,
    detail: {
      approved_by: userId,
      payout_id: payout.id,
      payout_status: payout.status,
    },
    entityId: payout.id,
    summary: `Payout approved for payout ${payout.id}`,
  });

  if (payout.scheduled_for) {
    const { error: reserveUpdateError } = await adminClient
      .from("workspace_payouts")
      .update({
        status: "reserved",
        updated_by: userId,
      })
      .eq("id", payout.id)
      .eq("business_id", payout.business_id)
      .eq("status", "pending_approval");

    if (reserveUpdateError) {
      throw reserveUpdateError;
    }

    return json({
      payoutId: payout.id,
      payoutStatus: "reserved",
      success: true,
    });
  }

  const result = await submitReservedPayout({
    adminClient,
    bank,
    bill,
    business,
    payout,
    paystackSecretKey,
    source: "approved",
    userId,
    vendor,
    wallet,
  });

  return json({
    payoutId: payout.id,
    payoutStatus: result.payoutStatus,
    providerReference: result.providerReference,
    success: true,
  });
};

const handleSchedulePayout = async ({
  adminClient,
  bill,
  business,
  idempotencyKey,
  scheduledFor,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  bill: BillRow;
  business: BusinessContext;
  idempotencyKey?: string | null;
  scheduledFor: string;
  userId: string;
}) => {
  if (bill.status === "paid" || bill.status === "cancelled") {
    return json({ error: "Paid or cancelled bills cannot be scheduled for payout again." }, 400);
  }

  const amountDue = Number(bill.total_amount ?? 0) - Number(bill.amount_paid ?? 0);
  if (!Number.isFinite(amountDue) || amountDue <= 0) {
    return json({ error: "This bill does not have an outstanding payout amount." }, 400);
  }

  await assertPayoutWithinLimits({
    adminClient,
    amount: amountDue,
    business,
  });

  const vendor = await loadVendor({ adminClient, vendorId: bill.vendor_id });
  if (!vendor) {
    return json({ error: "We could not find the vendor for this payout." }, 404);
  }

  if (!vendor.bank_id || !vendor.account_number) {
    return json({ error: "The vendor needs bank details before this payout can be scheduled." }, 400);
  }

  const bank = await loadBank({ adminClient, bankId: vendor.bank_id });
  if (!bank || !bank.bank_code) {
    return json({ error: "This vendor bank needs a bank code before payout scheduling can continue." }, 400);
  }

  const wallet = await loadWallet({ adminClient, businessId: business.id });
  if (!wallet) {
    return json({ error: "We could not find a wallet for this workspace." }, 404);
  }

  await enforcePayoutRateLimit({
    adminClient,
    businessId: business.id,
    userId,
  });

  const payoutKey = idempotencyKey?.trim() || `bill-schedule-${bill.id}`;
  const scheduleResult = await adminClient.rpc("schedule_workspace_payout", {
    p_amount: amountDue,
    p_bill_id: bill.id,
    p_business_id: business.id,
    p_created_by: userId,
    p_currency: bill.currency ?? business.defaultCurrency ?? "NGN",
    p_idempotency_key: payoutKey,
    p_provider_metadata: {
      bill_id: bill.id,
      bill_number: bill.bill_number,
      vendor_id: vendor.id,
      vendor_name: vendor.business_name,
      bank_id: bank.id,
      bank_code: bank.bank_code,
      scheduled_for: scheduledFor,
      source: "workspace_bill_payout_schedule",
    },
    p_scheduled_for: scheduledFor,
    p_vendor_bank_id: bank.id,
    p_vendor_id: vendor.id,
    p_wallet_id: wallet.id,
  } as never);

  if (scheduleResult.error) {
    throw scheduleResult.error;
  }

  const payout = Array.isArray(scheduleResult.data) ? scheduleResult.data[0] : scheduleResult.data;
  if (!payout || !payout.payout_id) {
    return json({ error: "We could not reserve wallet funds for this scheduled payout." }, 500);
  }

  try {
    const approvalRequired = needsPayoutApproval(amountDue, business.payoutApprovalThresholdAmount);
    if (approvalRequired) {
      const now = new Date().toISOString();
      const { error: approvalUpdateError } = await adminClient
        .from("workspace_payouts")
        .update({
          approval_required_at: now,
          provider_metadata: {
            ...(payout.provider_metadata ?? {}),
            approval_required_at: now,
            approval_threshold_amount: business.payoutApprovalThresholdAmount,
          },
          status: "pending_approval",
          updated_by: userId,
        })
        .eq("id", payout.payout_id)
        .eq("business_id", business.id);

      if (approvalUpdateError) {
        throw approvalUpdateError;
      }

      await recordPayoutAuditLog({
        action: "payout.approval_required",
        actorUserId: userId,
        adminClient,
        businessId: business.id,
        detail: {
          approval_threshold_amount: business.payoutApprovalThresholdAmount,
          amount: amountDue,
          bill_id: bill.id,
          bill_number: bill.bill_number,
          payout_id: payout.payout_id,
          scheduled_for: payout.scheduled_for ?? scheduledFor,
        },
        entityId: payout.payout_id,
        summary: `Scheduled payout for bill ${bill.bill_number} now needs approval`,
      });

      try {
        await notifyFinanceUsers({
          adminClient,
          body: `Bill ${bill.bill_number} scheduled payout now needs approval before it can be submitted.`,
          businessId: business.id,
          link: "/wallet",
          title: "Scheduled payout needs approval",
          type: "payment",
        });
      } catch (notificationError) {
        console.error("workspace-payout-execution approval notification failure", notificationError);
      }

      return json({
        amount: amountDue,
        billId: bill.id,
        businessId: business.id,
        payoutId: payout.payout_id,
        payoutStatus: "pending_approval",
        scheduledFor: payout.scheduled_for ?? scheduledFor,
        status: "pending_approval",
        success: true,
      });
    }

    try {
      await notifyFinanceUsers({
        adminClient,
        body: `Bill ${bill.bill_number} has been scheduled for payout on ${scheduledFor}.`,
        businessId: business.id,
        link: "/wallet",
        title: "Payout scheduled",
        type: "payment",
      });
    } catch (notificationError) {
      console.error("workspace-payout-execution schedule notification failure", notificationError);
    }

    await recordPayoutAuditLog({
      action: "payout.scheduled",
      actorUserId: userId,
      adminClient,
      businessId: business.id,
      detail: {
        amount: amountDue,
        bill_id: bill.id,
        bill_number: bill.bill_number,
        scheduled_for: payout.scheduled_for ?? scheduledFor,
        vendor_id: vendor.id,
        vendor_name: vendor.business_name,
      },
      entityId: payout.payout_id,
      summary: `Payout scheduled for bill ${bill.bill_number}`,
    });

    return json({
      amount: amountDue,
      billId: bill.id,
      businessId: business.id,
      payoutId: payout.payout_id,
      payoutStatus: payout.status ?? "reserved",
      scheduledFor: payout.scheduled_for ?? scheduledFor,
      status: payout.status ?? "reserved",
      success: true,
    });
  } catch (error) {
    const { error: releaseError } = await adminClient.rpc("release_workspace_payout_reservation", {
      p_business_id: business.id,
      p_failure_reason: error instanceof Error ? error.message : "The scheduled payout failed before completion.",
      p_payout_id: payout.payout_id,
      p_updated_by: userId,
    });

    if (releaseError) {
      console.error("workspace-payout-execution schedule release failure", releaseError);
    }

    throw error;
  }
};

const handleProcessDuePayouts = async ({
  adminClient,
  limit,
  paystackSecretKey,
  userId,
}: {
  adminClient: ReturnType<typeof createClient>;
  limit: number;
  paystackSecretKey: string;
  userId: string | null;
}) => {
  if (!paystackSecretKey) {
    return json({ error: "Paystack is not configured yet. Add PAYSTACK_SECRET_KEY to your Supabase Edge Function secrets." }, 500);
  }

  const duePayouts = await loadDuePayouts({ adminClient, limit });
  const results: Array<Record<string, unknown>> = [];

  const recordRetry = async (payout: PayoutRow, error: unknown) => {
    const retryCount = Number(payout.retry_count ?? 0) + 1;
    const retryDelayMinutes = getRetryDelayMinutes(retryCount - 1);
    const nextRetryAt = new Date(Date.now() + retryDelayMinutes * 60_000).toISOString();
    const failureReason = error instanceof Error ? error.message : "The scheduled payout hit a temporary provider failure.";

    const { error: updateError } = await adminClient
      .from("workspace_payouts")
      .update({
        failure_reason: failureReason,
        last_attempt_at: new Date().toISOString(),
        next_retry_at: nextRetryAt,
        retry_count: retryCount,
        provider_metadata: {
          retry_count: retryCount,
          retry_delay_minutes: retryDelayMinutes,
          retry_reason: failureReason,
          retry_scheduled_at: nextRetryAt,
          ...(payout.provider_metadata ?? {}),
        },
        updated_by: userId,
      })
      .eq("id", payout.id);

    if (updateError) {
      throw updateError;
    }

    return {
      nextRetryAt,
      payoutId: payout.id,
      payoutStatus: "reserved",
      retryCount,
    };
  };

  for (const payout of duePayouts) {
    let transferInitiated = false;

    try {
      const freezeResponse = await adminClient
        .from("business_admin_overrides")
        .select("payouts_frozen")
        .eq("business_id", payout.business_id)
        .maybeSingle();

      if (freezeResponse.error) {
        throw freezeResponse.error;
      }

      if (freezeResponse.data?.payouts_frozen) {
        const nextRetryAt = new Date(Date.now() + 30 * 60_000).toISOString();
        const { error: updateError } = await adminClient
          .from("workspace_payouts")
          .update({
            failure_reason: "Payouts are temporarily frozen for this workspace.",
            next_retry_at: nextRetryAt,
            last_attempt_at: new Date().toISOString(),
            updated_by: userId,
          })
          .eq("id", payout.id);

        if (updateError) {
          throw updateError;
        }

        await recordPayoutAuditLog({
          action: "payout.paused",
          actorUserId: userId,
          adminClient,
          businessId: payout.business_id,
          detail: {
            next_retry_at: nextRetryAt,
            payout_id: payout.id,
          },
          entityId: payout.id,
          summary: "Scheduled payout paused because payouts are frozen",
        });

        results.push({
          nextRetryAt,
          payoutId: payout.id,
          status: "paused",
        });
        continue;
      }

      const bill = payout.bill_id ? await loadBill({ adminClient, billId: payout.bill_id }) : null;
      if (!bill) {
        const { error: releaseError } = await adminClient.rpc("release_workspace_payout_reservation", {
          p_business_id: payout.business_id,
          p_failure_reason: "The scheduled payout could not find its bill.",
          p_payout_id: payout.id,
          p_updated_by: userId,
        });

        if (releaseError) {
          throw releaseError;
        }

        try {
          await notifyFinanceUsers({
            adminClient,
            body: `A scheduled payout could not run because the bill record could not be found.`,
            businessId: payout.business_id,
            link: "/wallet",
            title: "Scheduled payout failed",
            type: "payment",
          });
        } catch (notificationError) {
          console.error("workspace-payout-execution failure notification error", notificationError);
        }

        await recordPayoutAuditLog({
          action: "payout.failed",
          actorUserId: userId,
          adminClient,
          businessId: payout.business_id,
          detail: {
            failure_reason: "The scheduled payout could not find its bill.",
            payout_id: payout.id,
          },
          entityId: payout.id,
          summary: `Scheduled payout failed because the bill was missing`,
        });

        results.push({ payoutId: payout.id, status: "failed", reason: "Missing bill" });
        continue;
      }

      const vendor = await loadVendor({ adminClient, vendorId: bill.vendor_id });
      const bank = vendor?.bank_id ? await loadBank({ adminClient, bankId: vendor.bank_id }) : null;
      const wallet = await loadWallet({ adminClient, businessId: payout.business_id });

      if (!vendor || !bank || !bank.bank_code || !wallet) {
        const { error: releaseError } = await adminClient.rpc("release_workspace_payout_reservation", {
          p_business_id: payout.business_id,
          p_failure_reason: "The scheduled payout is missing vendor, bank, or wallet details.",
          p_payout_id: payout.id,
          p_updated_by: userId,
        });

        if (releaseError) {
          throw releaseError;
        }

        try {
          await notifyFinanceUsers({
            adminClient,
            body: `Bill ${bill.bill_number} payout failed because the vendor, bank, or wallet details were incomplete.`,
            businessId: payout.business_id,
            link: "/wallet",
            title: "Scheduled payout failed",
            type: "payment",
          });
        } catch (notificationError) {
          console.error("workspace-payout-execution failure notification error", notificationError);
        }

        await recordPayoutAuditLog({
          action: "payout.failed",
          actorUserId: userId,
          adminClient,
          businessId: payout.business_id,
          detail: {
            failure_reason: "The scheduled payout is missing vendor, bank, or wallet details.",
            payout_id: payout.id,
          },
          entityId: payout.id,
          summary: `Scheduled payout failed because payout context was incomplete`,
        });

        results.push({ payoutId: payout.id, status: "failed", reason: "Missing payout context" });
        continue;
      }

      if (bill.status === "paid" || bill.status === "cancelled") {
        const { error: releaseError } = await adminClient.rpc("release_workspace_payout_reservation", {
          p_business_id: payout.business_id,
          p_failure_reason: "The bill was already paid or cancelled before the scheduled payout could run.",
          p_payout_id: payout.id,
          p_updated_by: userId,
        });

        if (releaseError) {
          throw releaseError;
        }

        try {
          await notifyFinanceUsers({
            adminClient,
            body: `Bill ${bill.bill_number} payout was cancelled because the bill was already paid or cancelled.`,
            businessId: payout.business_id,
            link: "/wallet",
            title: "Scheduled payout failed",
            type: "payment",
          });
        } catch (notificationError) {
          console.error("workspace-payout-execution failure notification error", notificationError);
        }

        await recordPayoutAuditLog({
          action: "payout.failed",
          actorUserId: userId,
          adminClient,
          businessId: payout.business_id,
          detail: {
            failure_reason: "The bill was already paid or cancelled before the scheduled payout could run.",
            payout_id: payout.id,
          },
          entityId: payout.id,
          summary: `Scheduled payout failed because the bill was no longer payable`,
        });

        results.push({ payoutId: payout.id, status: "failed", reason: "Bill no longer payable" });
        continue;
      }

      const fullPayout = await loadPayout({ adminClient, payoutId: payout.id });
      if (!fullPayout) {
        throw new Error("The scheduled payout could not be loaded for execution.");
      }

      const result = await submitReservedPayout({
        adminClient,
        bank,
        bill,
        business: {
          defaultCurrency: bill.currency ?? null,
          id: payout.business_id,
          name: bill.bill_number,
        },
        payout: fullPayout,
        paystackSecretKey,
        source: "scheduled",
        onTransferInitiated: () => {
          transferInitiated = true;
        },
        userId,
        vendor,
        wallet,
      });

      results.push({ payoutId: payout.id, status: result.status, providerReference: result.providerReference });
    } catch (error) {
      console.error("workspace-payout-execution due payout error", error);

      if (isTemporaryProviderFailure(error)) {
        const retryCount = Number(payout.retry_count ?? 0) + 1;

        if (retryCount >= MAX_PAYOUT_RETRIES) {
          const { error: releaseError } = await adminClient.rpc("release_workspace_payout_reservation", {
            p_business_id: payout.business_id,
            p_failure_reason:
              error instanceof Error ? error.message : "The scheduled payout hit too many temporary provider failures.",
            p_payout_id: payout.id,
            p_updated_by: userId,
          });

          if (releaseError) {
            console.error("workspace-payout-execution final retry release failure", releaseError);
          }

          try {
            await notifyFinanceUsers({
              adminClient,
              body: `Bill payout ${payout.provider_reference || payout.id} failed after repeated temporary provider issues.`,
              businessId: payout.business_id,
              link: "/wallet",
              title: "Scheduled payout failed",
              type: "payment",
            });
          } catch (notificationError) {
            console.error("workspace-payout-execution failure notification error", notificationError);
          }

          await recordPayoutAuditLog({
            action: "payout.failed",
            actorUserId: userId,
            adminClient,
            businessId: payout.business_id,
            detail: {
              failure_reason:
                error instanceof Error ? error.message : "The scheduled payout hit too many temporary provider failures.",
              payout_id: payout.id,
            },
            entityId: payout.id,
            summary: `Scheduled payout failed after repeated temporary provider issues`,
          });

          results.push({
            payoutId: payout.id,
            status: "failed",
            reason: "Too many temporary provider failures",
          });
          continue;
        }

        const retryResponse = await recordRetry(payout, error);
        results.push({
          payoutId: payout.id,
          status: "retry_scheduled",
          nextRetryAt: retryResponse.nextRetryAt,
        });
        continue;
      }

      if (!transferInitiated) {
        const { error: releaseError } = await adminClient.rpc("release_workspace_payout_reservation", {
          p_business_id: payout.business_id,
          p_failure_reason: error instanceof Error ? error.message : "The scheduled payout failed before provider transfer creation.",
          p_payout_id: payout.id,
          p_updated_by: userId,
        });

        if (releaseError) {
          console.error("workspace-payout-execution due payout release failure", releaseError);
        }

        try {
          await notifyFinanceUsers({
            adminClient,
            body: `Bill payout ${payout.provider_reference || payout.id} failed before the provider transfer could be created.`,
            businessId: payout.business_id,
            link: "/wallet",
            title: "Scheduled payout failed",
            type: "payment",
          });
        } catch (notificationError) {
          console.error("workspace-payout-execution failure notification error", notificationError);
        }

        await recordPayoutAuditLog({
          action: "payout.failed",
          actorUserId: userId,
          adminClient,
          businessId: payout.business_id,
          detail: {
            failure_reason: error instanceof Error ? error.message : "The scheduled payout failed before provider transfer creation.",
            payout_id: payout.id,
          },
          entityId: payout.id,
          summary: `Scheduled payout failed before transfer creation`,
        });
      }

      results.push({
        payoutId: payout.id,
        status: "error",
        error: error instanceof Error ? error.message : "The scheduled payout failed.",
      });
    }
  }

  return json({
    processed: duePayouts.length,
    results,
    success: true,
  });
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for payout execution." }, 500);
  }

  const requestClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let payload: PayoutRequest;
  try {
    payload = (await request.json()) as PayoutRequest;
  } catch {
    return json({ error: "The payout request body is invalid." }, 400);
  }

  if (
    payload.action !== "self.request-payout" &&
    payload.action !== "self.release-payout" &&
    payload.action !== "self.schedule-payout" &&
    payload.action !== "self.cancel-scheduled-payout" &&
    payload.action !== "self.reschedule-scheduled-payout" &&
    payload.action !== "self.approve-payout" &&
    payload.action !== "self.process-due-payouts"
  ) {
    return json({ error: "Unsupported payout action." }, 400);
  }

  const cronSecret = Deno.env.get("WORKSPACE_PAYOUT_CRON_SECRET")?.trim() ?? "";

  if (payload.action === "self.process-due-payouts") {
    const providedSecret = request.headers.get("x-cron-secret")?.trim();
    if (!cronSecret || !providedSecret || providedSecret !== cronSecret) {
      return json({ error: "Unauthorized." }, 401);
    }

    return await handleProcessDuePayouts({
      adminClient,
      limit: Math.min(Math.max(Number((payload as Extract<PayoutRequest, { action: "self.process-due-payouts" }>).limit ?? 25), 1), 100),
      paystackSecretKey: getPaystackSecretKey(),
      userId: "00000000-0000-0000-0000-000000000000",
    });
  }

  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "You need an active session before requesting a payout." }, 401);
  }

  const businessId = payload.businessId?.trim();
  if (!businessId) {
    return json({ error: "A business workspace is required before payouts can be managed." }, 400);
  }

  const business = await loadManagedBusiness({
    adminClient,
    businessId,
    userId: user.id,
  });

  if (!business) {
    return json({ error: "Only workspace owners, admins, or accountants can manage payouts." }, 403);
  }

  if (
    payload.action !== "self.release-payout" &&
    payload.action !== "self.cancel-scheduled-payout" &&
    payload.action !== "self.reschedule-scheduled-payout"
  ) {
    await assertPayoutsNotFrozen({
      adminClient,
      businessId,
    });
  }

  try {
    if (payload.action === "self.request-payout") {
      const bill = await loadBill({ adminClient, billId: payload.billId.trim() });
      if (!bill || bill.total_amount <= 0) {
        return json({ error: "We could not find a bill ready for payout." }, 404);
      }

      return await handleRequestPayout({
        adminClient,
        bill,
        business,
        idempotencyKey: asNullableString(payload.idempotencyKey),
          paystackSecretKey: getPaystackSecretKey(),
          userId: user.id,
      });
    }

    if (payload.action === "self.schedule-payout") {
      const bill = await loadBill({ adminClient, billId: payload.billId.trim() });
      if (!bill || bill.total_amount <= 0) {
        return json({ error: "We could not find a bill ready for scheduling." }, 404);
      }

      const scheduledFor = asNullableString((payload as Extract<PayoutRequest, { action: "self.schedule-payout" }>).scheduledFor);
      if (!scheduledFor) {
        return json({ error: "A scheduled execution time is required." }, 400);
      }

  const scheduledDate = new Date(scheduledFor);
  if (Number.isNaN(scheduledDate.getTime())) {
    return json({ error: "A valid scheduled execution time is required." }, 400);
  }

  if (scheduledDate.getTime() <= Date.now()) {
    return json({ error: "Scheduled payout time must be in the future." }, 400);
  }

  return await handleSchedulePayout({
        adminClient,
        bill,
        business,
        idempotencyKey: asNullableString(payload.idempotencyKey),
        scheduledFor: scheduledDate.toISOString(),
        userId: user.id,
      });
    }

    if (payload.action === "self.cancel-scheduled-payout") {
      const payout = await loadPayout({ adminClient, payoutId: payload.payoutId.trim() });
      if (!payout) {
        return json({ error: "We could not find that payout request." }, 404);
      }

      return await handleCancelScheduledPayout({
        adminClient,
        payout,
        reason: asNullableString(payload.failureReason),
        userId: user.id,
      });
    }

    if (payload.action === "self.reschedule-scheduled-payout") {
      const payout = await loadPayout({ adminClient, payoutId: payload.payoutId.trim() });
      if (!payout) {
        return json({ error: "We could not find that payout request." }, 404);
      }

      const scheduledFor = asNullableString((payload as Extract<PayoutRequest, { action: "self.reschedule-scheduled-payout" }>).scheduledFor);
      if (!scheduledFor) {
        return json({ error: "A scheduled execution time is required." }, 400);
      }

      return await handleReschedulePayout({
        adminClient,
        payout,
        scheduledFor,
        userId: user.id,
      });
    }

    if (payload.action === "self.approve-payout") {
      const payout = await loadPayout({ adminClient, payoutId: payload.payoutId.trim() });
      if (!payout) {
        return json({ error: "We could not find that payout request." }, 404);
      }

      return await handleApprovePayout({
        adminClient,
        business,
        payout,
        paystackSecretKey: getPaystackSecretKey(),
        userId: user.id,
      });
    }

    const payout = await loadPayout({ adminClient, payoutId: payload.payoutId.trim() });
    if (!payout) {
      return json({ error: "We could not find that payout request." }, 404);
    }

    return await handleReleasePayout({
      adminClient,
      payout,
      reason: asNullableString(payload.failureReason),
      userId: user.id,
    });
  } catch (error) {
    console.error("workspace-payout-execution error", error);
    return json({
      error: error instanceof Error ? error.message : "The payout execution handler failed.",
    }, 500);
  }
});
