import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { deliverPaymentReceipt } from "./payment-receipts.ts";
import { resolveMarketplaceRoutingMetadata } from "./paystack-marketplace-routing.ts";

export type InvoiceRow = {
  amount_paid: number | string;
  balance_due: number | string;
  business_id: string;
  currency: string;
  customer_id: string;
  due_date: string | null;
  id: string;
  invoice_number: string;
  issue_date: string;
  notes: string | null;
  paid_at: string | null;
  payment_link_enabled: boolean;
  payment_link_last_shared_at: string | null;
  payment_public_token: string;
  status: string;
  total_amount: number | string;
};

type BusinessRow = {
  name: string;
};

type CustomerRow = {
  email: string | null;
  name: string | null;
};

export type ExistingPaymentRow = {
  amount: number | string;
  id: string;
  metadata: Record<string, unknown> | null;
  payment_reference: string;
  status: string;
};

export type InvoiceContext = {
  business: BusinessRow;
  customer: CustomerRow | null;
  invoice: InvoiceRow;
};

export const toDateOnly = (value?: string | null, fallback = new Date().toISOString().slice(0, 10)) =>
  value ? value.slice(0, 10) : fallback;

export const toNumber = (value: number | string | null | undefined) => Number(value ?? 0);
export const toKobo = (value: number | string) => Math.round(toNumber(value) * 100);

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

const fetchInvoiceContextByQuery = async (
  invoiceQuery: Promise<{ data: unknown }>,
  adminClient: ReturnType<typeof createClient>,
): Promise<InvoiceContext | null> => {
  const invoiceResponse = await invoiceQuery;
  const invoiceRecord = (invoiceResponse.data as InvoiceRow | null) ?? null;

  if (!invoiceRecord) {
    return null;
  }

  const [{ data: business }, { data: customer }] = await Promise.all([
    adminClient.from("businesses").select("name").eq("id", invoiceRecord.business_id).maybeSingle(),
    adminClient.from("customers").select("name, email").eq("id", invoiceRecord.customer_id).maybeSingle(),
  ]);

  const businessRecord = business as BusinessRow | null;
  if (!businessRecord?.name) {
    return null;
  }

  return {
    business: businessRecord,
    customer: (customer as CustomerRow | null) ?? null,
    invoice: invoiceRecord,
  };
};

export const fetchInvoiceContextByPaymentToken = async (
  adminClient: ReturnType<typeof createClient>,
  paymentToken: string,
): Promise<InvoiceContext | null> =>
  fetchInvoiceContextByQuery(
    adminClient
      .from("invoices")
      .select(
        "id, business_id, customer_id, invoice_number, issue_date, due_date, status, total_amount, amount_paid, balance_due, currency, notes, paid_at, payment_public_token, payment_link_enabled, payment_link_last_shared_at",
      )
      .eq("payment_public_token", paymentToken)
      .maybeSingle(),
    adminClient,
  );

export const fetchInvoiceContextByInvoiceId = async (
  adminClient: ReturnType<typeof createClient>,
  invoiceId: string,
): Promise<InvoiceContext | null> =>
  fetchInvoiceContextByQuery(
    adminClient
      .from("invoices")
      .select(
        "id, business_id, customer_id, invoice_number, issue_date, due_date, status, total_amount, amount_paid, balance_due, currency, notes, paid_at, payment_public_token, payment_link_enabled, payment_link_last_shared_at",
      )
      .eq("id", invoiceId)
      .maybeSingle(),
    adminClient,
  );

export const fetchLinkedPayment = async (
  adminClient: ReturnType<typeof createClient>,
  businessId: string,
  invoiceId: string,
) => {
  const { data } = await adminClient
    .from("payments")
    .select("id, payment_reference, status, amount, metadata")
    .eq("business_id", businessId)
    .eq("invoice_id", invoiceId)
    .maybeSingle();

  return (data as ExistingPaymentRow | null) ?? null;
};

const completePaymentRecord = async ({
  adminClient,
  customerName,
  invoice,
  paidAt,
  paystackPayload,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  customerName: string;
  invoice: InvoiceRow;
  paidAt: string;
  paystackPayload: Record<string, unknown>;
  reference: string;
}) => {
  const existingPayment = await fetchLinkedPayment(adminClient, invoice.business_id, invoice.id);
  const paystackCustomer =
    paystackPayload.customer && typeof paystackPayload.customer === "object"
      ? (paystackPayload.customer as Record<string, unknown>)
      : {};
  const existingMetadata =
    existingPayment?.metadata && typeof existingPayment.metadata === "object"
      ? (existingPayment.metadata as Record<string, unknown>)
      : {};
  const marketplaceRoutingMetadata = resolveMarketplaceRoutingMetadata({
    existingMetadata,
    paidAt,
    paystackPayload,
    reference,
  });
  const paymentValues = {
    amount: toNumber(invoice.total_amount),
    counterparty_name: customerName,
    currency: invoice.currency,
    gateway: "paystack",
    gateway_response: `Paystack payment verified. Reference: ${reference}.`,
    metadata: {
      ...existingMetadata,
      document_number: invoice.invoice_number,
      marketplace_routing: marketplaceRoutingMetadata,
      paystack_amount_kobo: paystackPayload.amount ?? null,
      paystack_customer_email: typeof paystackCustomer.email === "string" ? paystackCustomer.email.trim().toLowerCase() : null,
      paystack_paid_at: paystackPayload.paid_at ?? paidAt,
      paystack_reference: reference,
      payment_public_token: invoice.payment_public_token,
      provider_status: paystackPayload.status ?? "success",
      source: "paystack_public_link",
      verified: true,
    },
    paid_on: toDateOnly(paidAt),
    payment_reference: reference,
    status: "completed",
  };

  if (existingPayment?.id) {
    const { error } = await adminClient.from("payments").update(paymentValues).eq("id", existingPayment.id);

    if (error) {
      throw new Error(error.message);
    }

    return existingPayment.id;
  }

  const { data, error } = await adminClient
    .from("payments")
    .insert({
      ...paymentValues,
      bill_id: null,
      business_id: invoice.business_id,
      created_by: null,
      invoice_id: invoice.id,
      payment_type: "receivable",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
};

const notifyFinanceUsers = async ({
  adminClient,
  amountLabel,
  businessId,
  invoiceNumber,
}: {
  adminClient: ReturnType<typeof createClient>;
  amountLabel: string;
  businessId: string;
  invoiceNumber: string;
}) => {
  const { data: recipients } = await adminClient
    .from("business_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "accountant"]);

  const recipientRows = recipients ?? [];
  if (recipientRows.length === 0) {
    return;
  }

  await adminClient.from("notifications").insert(
    recipientRows.map((recipient) => ({
      body: `${invoiceNumber} was paid via Paystack for ${amountLabel}.`,
      business_id: businessId,
      link: "/payments",
      recipient_user_id: recipient.user_id,
      title: "Invoice payment received",
      type: "payment",
    })),
  );
};

export const verifyPaystackTransaction = async (reference: string, paystackSecretKey: string) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as {
      data?: Record<string, unknown>;
      message?: string;
      status?: boolean;
    };

    if (!response.ok || payload.status === false) {
      throw new Error(payload.message || "The payment provider could not verify this transaction.");
    }

    return payload.data ?? {};
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Paystack verification is taking too long. Please try again in a moment.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const validateVerifiedPaystackPayment = ({
  invoice,
  paystackVerification,
  paymentToken,
  reference,
}: {
  invoice: InvoiceRow;
  paystackVerification: Record<string, unknown>;
  paymentToken?: string;
  reference: string;
}) => {
  const providerStatus = typeof paystackVerification.status === "string" ? paystackVerification.status : "";
  const providerReference =
    typeof paystackVerification.reference === "string" ? paystackVerification.reference.trim() : reference;
  const providerAmount =
    typeof paystackVerification.amount === "number" || typeof paystackVerification.amount === "string"
      ? Number(paystackVerification.amount)
      : NaN;
  const providerCurrency =
    typeof paystackVerification.currency === "string" ? paystackVerification.currency.trim().toUpperCase() : "";
  const providerMetadata =
    paystackVerification.metadata && typeof paystackVerification.metadata === "object"
      ? (paystackVerification.metadata as Record<string, unknown>)
      : {};

  if (providerStatus !== "success") {
    throw new Error("This Paystack transaction is not complete yet.");
  }

  if (providerReference !== reference) {
    throw new Error("The payment provider returned an unexpected transaction reference.");
  }

  if (providerCurrency && providerCurrency !== invoice.currency.toUpperCase()) {
    throw new Error("The payment currency does not match this invoice.");
  }

  if (providerAmount !== toKobo(invoice.balance_due)) {
    throw new Error("The payment amount does not match the invoice balance.");
  }

  if (
    paymentToken &&
    typeof providerMetadata.payment_public_token === "string" &&
    providerMetadata.payment_public_token.trim().toLowerCase() !== paymentToken
  ) {
    throw new Error("The payment metadata does not match this invoice link.");
  }

  const paidAt =
    typeof paystackVerification.paid_at === "string" && paystackVerification.paid_at.trim()
      ? paystackVerification.paid_at
      : new Date().toISOString();

  return {
    paidAt,
    providerMetadata,
    providerReference,
  };
};

export const settleInvoicePaystackPayment = async ({
  adminClient,
  context,
  paidAt,
  paystackPayload,
  reference,
}: {
  adminClient: ReturnType<typeof createClient>;
  context: InvoiceContext;
  paidAt: string;
  paystackPayload: Record<string, unknown>;
  reference: string;
}) => {
  const customerName = context.customer?.name?.trim() || "Customer";
  const completedPaymentId = await completePaymentRecord({
    adminClient,
    customerName,
    invoice: context.invoice,
    paidAt,
    paystackPayload,
    reference,
  });

  const { error: invoiceUpdateError } = await adminClient
    .from("invoices")
    .update({
      amount_paid: toNumber(context.invoice.total_amount),
      delivery_last_error: null,
      paid_at: paidAt,
      status: "paid",
      updated_by: null,
    })
    .eq("id", context.invoice.id);

  if (invoiceUpdateError) {
    throw new Error(invoiceUpdateError.message);
  }

  await adminClient.from("audit_logs").insert({
    action: "invoice.payment_received",
    actor_user_id: null,
    business_id: context.invoice.business_id,
    detail: {
      amount: toNumber(context.invoice.total_amount),
      currency: context.invoice.currency,
      description: `${context.invoice.invoice_number} paid via Paystack.`,
      document_number: context.invoice.invoice_number,
      payment_reference: reference,
      provider: "paystack",
    },
    entity_id: context.invoice.id,
    entity_type: "invoice",
    summary: `Invoice ${context.invoice.invoice_number} paid via Paystack`,
  });

  await notifyFinanceUsers({
    adminClient,
    amountLabel: `${context.invoice.currency} ${toNumber(context.invoice.total_amount).toFixed(2)}`,
    businessId: context.invoice.business_id,
    invoiceNumber: context.invoice.invoice_number,
  });

  try {
    await deliverPaymentReceipt({
      adminClient,
      fallbackRecipientEmail: context.customer?.email?.trim().toLowerCase() ?? null,
      paymentId: completedPaymentId,
      paystackPayload,
    });
  } catch (receiptError) {
    console.error("Unable to deliver payment receipt", receiptError);
  }

  return {
    paidAt,
    paymentId: completedPaymentId,
  };
};
