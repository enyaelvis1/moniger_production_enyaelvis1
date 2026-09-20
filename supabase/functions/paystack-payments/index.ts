import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { deliverPaymentReceipt } from "../_shared/payment-receipts.ts";
import {
  buildMarketplaceInitializationPayload,
  resolveMarketplaceRoutingConfig,
  type MarketplaceRoutingConfig,
  type PayoutRoutingAccountRow,
  type PayoutRoutingSplitConfigRow,
} from "../_shared/paystack-marketplace-routing.ts";
import {
  fetchInvoiceContextByPaymentToken,
  fetchLinkedPayment,
  type InvoiceRow,
  settleInvoicePaystackPayment,
  toDateOnly,
  toKobo,
  toNumber,
  validateVerifiedPaystackPayment,
  verifyPaystackTransaction,
} from "../_shared/paystack.ts";

type PaymentAction = "initialize-payment" | "invoice-details" | "verify-payment";

type PaymentRequest =
  | {
      action: "invoice-details";
      paymentToken: string;
    }
  | {
      action: "initialize-payment";
      payerEmail: string;
      payerName?: string | null;
      paymentToken: string;
    }
  | {
      action: "verify-payment";
      paymentToken: string;
      reference: string;
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

const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isValidPaymentToken = (value: string) => /^[a-f0-9]{48}$/i.test(value);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const asString = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const createPaymentReference = (invoiceNumber: string) => {
  const cleanedInvoiceNumber = invoiceNumber.replace(/[^a-z0-9]/gi, "").slice(-10).toUpperCase() || "INVOICE";
  const suffix =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();

  return `PSK-${cleanedInvoiceNumber}-${suffix}`;
};

const getAppBaseUrl = (request: Request) => {
  const configuredUrl = Deno.env.get("APP_BASE_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const requestOrigin = request.headers.get("origin")?.trim();
  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }

  return "https://moniger.net";
};

const getInvoiceAccessError = (invoice: InvoiceRow) => {
  if (!invoice.payment_link_enabled) {
    return "This payment link is not active yet.";
  }

  if (!invoice.payment_public_token) {
    return "This invoice does not have a payment token yet.";
  }

  return null;
};

const getInvoiceCheckoutError = (invoice: InvoiceRow) => {
  if (invoice.status === "paid") {
    return "This invoice has already been paid.";
  }

  if (invoice.status === "cancelled") {
    return "Cancelled invoices cannot be paid online.";
  }

  if (invoice.status === "draft") {
    return "This invoice is not ready for online payment yet.";
  }

  if (toNumber(invoice.amount_paid) > 0 && toNumber(invoice.balance_due) > 0) {
    return "This invoice already has recorded payment activity and cannot be settled online yet.";
  }

  if (toNumber(invoice.balance_due) <= 0) {
    return "This invoice has no remaining balance.";
  }

  return null;
};

const loadMarketplaceRoutingConfig = async ({
  adminClient,
  amountKobo,
  businessId,
  currency,
}: {
  adminClient: ReturnType<typeof createClient>;
  amountKobo: number;
  businessId: string;
  currency: string;
}): Promise<MarketplaceRoutingConfig> => {
  const [payoutAccountResponse, splitConfigResponse] = await Promise.all([
    adminClient
      .from("business_payout_accounts")
      .select("id, status, provider_subaccount_code, provider_metadata")
      .eq("business_id", businessId)
      .maybeSingle<PayoutRoutingAccountRow>(),
    adminClient
      .from("business_payment_split_configs")
      .select("id, status, split_mode, moniger_fee_flat_amount, provider_split_code, provider_metadata")
      .eq("business_id", businessId)
      .eq("currency", currency)
      .maybeSingle<PayoutRoutingSplitConfigRow>(),
  ]);

  if (payoutAccountResponse.error) {
    throw payoutAccountResponse.error;
  }

  if (splitConfigResponse.error) {
    throw splitConfigResponse.error;
  }

  return resolveMarketplaceRoutingConfig({
    amountKobo,
    payoutAccount: payoutAccountResponse.data,
    splitConfig: splitConfigResponse.data,
    toKobo,
  });
};

const upsertPendingPaymentRecord = async ({
  adminClient,
  customerName,
  invoice,
  marketplaceRouting,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  customerName: string;
  invoice: InvoiceRow;
  marketplaceRouting: MarketplaceRoutingConfig;
  reference: string;
}) => {
  const { data: existingPayment } = await adminClient
    .from("payments")
    .select("id")
    .eq("business_id", invoice.business_id)
    .eq("invoice_id", invoice.id)
    .maybeSingle();

  const paymentValues = {
    amount: toNumber(invoice.total_amount),
    bill_id: null,
    business_id: invoice.business_id,
    counterparty_name: customerName,
    created_by: null,
    currency: invoice.currency,
    gateway: "paystack",
    gateway_response: "Paystack checkout initialized.",
    invoice_id: invoice.id,
    metadata: {
      document_number: invoice.invoice_number,
      marketplace_routing:
        marketplaceRouting.status === "ready"
          ? {
            mode: marketplaceRouting.mode,
            payout_account_id: marketplaceRouting.payoutAccountId,
            provider_split_code: marketplaceRouting.providerSplitCode,
            provider_subaccount_code: marketplaceRouting.providerSubaccountCode,
            split_config_id: marketplaceRouting.splitConfigId,
            transaction_charge_kobo: marketplaceRouting.transactionChargeKobo,
          }
          : null,
      paystack_reference: reference,
      payment_public_token: invoice.payment_public_token,
      source: "paystack_public_link",
      synced_status: invoice.status,
    },
    paid_on: toDateOnly(invoice.due_date, invoice.issue_date),
    payment_reference: reference,
    payment_type: "receivable",
    status: "pending",
  };

  if (existingPayment?.id) {
    const { error } = await adminClient
      .from("payments")
      .update({
        amount: paymentValues.amount,
        counterparty_name: paymentValues.counterparty_name,
        currency: paymentValues.currency,
        gateway: paymentValues.gateway,
        gateway_response: paymentValues.gateway_response,
        metadata: paymentValues.metadata,
        paid_on: paymentValues.paid_on,
        payment_reference: paymentValues.payment_reference,
        status: paymentValues.status,
      })
      .eq("id", existingPayment.id);

    if (error) {
      throw new Error(error.message);
    }

    return existingPayment.id;
  }

  const { data, error } = await adminClient.from("payments").insert(paymentValues).select("id").single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
};

const sendPaystackRequest = async <TPayload>(path: string, payload: Record<string, unknown>, paystackSecretKey: string) => {
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY")?.trim() ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for online payments." }, 500);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let payload: PaymentRequest;
  try {
    payload = (await request.json()) as PaymentRequest;
  } catch {
    return json({ error: "The payment request body is invalid." }, 400);
  }

  if (!payload.action) {
    return json({ error: "Missing payment action." }, 400);
  }

  const paymentToken = payload.paymentToken?.trim().toLowerCase() ?? "";
  if (!isValidPaymentToken(paymentToken)) {
    return json({ error: "This payment link is invalid." }, 400);
  }

  const context = await fetchInvoiceContextByPaymentToken(adminClient, paymentToken);
  if (!context) {
    return json({ error: "We could not find that invoice payment link." }, 404);
  }

  const accessError = getInvoiceAccessError(context.invoice);
  if (accessError) {
    return json({ error: accessError }, 403);
  }

  if (payload.action === "invoice-details") {
    return json({
      invoice: {
        amountPaid: toNumber(context.invoice.amount_paid),
        balanceDue: toNumber(context.invoice.balance_due),
        businessName: context.business.name,
        currency: context.invoice.currency,
        customerEmail: context.customer?.email?.trim().toLowerCase() ?? null,
        customerName: context.customer?.name?.trim() || "Customer",
        dueDate: context.invoice.due_date,
        invoiceId: context.invoice.id,
        invoiceNumber: context.invoice.invoice_number,
        issueDate: context.invoice.issue_date,
        notes: context.invoice.notes,
        paymentLinkEnabled: context.invoice.payment_link_enabled,
        paymentToken: context.invoice.payment_public_token,
        status: context.invoice.status,
        totalAmount: toNumber(context.invoice.total_amount),
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

  const checkoutError = getInvoiceCheckoutError(context.invoice);
  if (checkoutError) {
    return json({ error: checkoutError }, 400);
  }

  const customerName = context.customer?.name?.trim() || "Customer";

  if (payload.action === "initialize-payment") {
    const payerEmail = normalizeEmail(payload.payerEmail);
    const payerName = payload.payerName?.trim() || customerName;

    if (!isValidEmailAddress(payerEmail)) {
      return json({ error: "Enter a valid email address before continuing to Paystack." }, 400);
    }

    const reference = createPaymentReference(context.invoice.invoice_number);
    const callbackUrl = `${getAppBaseUrl(request)}/pay/${encodeURIComponent(paymentToken)}/confirmed`;
    const amountKobo = toKobo(context.invoice.balance_due);
    let marketplaceRouting: MarketplaceRoutingConfig;

    try {
      marketplaceRouting = await loadMarketplaceRoutingConfig({
        adminClient,
        amountKobo,
        businessId: context.invoice.business_id,
        currency: context.invoice.currency,
      });
    } catch (routingError) {
      console.error("Unable to resolve marketplace routing for payment initialization", routingError);
      return json({ error: "This workspace payment routing is not configured correctly yet." }, 500);
    }

    const routingPayload = buildMarketplaceInitializationPayload(marketplaceRouting);
    const initializationPayload = await sendPaystackRequest<{
      data?: { authorization_url?: string; reference?: string };
    }>(
      "/transaction/initialize",
      {
        amount: amountKobo,
        callback_url: callbackUrl,
        currency: context.invoice.currency,
        email: payerEmail,
        metadata: {
          business_id: context.invoice.business_id,
          customer_name: customerName,
          invoice_id: context.invoice.id,
          invoice_number: context.invoice.invoice_number,
          marketplace_routing:
            marketplaceRouting.status === "ready"
              ? {
                enabled: true,
                mode: marketplaceRouting.mode,
                payout_account_id: marketplaceRouting.payoutAccountId,
                provider_split_code: marketplaceRouting.providerSplitCode,
                provider_subaccount_code: marketplaceRouting.providerSubaccountCode,
                split_config_id: marketplaceRouting.splitConfigId,
                transaction_charge_kobo: marketplaceRouting.transactionChargeKobo,
              }
              : {
                enabled: false,
              },
          payer_name: payerName,
          payment_public_token: paymentToken,
        },
        reference,
        ...routingPayload,
      },
      paystackSecretKey,
    );

    const authorizationUrl = initializationPayload.data?.authorization_url?.trim();
    const resolvedReference = initializationPayload.data?.reference?.trim() || reference;

    if (!authorizationUrl) {
      return json({ error: "The payment provider did not return a checkout URL." }, 500);
    }

    await upsertPendingPaymentRecord({
      adminClient,
      customerName,
      invoice: context.invoice,
      marketplaceRouting,
      reference: resolvedReference,
    });

    return json({
      authorizationUrl,
      reference: resolvedReference,
    });
  }

  const reference = payload.reference?.trim();
  if (!reference) {
    return json({ error: "Missing Paystack payment reference." }, 400);
  }

  const existingPayment = await fetchLinkedPayment(adminClient, context.invoice.business_id, context.invoice.id);
  if (context.invoice.status === "paid") {
    if (existingPayment?.payment_reference === reference && existingPayment.status === "completed") {
      try {
        await deliverPaymentReceipt({
          adminClient,
          fallbackRecipientEmail: context.customer?.email?.trim().toLowerCase() ?? null,
          paymentId: existingPayment.id,
        });
      } catch (receiptError) {
        console.error("Unable to deliver payment receipt", receiptError);
      }

      return json({
        alreadyProcessed: true,
        invoice: {
          amountPaid: toNumber(context.invoice.total_amount),
          balanceDue: 0,
          currency: context.invoice.currency,
          invoiceId: context.invoice.id,
          invoiceNumber: context.invoice.invoice_number,
          paidAt: context.invoice.paid_at,
          status: "paid",
          totalAmount: toNumber(context.invoice.total_amount),
        },
        payment: {
          amount: toNumber(existingPayment.amount),
          paidAt: context.invoice.paid_at,
          provider: "paystack",
          reference,
          status: "completed",
        },
      });
    }

    return json({ error: "This invoice has already been settled." }, 400);
  }

  const paystackVerification = await verifyPaystackTransaction(reference, paystackSecretKey);
  try {
    validateVerifiedPaystackPayment({
      invoice: context.invoice,
      paystackVerification,
      paymentToken,
      reference,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "The payment verification failed." }, 400);
  }

  const settlement = await settleInvoicePaystackPayment({
    adminClient,
    context,
    paidAt:
      typeof paystackVerification.paid_at === "string" && paystackVerification.paid_at.trim()
        ? paystackVerification.paid_at
        : new Date().toISOString(),
    paystackPayload: paystackVerification,
    reference,
  });

  return json({
    alreadyProcessed: false,
    invoice: {
      amountPaid: toNumber(context.invoice.total_amount),
      balanceDue: 0,
      currency: context.invoice.currency,
      invoiceId: context.invoice.id,
      invoiceNumber: context.invoice.invoice_number,
      paidAt: settlement.paidAt,
      status: "paid",
      totalAmount: toNumber(context.invoice.total_amount),
    },
    payment: {
      amount: toNumber(context.invoice.total_amount),
      paidAt: settlement.paidAt,
      provider: "paystack",
      reference,
      status: "completed",
    },
    paymentId: settlement.paymentId,
  });
});
