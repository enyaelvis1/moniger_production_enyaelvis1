import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { logAuditEventSafe } from "@/lib/audit";
import { createNotificationSafe } from "@/lib/notifications";
import { financeQueryOptions, liveFinanceQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

type InvoiceRow = Pick<
  Tables<"invoices">,
  | "amount_paid"
  | "balance_due"
  | "currency"
  | "customer_id"
  | "delivery_attempt_count"
  | "delivery_email"
  | "delivery_last_attempt_at"
  | "delivery_last_error"
  | "delivery_message"
  | "delivery_method"
  | "delivery_status"
  | "delivery_subject"
  | "due_date"
  | "id"
  | "invoice_number"
  | "issue_date"
  | "notes"
  | "paid_at"
  | "payment_link_enabled"
  | "payment_link_last_shared_at"
  | "payment_public_token"
  | "sent_at"
  | "status"
  | "subtotal"
  | "tax_total"
  | "total_amount"
>;
type InvoiceItemRow = Pick<Tables<"invoice_items">, "description" | "id" | "invoice_id" | "line_number" | "quantity" | "unit_price">;
type CustomerNameRow = Pick<Tables<"customers">, "id" | "name">;
type BillRow = Pick<
  Tables<"bills">,
  | "amount_paid"
  | "bill_date"
  | "bill_number"
  | "category"
  | "currency"
  | "due_date"
  | "id"
  | "notes"
  | "scheduled_payment_date"
  | "status"
  | "total_amount"
  | "vendor_id"
>;
type VendorNameRow = Pick<Tables<"vendors">, "business_name" | "id">;
type PaymentRow = Pick<
  Tables<"payments">,
  | "amount"
  | "bill_id"
  | "counterparty_name"
  | "currency"
  | "gateway"
  | "gateway_response"
  | "id"
  | "invoice_id"
  | "metadata"
  | "paid_on"
  | "payment_reference"
  | "payment_type"
  | "status"
>;
type ExistingPaymentRow = Pick<Tables<"payments">, "id" | "payment_reference" | "status">;
type InvoiceReferenceRow = Pick<Tables<"invoices">, "customer_id" | "id" | "invoice_number">;
type BillReferenceRow = Pick<Tables<"bills">, "bill_number" | "id" | "vendor_id">;

export type FinanceLineItem = {
  description: string;
  id?: string;
  qty: number;
  unitPrice: number;
};

export type InvoiceDeliveryMethod = "backend_email" | "mail_app";
export type InvoiceDeliveryStatus = "failed" | "not_sent" | "prepared" | "sent";

export type InvoiceDeliveryInput = {
  email: string;
  message?: string | null;
  method?: InvoiceDeliveryMethod;
  subject: string;
};

export type InvoiceRecord = {
  amount: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  customerId: string;
  customerName: string;
  deliveryAttemptCount: number;
  deliveryEmail: string;
  deliveryLastAttemptAt: string | null;
  deliveryLastError: string | null;
  deliveryMessage: string;
  deliveryMethod: InvoiceDeliveryMethod;
  deliveryStatus: InvoiceDeliveryStatus;
  deliverySubject: string;
  dueDate: string | null;
  id: string;
  invoiceNumber: string;
  issueDate: string;
  lineItems: FinanceLineItem[];
  notes: string;
  paidAt: string | null;
  paymentLinkEnabled: boolean;
  paymentLinkLastSharedAt: string | null;
  paymentPublicToken: string | null;
  sentAt: string | null;
  status: Enums<"invoice_status">;
  taxPercent: number;
};

export type BillRecord = {
  amount: number;
  amountPaid: number;
  billDate: string;
  billNumber: string;
  category: string;
  currency: string;
  dueDate: string | null;
  id: string;
  notes: string;
  scheduledPaymentDate: string | null;
  status: Enums<"bill_status">;
  vendorId: string;
  vendorName: string;
};

export type PaymentRecord = {
  amount: number;
  billId: string | null;
  currency: string;
  date: string;
  gateway: Enums<"payment_gateway">;
  gatewayResponse: string;
  id: string;
  invoiceId: string | null;
  linkedRef: string;
  metadata: Tables<"payments">["Row"]["metadata"];
  party: string;
  reference: string;
  status: Enums<"payment_status">;
  type: Enums<"payment_type">;
};

export type InvoiceInput = {
  customer_id: string;
  delivery_email?: string | null;
  delivery_message?: string | null;
  delivery_subject?: string | null;
  due_date?: string | null;
  invoice_number: string;
  issue_date: string;
  line_items: FinanceLineItem[];
  notes?: string | null;
  record_delivery_attempt?: boolean;
  status: Enums<"invoice_status">;
  tax_percent: number;
};

export type BillInput = {
  amount: number;
  bill_date: string;
  bill_number: string;
  category?: string | null;
  due_date?: string | null;
  notes?: string | null;
  scheduled_payment_date?: string | null;
  status: Enums<"bill_status">;
  vendor_id: string;
};

const invoicesQueryKey = (businessId: string) => ["invoices", businessId] as const;
const billsQueryKey = (businessId: string) => ["bills", businessId] as const;
const paymentsQueryKey = (businessId: string) => ["payments", businessId] as const;
const categoriesQueryKey = () => ["bill-categories"] as const;

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const todayDate = () => new Date().toISOString().slice(0, 10);
const toDateOnly = (value: string | null | undefined, fallback = todayDate()) => (value ? value.slice(0, 10) : fallback);
const formatAuditMoney = (amount: number, currency = "NGN") => {
  try {
    return new Intl.NumberFormat("en-NG", {
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const normalizeSingleLineText = (value?: string | null) => {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
};

const normalizeMultilineText = (value?: string | null) => {
  const normalized = value?.replace(/\r\n/g, "\n").trim() ?? "";
  return normalized || null;
};

const normalizeEmailText = (value?: string | null) => normalizeSingleLineText(value)?.toLowerCase() ?? null;

const isInvoiceDeliveryStatus = (value: string | null | undefined): value is InvoiceDeliveryStatus =>
  value === "not_sent" || value === "prepared" || value === "failed" || value === "sent";

const isSentLikeInvoiceStatus = (status: Enums<"invoice_status">) =>
  status === "sent" || status === "overdue" || status === "paid";

const buildInvoiceDeliveryState = ({
  currentInvoice,
  method,
  nextStatus,
  recordDeliveryAttempt,
  sentAt,
  values,
}: {
  currentInvoice?: InvoiceRecord | null;
  method?: InvoiceDeliveryMethod;
  nextStatus: Enums<"invoice_status">;
  recordDeliveryAttempt: boolean;
  sentAt: string | null;
  values: Pick<InvoiceInput, "delivery_email" | "delivery_message" | "delivery_subject">;
}) => {
  if (nextStatus === "draft") {
    return {
      deliveryAttemptCount: 0,
      deliveryEmail: null,
      deliveryLastAttemptAt: null,
      deliveryLastError: null,
      deliveryMessage: null,
      deliveryMethod: "mail_app" as InvoiceDeliveryMethod,
      deliveryStatus: "not_sent" as InvoiceDeliveryStatus,
      deliverySubject: null,
    };
  }

  const hasHistoricalDelivery = Boolean(
    currentInvoice?.sentAt || currentInvoice?.deliveryLastAttemptAt || currentInvoice?.deliveryAttemptCount,
  );
  const shouldDefaultPrepared = isSentLikeInvoiceStatus(nextStatus) && (Boolean(sentAt) || hasHistoricalDelivery);
  const deliveryMethod = method ?? currentInvoice?.deliveryMethod ?? "mail_app";
  const completedDeliveryStatus = deliveryMethod === "backend_email" ? "sent" : "prepared";

  return {
    deliveryAttemptCount: recordDeliveryAttempt
      ? (currentInvoice?.deliveryAttemptCount ?? 0) + 1
      : currentInvoice?.deliveryAttemptCount ?? (shouldDefaultPrepared ? 1 : 0),
    deliveryEmail:
      values.delivery_email !== undefined
        ? normalizeEmailText(values.delivery_email)
        : currentInvoice?.deliveryEmail || null,
    deliveryLastAttemptAt: recordDeliveryAttempt
      ? sentAt
      : currentInvoice?.deliveryLastAttemptAt ?? (shouldDefaultPrepared ? sentAt : null),
    deliveryLastError: recordDeliveryAttempt ? null : currentInvoice?.deliveryLastError ?? null,
    deliveryMessage:
      values.delivery_message !== undefined
        ? normalizeMultilineText(values.delivery_message)
        : currentInvoice?.deliveryMessage || null,
    deliveryMethod,
    deliveryStatus: recordDeliveryAttempt
      ? completedDeliveryStatus
      : currentInvoice?.deliveryStatus ?? (shouldDefaultPrepared ? completedDeliveryStatus : "not_sent"),
    deliverySubject:
      values.delivery_subject !== undefined
        ? normalizeSingleLineText(values.delivery_subject)
        : currentInvoice?.deliverySubject || null,
  };
};

const recordInvoiceDeliveryActivity = async ({
  amount,
  businessId,
  currency,
  customerName,
  deliveryEmail,
  deliveryMethod,
  invoiceId,
  invoiceNumber,
  isResend,
  userId,
}: {
  amount: number;
  businessId: string;
  currency: string;
  customerName: string;
  deliveryEmail: string | null;
  deliveryMethod: InvoiceDeliveryMethod;
  invoiceId: string;
  invoiceNumber: string;
  isResend: boolean;
  userId: string;
}) => {
  const deliveryTarget = deliveryEmail ?? customerName;
  const isBackendEmail = deliveryMethod === "backend_email";
  const auditAction = isBackendEmail
    ? isResend
      ? "invoice.delivery_sent_again"
      : "invoice.delivery_sent"
    : isResend
      ? "invoice.delivery_prepared_again"
      : "invoice.delivery_prepared";
  const deliveryState = isBackendEmail ? "sent" : "prepared";
  const summary = isBackendEmail
    ? isResend
      ? `Invoice ${invoiceNumber} emailed again`
      : `Invoice ${invoiceNumber} emailed`
    : isResend
      ? `Invoice ${invoiceNumber} prepared to resend`
      : `Invoice ${invoiceNumber} prepared for delivery`;
  const notificationTitle = isBackendEmail
    ? isResend
      ? "Invoice emailed again"
      : "Invoice emailed"
    : isResend
      ? "Invoice ready to resend"
      : "Invoice ready to send";
  const notificationBody = isBackendEmail
    ? `${invoiceNumber} was emailed to ${deliveryTarget}.`
    : `${invoiceNumber} was prepared in your mail app for ${deliveryTarget}.`;

  await logAuditEventSafe({
    action: auditAction,
    actorUserId: userId,
    businessId,
    detail: {
      amount,
      currency,
      customer_name: customerName,
      delivery_email: deliveryEmail,
      description: `${customerName} • ${formatAuditMoney(amount, currency)} • ${deliveryTarget}`,
      document_number: invoiceNumber,
      status: deliveryState,
    },
    entityId: invoiceId,
    entityType: "invoice",
    summary,
  });

  await createNotificationSafe({
    body: notificationBody,
    businessId,
    link: "/invoices",
    preferenceKey: "invoice_sent",
    title: notificationTitle,
    type: "invoice",
    userId,
  });
};

const readMetadataString = (metadata: Tables<"payments">["Row"]["metadata"], key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const value = metadata[key];
  return typeof value === "string" ? value : "";
};

const createPaymentReference = () => {
  const dateStamp = todayDate().replace(/-/g, "");
  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();

  return `PAY-${dateStamp}-${token}`;
};

const calculateInvoiceTotals = (lineItems: FinanceLineItem[], taxPercent: number) => {
  const sanitizedItems = lineItems.map((item, index) => ({
    description: item.description.trim(),
    lineNumber: index + 1,
    qty: Math.max(0, Number(item.qty) || 0),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
  }));
  const subtotal = roundCurrency(sanitizedItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0));
  const sanitizedTaxPercent = Math.max(0, Number(taxPercent) || 0);
  const taxTotal = roundCurrency(subtotal * (sanitizedTaxPercent / 100));
  const totalAmount = roundCurrency(subtotal + taxTotal);

  return {
    items: sanitizedItems,
    subtotal,
    taxPercent: sanitizedTaxPercent,
    taxTotal,
    totalAmount,
  };
};

const formatTaxPercentFromRow = (subtotal: number, taxTotal: number) => {
  if (!subtotal || !taxTotal) {
    return 0;
  }

  return roundCurrency((taxTotal / subtotal) * 100);
};

const fetchInvoices = async (businessId: string): Promise<InvoiceRecord[]> => {
  const [{ data: invoiceRows, error: invoiceError }, { data: invoiceItemRows, error: invoiceItemError }, { data: customerRows, error: customerError }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, customer_id, invoice_number, issue_date, due_date, status, subtotal, tax_total, total_amount, amount_paid, balance_due, currency, notes, sent_at, paid_at, delivery_email, delivery_subject, delivery_message, delivery_method, delivery_status, delivery_last_attempt_at, delivery_last_error, delivery_attempt_count, payment_public_token, payment_link_enabled, payment_link_last_shared_at",
        )
        .eq("business_id", businessId)
        .order("issue_date", { ascending: false }),
      supabase
        .from("invoice_items")
        .select("id, invoice_id, line_number, description, quantity, unit_price")
        .order("invoice_id", { ascending: true })
        .order("line_number", { ascending: true }),
      supabase.from("customers").select("id, name").eq("business_id", businessId),
    ]);

  if (invoiceError) {
    throw invoiceError;
  }

  if (invoiceItemError) {
    throw invoiceItemError;
  }

  if (customerError) {
    throw customerError;
  }

  const customerNameById = new Map(((customerRows ?? []) as CustomerNameRow[]).map((customer) => [customer.id, customer.name]));
  const itemsByInvoiceId = new Map<string, FinanceLineItem[]>();

  for (const item of (invoiceItemRows ?? []) as InvoiceItemRow[]) {
    const currentItems = itemsByInvoiceId.get(item.invoice_id) ?? [];
    currentItems.push({
      description: item.description,
      id: item.id,
      qty: Number(item.quantity),
      unitPrice: Number(item.unit_price),
    });
    itemsByInvoiceId.set(item.invoice_id, currentItems);
  }

  return ((invoiceRows ?? []) as InvoiceRow[]).map((invoice) => ({
    amount: Number(invoice.total_amount),
    amountPaid: Number(invoice.amount_paid),
    balanceDue: Number(invoice.balance_due),
    currency: invoice.currency,
    customerId: invoice.customer_id,
    customerName: customerNameById.get(invoice.customer_id) ?? "Unknown Customer",
    deliveryAttemptCount: invoice.delivery_attempt_count ?? 0,
    deliveryEmail: invoice.delivery_email ?? "",
    deliveryLastAttemptAt: invoice.delivery_last_attempt_at,
    deliveryLastError: invoice.delivery_last_error,
    deliveryMessage: invoice.delivery_message ?? "",
    deliveryMethod: invoice.delivery_method === "backend_email" ? "backend_email" : "mail_app",
    deliveryStatus: isInvoiceDeliveryStatus(invoice.delivery_status) ? invoice.delivery_status : "not_sent",
    deliverySubject: invoice.delivery_subject ?? "",
    dueDate: invoice.due_date,
    id: invoice.id,
    invoiceNumber: invoice.invoice_number,
    issueDate: invoice.issue_date,
    lineItems: itemsByInvoiceId.get(invoice.id) ?? [],
    notes: invoice.notes ?? "",
    paidAt: invoice.paid_at,
    paymentLinkEnabled: invoice.payment_link_enabled,
    paymentLinkLastSharedAt: invoice.payment_link_last_shared_at,
    paymentPublicToken: invoice.payment_public_token ?? null,
    sentAt: invoice.sent_at,
    status: invoice.status,
    taxPercent: formatTaxPercentFromRow(Number(invoice.subtotal), Number(invoice.tax_total)),
  }));
};

const fetchBills = async (businessId: string): Promise<BillRecord[]> => {
  const [{ data: billRows, error: billError }, { data: vendorRows, error: vendorError }] = await Promise.all([
    supabase
      .from("bills")
      .select("id, vendor_id, bill_number, bill_date, due_date, status, category, total_amount, amount_paid, currency, notes, scheduled_payment_date")
      .eq("business_id", businessId)
      .order("bill_date", { ascending: false }),
    supabase.from("vendors").select("id, business_name").eq("business_id", businessId),
  ]);

  if (billError) {
    throw billError;
  }

  if (vendorError) {
    throw vendorError;
  }

  const vendorNameById = new Map(((vendorRows ?? []) as VendorNameRow[]).map((vendor) => [vendor.id, vendor.business_name]));

  return ((billRows ?? []) as BillRow[]).map((bill) => ({
    amount: Number(bill.total_amount),
    amountPaid: Number(bill.amount_paid),
    billDate: bill.bill_date,
    billNumber: bill.bill_number,
    category: bill.category ?? "",
    currency: bill.currency,
    dueDate: bill.due_date,
    id: bill.id,
    notes: bill.notes ?? "",
    scheduledPaymentDate: bill.scheduled_payment_date,
    status: bill.status,
    vendorId: bill.vendor_id,
    vendorName: vendorNameById.get(bill.vendor_id) ?? "Unknown Vendor",
  }));
};

const fetchPayments = async (businessId: string): Promise<PaymentRecord[]> => {
  const [
    { data: paymentRows, error: paymentError },
    { data: invoiceRows, error: invoiceError },
    { data: billRows, error: billError },
    { data: customerRows, error: customerError },
    { data: vendorRows, error: vendorError },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("id, invoice_id, bill_id, payment_reference, payment_type, gateway, status, amount, currency, paid_on, counterparty_name, gateway_response, metadata")
      .eq("business_id", businessId)
      .order("paid_on", { ascending: false }),
    supabase.from("invoices").select("id, invoice_number, customer_id").eq("business_id", businessId),
    supabase.from("bills").select("id, bill_number, vendor_id").eq("business_id", businessId),
    supabase.from("customers").select("id, name").eq("business_id", businessId),
    supabase.from("vendors").select("id, business_name").eq("business_id", businessId),
  ]);

  if (paymentError) {
    throw paymentError;
  }

  if (invoiceError) {
    throw invoiceError;
  }

  if (billError) {
    throw billError;
  }

  if (customerError) {
    throw customerError;
  }

  if (vendorError) {
    throw vendorError;
  }

  const customerNameById = new Map(((customerRows ?? []) as CustomerNameRow[]).map((customer) => [customer.id, customer.name]));
  const vendorNameById = new Map(((vendorRows ?? []) as VendorNameRow[]).map((vendor) => [vendor.id, vendor.business_name]));
  const invoiceById = new Map(((invoiceRows ?? []) as InvoiceReferenceRow[]).map((invoice) => [invoice.id, invoice]));
  const billById = new Map(((billRows ?? []) as BillReferenceRow[]).map((bill) => [bill.id, bill]));

  return ((paymentRows ?? []) as PaymentRow[]).map((payment) => {
    const invoice = payment.invoice_id ? invoiceById.get(payment.invoice_id) ?? null : null;
    const bill = payment.bill_id ? billById.get(payment.bill_id) ?? null : null;
    const linkedRef = invoice?.invoice_number ?? bill?.bill_number ?? (readMetadataString(payment.metadata, "document_number") || "-");
    const party =
      payment.counterparty_name?.trim() ||
      (invoice?.customer_id ? customerNameById.get(invoice.customer_id) : "") ||
      (bill?.vendor_id ? vendorNameById.get(bill.vendor_id) : "") ||
      "Unknown Counterparty";
    const gatewayResponse =
      payment.gateway_response?.trim() ||
      (payment.status === "completed"
        ? "Payment completed."
        : payment.status === "scheduled"
          ? "Payment scheduled."
          : payment.status === "failed"
            ? "Payment failed."
            : "Awaiting payment.");

    return {
      amount: Number(payment.amount),
      billId: payment.bill_id,
      currency: payment.currency,
      date: payment.paid_on,
      gateway: payment.gateway,
      gatewayResponse,
      id: payment.id,
      invoiceId: payment.invoice_id,
      linkedRef,
      metadata: payment.metadata,
      party,
      reference: payment.payment_reference,
      status: payment.status,
      type: payment.payment_type,
    };
  });
};

const fetchCustomerName = async (customerId: string) => {
  const { data, error } = await supabase.from("customers").select("name").eq("id", customerId).maybeSingle();

  if (error) {
    throw error;
  }

  return data?.name ?? "Unknown Customer";
};

const fetchVendorName = async (vendorId: string) => {
  const { data, error } = await supabase.from("vendors").select("business_name").eq("id", vendorId).maybeSingle();

  if (error) {
    throw error;
  }

  return data?.business_name ?? "Unknown Vendor";
};

/* Categories (DB-backed) */
type CategoryRow = { id: string; name: string; is_active: boolean; created_at: string };

export const fetchCategories = async (businessId?: string) => {
  const { data, error } = await supabase.from("bill_categories").select("id, name, is_active, created_at").order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as CategoryRow[];
};

export const insertCategory = async (name: string, userId?: string) => {
  const { error } = await supabase.from("bill_categories").insert({ name: name.trim(), created_by: userId ?? null }).select("id").single();

  if (error) {
    throw error;
  }
};

export const updateCategory = async (id: string, values: { name?: string; is_active?: boolean }) => {
  const payload: Record<string, unknown> = {};

  if (typeof values.name !== "undefined") payload.name = (values.name as string).trim();
  if (typeof values.is_active !== "undefined") payload.is_active = values.is_active;

  const { error } = await supabase.from("bill_categories").update(payload).eq("id", id);

  if (error) {
    throw error;
  }
};

export const useCategoriesList = () =>
  useQuery({
    queryKey: categoriesQueryKey(),
    queryFn: () => fetchCategories(),
    ...financeQueryOptions,
  });

export const useCategoryMutations = () => {
  const queryClient = useQueryClient();

  const createCategory = useMutation({
    mutationFn: ({ name, userId }: { name: string; userId?: string }) => insertCategory(name, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey() });
    },
  });

  const modifyCategory = useMutation({
    mutationFn: ({ id, values }: { id: string; values: { name?: string; is_active?: boolean } }) => updateCategory(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey() });
    },
  });

  return { createCategory, modifyCategory } as const;
};

const findExistingLinkedPayment = async (businessId: string, link: { billId?: string; invoiceId?: string }) => {
  const linkField = link.invoiceId ? "invoice_id" : "bill_id";
  const linkValue = link.invoiceId ?? link.billId;

  if (!linkValue) {
    return null;
  }

  const { data, error } = await supabase
    .from("payments")
    .select("id, payment_reference, status")
    .eq("business_id", businessId)
    .eq(linkField, linkValue)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ExistingPaymentRow | null) ?? null;
};

const deletePayment = async (businessId: string, paymentId: string) => {
  const { error } = await supabase.from("payments").delete().eq("business_id", businessId).eq("id", paymentId);

  if (error) {
    throw error;
  }
};

const upsertLinkedPayment = async (
  existingPayment: ExistingPaymentRow | null,
  values: Omit<Tables<"payments">["Insert"], "business_id" | "created_by" | "payment_reference"> & { business_id: string; created_by: string },
) => {
  if (existingPayment) {
    const { error } = await supabase
      .from("payments")
      .update({
        amount: values.amount,
        bill_id: values.bill_id,
        business_id: values.business_id,
        counterparty_name: values.counterparty_name,
        currency: values.currency,
        gateway: values.gateway,
        gateway_response: values.gateway_response,
        invoice_id: values.invoice_id,
        metadata: values.metadata,
        paid_on: values.paid_on,
        payment_type: values.payment_type,
        status: values.status,
      })
      .eq("business_id", values.business_id)
      .eq("id", existingPayment.id);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } = await supabase.from("payments").insert({
    ...values,
    payment_reference: createPaymentReference(),
  });

  if (error) {
    throw error;
  }
};

const syncInvoicePaymentRecord = async ({
  amount,
  businessId,
  currency,
  customerId,
  dueDate,
  invoiceId,
  invoiceNumber,
  issueDate,
  paidAt,
  status,
  userId,
}: {
  amount: number;
  businessId: string;
  currency: string;
  customerId: string;
  dueDate: string | null;
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  paidAt: string | null;
  status: Enums<"invoice_status">;
  userId: string;
}) => {
  const existingPayment = await findExistingLinkedPayment(businessId, { invoiceId });

  if (status === "draft" || status === "cancelled") {
    if (existingPayment) {
      await deletePayment(businessId, existingPayment.id);
    }
    return;
  }

  const customerName = await fetchCustomerName(customerId);
  const paymentStatus: Enums<"payment_status"> =
    status === "paid" ? "completed" : status === "overdue" ? "pending" : "pending";
  const paidOn = status === "paid" ? toDateOnly(paidAt) : toDateOnly(dueDate, issueDate);
  const gatewayResponse =
    status === "paid"
      ? "Invoice marked as paid in moniger.net."
      : status === "overdue"
        ? "Customer payment is overdue."
        : "Awaiting customer payment.";

  await upsertLinkedPayment(existingPayment, {
    amount,
    bill_id: null,
    business_id: businessId,
    counterparty_name: customerName,
    created_by: userId,
    currency,
    gateway: "manual",
    gateway_response: gatewayResponse,
    invoice_id: invoiceId,
    metadata: {
      document_number: invoiceNumber,
      source: "invoices",
      synced_status: status,
    },
    paid_on: paidOn,
    payment_type: "receivable",
    status: paymentStatus,
  });

  if (status === "paid") {
    await logAuditEventSafe({
      action: "payment.received",
      actorUserId: userId,
      businessId,
      detail: {
        amount,
        currency,
        customer_name: customerName,
        description: `${customerName} • ${formatAuditMoney(amount, currency)}`,
        document_number: invoiceNumber,
        status: "completed",
      },
      entityId: invoiceId,
      entityType: "payment",
      summary: `Payment received for ${invoiceNumber}`,
    });
    await createNotificationSafe({
      body: `${customerName} paid ${formatAuditMoney(amount, currency)} against ${invoiceNumber}.`,
      businessId,
      link: "/payments",
      preferenceKey: "payment_received",
      title: "Payment received",
      type: "payment",
      userId,
    });
  }
};

const syncBillPaymentRecord = async ({
  amount,
  billDate,
  billId,
  billNumber,
  businessId,
  currency,
  dueDate,
  scheduledPaymentDate,
  status,
  userId,
  vendorId,
}: {
  amount: number;
  billDate: string;
  billId: string;
  billNumber: string;
  businessId: string;
  currency: string;
  dueDate: string | null;
  scheduledPaymentDate: string | null;
  status: Enums<"bill_status">;
  userId: string;
  vendorId: string;
}) => {
  const existingPayment = await findExistingLinkedPayment(businessId, { billId });

  if (status === "unpaid") {
    if (existingPayment) {
      await deletePayment(businessId, existingPayment.id);
    }
    return;
  }

  const vendorName = await fetchVendorName(vendorId);
  const paymentStatus: Enums<"payment_status"> =
    status === "paid" ? "completed" : status === "scheduled" ? "scheduled" : "pending";
  const paidOn =
    status === "paid"
      ? toDateOnly(scheduledPaymentDate, todayDate())
      : toDateOnly(scheduledPaymentDate ?? dueDate, billDate);
  const gatewayResponse =
    status === "paid"
      ? "Bill marked as paid in moniger.net."
      : status === "scheduled"
        ? `Scheduled for ${paidOn}.`
        : "Bill payment is overdue.";

  await upsertLinkedPayment(existingPayment, {
    amount,
    bill_id: billId,
    business_id: businessId,
    counterparty_name: vendorName,
    created_by: userId,
    currency,
    gateway: "manual",
    gateway_response: gatewayResponse,
    invoice_id: null,
    metadata: {
      document_number: billNumber,
      source: "bills",
      synced_status: status,
    },
    paid_on: paidOn,
    payment_type: "payable",
    status: paymentStatus,
  });

  if (status === "scheduled" || status === "paid") {
    await logAuditEventSafe({
      action: status === "paid" ? "payment.completed" : "payment.scheduled",
      actorUserId: userId,
      businessId,
      detail: {
        amount,
        currency,
        description:
          status === "paid"
            ? `${vendorName} • ${formatAuditMoney(amount, currency)}`
            : `${vendorName} • ${formatAuditMoney(amount, currency)} • Scheduled for ${paidOn}`,
        document_number: billNumber,
        status,
        vendor_name: vendorName,
      },
      entityId: billId,
      entityType: "payment",
      summary: status === "paid" ? `Payment completed for ${billNumber}` : `Payment scheduled for ${billNumber}`,
    });
    await createNotificationSafe({
      body:
        status === "paid"
          ? `${vendorName} was paid ${formatAuditMoney(amount, currency)} for ${billNumber}.`
          : `${billNumber} for ${vendorName} was scheduled for ${paidOn}.`,
      businessId,
      link: status === "paid" ? "/payments" : "/bills",
      preferenceKey: status === "paid" ? "payment_received" : "bill_due",
      title: status === "paid" ? "Payment completed" : "Bill scheduled",
      type: status === "paid" ? "payment" : "bill",
      userId,
    });
  }
};

const insertInvoiceItems = async (invoiceId: string, lineItems: FinanceLineItem[]) => {
  if (!lineItems.length) {
    return;
  }

  const { error } = await supabase.from("invoice_items").insert(
    lineItems.map((item, index) => ({
      description: item.description.trim(),
      invoice_id: invoiceId,
      line_number: index + 1,
      quantity: item.qty,
      unit_price: item.unitPrice,
    })),
  );

  if (error) {
    throw error;
  }
};

const createInvoice = async (businessId: string, userId: string, values: InvoiceInput) => {
  const totals = calculateInvoiceTotals(values.line_items, values.tax_percent);
  const recordDeliveryAttempt = values.record_delivery_attempt ?? values.status === "sent";
  const sentAt = values.status === "sent" ? new Date().toISOString() : null;
  const paidAt = values.status === "paid" ? new Date().toISOString() : null;
  const deliveryState = buildInvoiceDeliveryState({
    nextStatus: values.status,
    recordDeliveryAttempt,
    sentAt,
    values,
  });

  const { data, error } = await supabase
    .from("invoices")
    .insert({
      amount_paid: values.status === "paid" ? totals.totalAmount : 0,
      business_id: businessId,
      created_by: userId,
      customer_id: values.customer_id,
      currency: "NGN",
      delivery_attempt_count: deliveryState.deliveryAttemptCount,
      delivery_email: deliveryState.deliveryEmail,
      delivery_last_attempt_at: deliveryState.deliveryLastAttemptAt,
      delivery_last_error: deliveryState.deliveryLastError,
      delivery_message: deliveryState.deliveryMessage,
      delivery_method: deliveryState.deliveryMethod,
      delivery_status: deliveryState.deliveryStatus,
      delivery_subject: deliveryState.deliverySubject,
      due_date: values.due_date ?? null,
      invoice_number: values.invoice_number,
      issue_date: values.issue_date,
      notes: values.notes ?? null,
      paid_at: paidAt,
      sent_at: sentAt,
      status: values.status,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      total_amount: totals.totalAmount,
      updated_by: userId,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  try {
    await insertInvoiceItems(data.id, totals.items.map((item) => ({ description: item.description, qty: item.qty, unitPrice: item.unitPrice })));
    await syncInvoicePaymentRecord({
      amount: totals.totalAmount,
      businessId,
      currency: "NGN",
      customerId: values.customer_id,
      dueDate: values.due_date ?? null,
      invoiceId: data.id,
      invoiceNumber: values.invoice_number,
      issueDate: values.issue_date,
      paidAt,
      status: values.status,
      userId,
    });
    const customerName = await fetchCustomerName(values.customer_id);
    await logAuditEventSafe({
      action: "invoice.created",
      actorUserId: userId,
      businessId,
      detail: {
        amount: totals.totalAmount,
        currency: "NGN",
        customer_name: customerName,
        description: `${customerName} • ${formatAuditMoney(totals.totalAmount)}`,
        document_number: values.invoice_number,
        status: values.status,
      },
      entityId: data.id,
      entityType: "invoice",
      summary: `Invoice ${values.invoice_number} created`,
    });
    if (recordDeliveryAttempt) {
      await recordInvoiceDeliveryActivity({
        amount: totals.totalAmount,
        businessId,
        currency: "NGN",
        customerName,
        deliveryEmail: deliveryState.deliveryEmail,
        deliveryMethod: deliveryState.deliveryMethod,
        invoiceId: data.id,
        invoiceNumber: values.invoice_number,
        isResend: false,
        userId,
      });
    }
  } catch (itemError) {
    await supabase.from("invoices").delete().eq("business_id", businessId).eq("id", data.id);
    throw itemError;
  }

  return { id: data.id };
};

const updateInvoice = async (businessId: string, invoice: InvoiceRecord, userId: string, values: InvoiceInput) => {
  const totals = calculateInvoiceTotals(values.line_items, values.tax_percent);
  const nextStatus = values.status;
  const recordDeliveryAttempt = values.record_delivery_attempt ?? false;
  const nextAmountPaid = nextStatus === "paid" ? totals.totalAmount : invoice.status === "paid" ? 0 : invoice.amountPaid;
  const nextPaidAt = nextStatus === "paid" ? invoice.paidAt ?? new Date().toISOString() : null;
  const nextSentAt =
    nextStatus === "draft"
      ? null
      : recordDeliveryAttempt || nextStatus === "sent"
        ? invoice.sentAt ?? new Date().toISOString()
        : invoice.sentAt;
  const deliveryState = buildInvoiceDeliveryState({
    currentInvoice: invoice,
    nextStatus,
    recordDeliveryAttempt,
    sentAt: nextSentAt,
    values,
  });

  const { error: updateError } = await supabase
    .from("invoices")
    .update({
      amount_paid: nextAmountPaid,
      customer_id: values.customer_id,
      delivery_attempt_count: deliveryState.deliveryAttemptCount,
      delivery_email: deliveryState.deliveryEmail,
      delivery_last_attempt_at: deliveryState.deliveryLastAttemptAt,
      delivery_last_error: deliveryState.deliveryLastError,
      delivery_message: deliveryState.deliveryMessage,
      delivery_method: deliveryState.deliveryMethod,
      delivery_status: deliveryState.deliveryStatus,
      delivery_subject: deliveryState.deliverySubject,
      due_date: values.due_date ?? null,
      invoice_number: values.invoice_number,
      issue_date: values.issue_date,
      notes: values.notes ?? null,
      paid_at: nextPaidAt,
      sent_at: nextSentAt,
      status: nextStatus,
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      total_amount: totals.totalAmount,
      updated_by: userId,
    })
    .eq("business_id", businessId)
    .eq("id", invoice.id);

  if (updateError) {
    throw updateError;
  }

  const { error: deleteItemsError } = await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);

  if (deleteItemsError) {
    throw deleteItemsError;
  }

  await insertInvoiceItems(invoice.id, totals.items.map((item) => ({ description: item.description, qty: item.qty, unitPrice: item.unitPrice })));
  await syncInvoicePaymentRecord({
    amount: totals.totalAmount,
    businessId,
    currency: invoice.currency,
    customerId: values.customer_id,
    dueDate: values.due_date ?? null,
    invoiceId: invoice.id,
    invoiceNumber: values.invoice_number,
    issueDate: values.issue_date,
    paidAt: nextPaidAt,
    status: nextStatus,
    userId,
  });
  await logAuditEventSafe({
    action: "invoice.updated",
    actorUserId: userId,
    businessId,
    detail: {
      amount: totals.totalAmount,
      currency: invoice.currency,
      description: `${values.invoice_number} updated • ${formatAuditMoney(totals.totalAmount, invoice.currency)}`,
      document_number: values.invoice_number,
      status: nextStatus,
    },
    entityId: invoice.id,
    entityType: "invoice",
    summary: `Invoice ${values.invoice_number} updated`,
  });
  if (recordDeliveryAttempt) {
    const nextCustomerName = await fetchCustomerName(values.customer_id);
    await recordInvoiceDeliveryActivity({
      amount: totals.totalAmount,
      businessId,
      currency: invoice.currency,
      customerName: nextCustomerName,
      deliveryEmail: deliveryState.deliveryEmail,
      deliveryMethod: deliveryState.deliveryMethod,
      invoiceId: invoice.id,
      invoiceNumber: values.invoice_number,
      isResend: invoice.deliveryAttemptCount > 0 || invoice.status === "sent" || invoice.status === "overdue",
      userId,
    });
  }

  return { id: invoice.id };
};

const deleteInvoice = async (businessId: string, invoiceId: string, invoiceNumber: string, userId: string) => {
  const { error } = await supabase.from("invoices").delete().eq("business_id", businessId).eq("id", invoiceId);

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "invoice.deleted",
    actorUserId: userId,
    businessId,
    detail: {
      description: `Invoice ${invoiceNumber} removed`,
      document_number: invoiceNumber,
    },
    entityId: invoiceId,
    entityType: "invoice",
    summary: `Invoice ${invoiceNumber} deleted`,
  });
};

const updateInvoiceStatus = async (businessId: string, invoice: InvoiceRecord, userId: string, status: Enums<"invoice_status">) => {
  if (invoice.status === "paid" && status !== "paid") {
    throw new Error("Paid invoices cannot be moved to another status.");
  }

  const now = new Date().toISOString();
  const updates: Tables<"invoices">["Update"] = {
    status,
    updated_by: userId,
  };

  if (status === "sent") {
    updates.sent_at = invoice.sentAt ?? now;
    updates.delivery_attempt_count = Math.max(invoice.deliveryAttemptCount, 1);
    updates.delivery_last_attempt_at = invoice.deliveryLastAttemptAt ?? updates.sent_at;
    updates.delivery_last_error = null;
    updates.delivery_method = invoice.deliveryMethod;
    updates.delivery_status =
      invoice.deliveryStatus === "failed" || invoice.deliveryStatus === "not_sent"
        ? invoice.deliveryMethod === "backend_email"
          ? "sent"
          : "prepared"
        : invoice.deliveryStatus;
  }

  if (status === "paid") {
    updates.amount_paid = invoice.amount;
    updates.paid_at = invoice.paidAt ?? now;
  }

  if (status === "cancelled") {
    updates.amount_paid = 0;
    updates.paid_at = null;
  }

  const { error } = await supabase.from("invoices").update(updates).eq("business_id", businessId).eq("id", invoice.id);

  if (error) {
    throw error;
  }

  await syncInvoicePaymentRecord({
    amount: status === "paid" ? invoice.amount : invoice.amount,
    businessId,
    currency: invoice.currency,
    customerId: invoice.customerId,
    dueDate: invoice.dueDate,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    paidAt: status === "paid" ? updates.paid_at ?? now : null,
    status,
    userId,
  });

  if (status === "sent" || status === "cancelled") {
    await logAuditEventSafe({
      action: status === "sent" ? "invoice.sent" : "invoice.cancelled",
      actorUserId: userId,
      businessId,
      detail: {
        amount: invoice.amount,
        currency: invoice.currency,
        customer_name: invoice.customerName,
        description: `${invoice.customerName} • ${formatAuditMoney(invoice.amount, invoice.currency)}`,
        document_number: invoice.invoiceNumber,
        status,
      },
      entityId: invoice.id,
      entityType: "invoice",
      summary: status === "sent" ? `Invoice ${invoice.invoiceNumber} sent` : `Invoice ${invoice.invoiceNumber} cancelled`,
    });
    if (status === "sent") {
      await createNotificationSafe({
        body: `${invoice.invoiceNumber} was sent to ${invoice.customerName} for ${formatAuditMoney(invoice.amount, invoice.currency)}.`,
        businessId,
        link: "/invoices",
        preferenceKey: "invoice_sent",
        title: "Invoice sent",
        type: "invoice",
        userId,
      });
    }
  }
};

const enableInvoicePaymentLink = async (businessId: string, invoice: InvoiceRecord, userId: string) => {
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    throw new Error("Paid or cancelled invoices cannot accept a public payment link.");
  }

  if (invoice.balanceDue <= 0) {
    throw new Error("Only invoices with an outstanding balance can accept a payment link.");
  }

  const sharedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("invoices")
    .update({
      payment_link_enabled: true,
      payment_link_last_shared_at: sharedAt,
      updated_by: userId,
    })
    .eq("id", invoice.id)
    .select("payment_public_token")
    .single();

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: invoice.paymentLinkEnabled ? "invoice.payment_link.shared_again" : "invoice.payment_link.enabled",
    actorUserId: userId,
    businessId,
    detail: {
      description: `${invoice.invoiceNumber} payment link prepared for sharing.`,
      document_number: invoice.invoiceNumber,
      payment_public_token: data.payment_public_token,
    },
    entityId: invoice.id,
    entityType: "invoice",
    summary: invoice.paymentLinkEnabled
      ? `Invoice ${invoice.invoiceNumber} payment link shared again`
      : `Invoice ${invoice.invoiceNumber} payment link enabled`,
  });

  return {
    paymentPublicToken: data.payment_public_token,
    sharedAt,
  };
};

const deliverInvoice = async (
  businessId: string,
  invoice: InvoiceRecord,
  userId: string,
  delivery: InvoiceDeliveryInput,
) => {
  if (invoice.status === "paid" || invoice.status === "cancelled") {
    throw new Error("Paid or cancelled invoices cannot be sent again.");
  }

  const nextStatus = invoice.status === "draft" ? "sent" : invoice.status;
  const sentAt = invoice.sentAt ?? new Date().toISOString();
  const deliveryState = buildInvoiceDeliveryState({
    currentInvoice: invoice,
    method: delivery.method,
    nextStatus,
    recordDeliveryAttempt: true,
    sentAt,
    values: {
      delivery_email: delivery.email,
      delivery_message: delivery.message ?? null,
      delivery_subject: delivery.subject,
    },
  });

  const { error } = await supabase
    .from("invoices")
    .update({
      delivery_attempt_count: deliveryState.deliveryAttemptCount,
      delivery_email: deliveryState.deliveryEmail,
      delivery_last_attempt_at: deliveryState.deliveryLastAttemptAt,
      delivery_last_error: deliveryState.deliveryLastError,
      delivery_message: deliveryState.deliveryMessage,
      delivery_method: delivery.method ?? deliveryState.deliveryMethod,
      delivery_status: deliveryState.deliveryStatus,
      delivery_subject: deliveryState.deliverySubject,
      sent_at: sentAt,
      status: nextStatus,
      updated_by: userId,
    })
    .eq("id", invoice.id);

  if (error) {
    throw error;
  }

  await syncInvoicePaymentRecord({
    amount: invoice.amount,
    businessId,
    currency: invoice.currency,
    customerId: invoice.customerId,
    dueDate: invoice.dueDate,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate,
    paidAt: invoice.paidAt,
    status: nextStatus,
    userId,
  });

  await recordInvoiceDeliveryActivity({
    amount: invoice.amount,
    businessId,
    currency: invoice.currency,
    customerName: invoice.customerName,
    deliveryEmail: deliveryState.deliveryEmail,
    deliveryMethod: delivery.method ?? deliveryState.deliveryMethod,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    isResend: invoice.deliveryAttemptCount > 0 || invoice.status === "sent" || invoice.status === "overdue",
    userId,
  });

  return { id: invoice.id };
};

const createBill = async (businessId: string, userId: string, values: BillInput) => {
  const totalAmount = roundCurrency(values.amount);
  const isPaid = values.status === "paid";
  const isScheduled = values.status === "scheduled";

  const scheduledPaymentDate = isScheduled ? values.scheduled_payment_date ?? values.due_date ?? values.bill_date : null;
  const { data, error } = await supabase
    .from("bills")
    .insert({
      amount_paid: isPaid ? totalAmount : 0,
      bill_date: values.bill_date,
      bill_number: values.bill_number,
      business_id: businessId,
      category: values.category ?? null,
      created_by: userId,
      currency: "NGN",
      due_date: values.due_date ?? null,
      notes: values.notes ?? null,
      scheduled_payment_date: scheduledPaymentDate,
      status: values.status,
      subtotal: totalAmount,
      tax_total: 0,
      total_amount: totalAmount,
      updated_by: userId,
      vendor_id: values.vendor_id,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  await syncBillPaymentRecord({
    amount: totalAmount,
    billDate: values.bill_date,
    billId: data.id,
    billNumber: values.bill_number,
    businessId,
    currency: "NGN",
    dueDate: values.due_date ?? null,
    scheduledPaymentDate,
    status: values.status,
    userId,
    vendorId: values.vendor_id,
  });
  const vendorName = await fetchVendorName(values.vendor_id);
  await logAuditEventSafe({
    action: "bill.created",
    actorUserId: userId,
    businessId,
    detail: {
      amount: totalAmount,
      currency: "NGN",
      description: `${vendorName} • ${formatAuditMoney(totalAmount)}`,
      document_number: values.bill_number,
      status: values.status,
      vendor_name: vendorName,
    },
    entityId: data.id,
    entityType: "bill",
    summary: `Bill ${values.bill_number} recorded`,
  });
};

const updateBill = async (businessId: string, bill: BillRecord, userId: string, values: BillInput) => {
  const totalAmount = roundCurrency(values.amount);
  const nextStatus = values.status;
  const nextScheduledPaymentDate =
    nextStatus === "scheduled" ? values.scheduled_payment_date ?? values.due_date ?? values.bill_date : null;
  const nextAmountPaid = nextStatus === "paid" ? totalAmount : bill.status === "paid" ? 0 : bill.amountPaid;

  const { error } = await supabase
    .from("bills")
    .update({
      amount_paid: nextAmountPaid,
      bill_date: values.bill_date,
      bill_number: values.bill_number,
      category: values.category ?? null,
      currency: bill.currency,
      due_date: values.due_date ?? null,
      notes: values.notes ?? null,
      scheduled_payment_date: nextScheduledPaymentDate,
      status: nextStatus,
      subtotal: totalAmount,
      tax_total: 0,
      total_amount: totalAmount,
      updated_by: userId,
      vendor_id: values.vendor_id,
    })
    .eq("business_id", businessId)
    .eq("id", bill.id);

  if (error) {
    throw error;
  }

  await syncBillPaymentRecord({
    amount: totalAmount,
    billDate: values.bill_date,
    billId: bill.id,
    billNumber: values.bill_number,
    businessId,
    currency: bill.currency,
    dueDate: values.due_date ?? null,
    scheduledPaymentDate: nextScheduledPaymentDate,
    status: nextStatus,
    userId,
    vendorId: values.vendor_id,
  });
  await logAuditEventSafe({
    action: "bill.updated",
    actorUserId: userId,
    businessId,
    detail: {
      amount: totalAmount,
      currency: bill.currency,
      description: `${values.bill_number} updated • ${formatAuditMoney(totalAmount, bill.currency)}`,
      document_number: values.bill_number,
      status: nextStatus,
      vendor_name: bill.vendorName,
    },
    entityId: bill.id,
    entityType: "bill",
    summary: `Bill ${values.bill_number} updated`,
  });
};

const deleteBill = async (businessId: string, billId: string, billNumber: string, userId: string) => {
  const { error } = await supabase.from("bills").delete().eq("business_id", businessId).eq("id", billId);

  if (error) {
    throw error;
  }

  await logAuditEventSafe({
    action: "bill.deleted",
    actorUserId: userId,
    businessId,
    detail: {
      description: `Bill ${billNumber} removed`,
      document_number: billNumber,
    },
    entityId: billId,
    entityType: "bill",
    summary: `Bill ${billNumber} deleted`,
  });
};

const updateBillStatus = async (businessId: string, bill: BillRecord, userId: string, status: Enums<"bill_status">) => {
  if (bill.status === "paid" && status !== "paid") {
    throw new Error("Paid bills cannot be moved to another status.");
  }

  const updates: Tables<"bills">["Update"] = {
    status,
    updated_by: userId,
  };

  if (status === "paid") {
    updates.amount_paid = bill.amount;
  }

  if (status === "scheduled") {
    updates.scheduled_payment_date = bill.scheduledPaymentDate ?? bill.dueDate ?? bill.billDate;
  }

  if (status === "unpaid") {
    updates.amount_paid = 0;
    updates.scheduled_payment_date = null;
  }

  const { error } = await supabase.from("bills").update(updates).eq("business_id", businessId).eq("id", bill.id);

  if (error) {
    throw error;
  }

  await syncBillPaymentRecord({
    amount: bill.amount,
    billDate: bill.billDate,
    billId: bill.id,
    billNumber: bill.billNumber,
    businessId,
    currency: bill.currency,
    dueDate: bill.dueDate,
    scheduledPaymentDate: (updates.scheduled_payment_date as string | null | undefined) ?? bill.scheduledPaymentDate,
    status,
    userId,
    vendorId: bill.vendorId,
  });
};

export const useInvoicesData = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? invoicesQueryKey(businessId) : ["invoices", "missing-business"],
    queryFn: () => fetchInvoices(businessId!),
    enabled: Boolean(businessId),
    ...financeQueryOptions,
    ...liveFinanceQueryOptions,
  });

export const useBillsData = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? billsQueryKey(businessId) : ["bills", "missing-business"],
    queryFn: () => fetchBills(businessId!),
    enabled: Boolean(businessId),
    ...financeQueryOptions,
  });

export const usePaymentsData = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? paymentsQueryKey(businessId) : ["payments", "missing-business"],
    queryFn: () => fetchPayments(businessId!),
    enabled: Boolean(businessId),
    ...financeQueryOptions,
    ...liveFinanceQueryOptions,
  });

const invalidateFinanceAndDirectories = async (
  queryClient: ReturnType<typeof useQueryClient>,
  businessId?: string,
  userId?: string,
) => {
  if (!businessId) {
    return;
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: invoicesQueryKey(businessId) }),
    queryClient.invalidateQueries({ queryKey: billsQueryKey(businessId) }),
    queryClient.invalidateQueries({ queryKey: paymentsQueryKey(businessId) }),
    queryClient.invalidateQueries({ queryKey: ["workspace-wallet", businessId] }),
    queryClient.invalidateQueries({ queryKey: ["customers", businessId] }),
    queryClient.invalidateQueries({ queryKey: ["vendors", businessId] }),
    queryClient.invalidateQueries({ queryKey: ["operations", businessId] }),
    ...(userId ? [queryClient.invalidateQueries({ queryKey: ["notifications", businessId, userId] })] : []),
  ]);
};

export const useInvoiceMutations = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  return {
    createInvoice: useMutation({
      mutationFn: (values: InvoiceInput) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can create invoices.");
        }

        return createInvoice(businessId, userId, values);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    deleteInvoice: useMutation({
      mutationFn: ({ invoiceId, invoiceNumber }: { invoiceId: string; invoiceNumber: string }) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can delete invoices.");
        }

        return deleteInvoice(businessId, invoiceId, invoiceNumber, userId);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    deliverInvoice: useMutation({
      mutationFn: ({ delivery, invoice }: { delivery: InvoiceDeliveryInput; invoice: InvoiceRecord }) => {
        if (!userId) {
          throw new Error("You must be signed in to send invoices.");
        }

        if (!businessId) {
          throw new Error("A business workspace is required before you can send invoices.");
        }

        return deliverInvoice(businessId, invoice, userId, delivery);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    updateInvoice: useMutation({
      mutationFn: ({ invoice, values }: { invoice: InvoiceRecord; values: InvoiceInput }) => {
        if (!userId) {
          throw new Error("You must be signed in to update invoices.");
        }

        if (!businessId) {
          throw new Error("A business workspace is required before you can update invoices.");
        }

        return updateInvoice(businessId!, invoice, userId, values);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    updateInvoiceStatus: useMutation({
      mutationFn: ({ invoice, status }: { invoice: InvoiceRecord; status: Enums<"invoice_status"> }) => {
        if (!userId) {
          throw new Error("You must be signed in to update invoice status.");
        }

        if (!businessId) {
          throw new Error("A business workspace is required before you can update invoice status.");
        }

        return updateInvoiceStatus(businessId, invoice, userId, status);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    enableInvoicePaymentLink: useMutation({
      mutationFn: ({ invoice }: { invoice: InvoiceRecord }) => {
        if (!userId) {
          throw new Error("You must be signed in to manage invoice payment links.");
        }

        if (!businessId) {
          throw new Error("A business workspace is required before you can manage payment links.");
        }

        return enableInvoicePaymentLink(businessId, invoice, userId);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
  };
};

export const useBillMutations = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  return {
    createBill: useMutation({
      mutationFn: (values: BillInput) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can create bills.");
        }

        return createBill(businessId, userId, values);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    deleteBill: useMutation({
      mutationFn: ({ billId, billNumber }: { billId: string; billNumber: string }) => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before you can delete bills.");
        }

        return deleteBill(businessId, billId, billNumber, userId);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    updateBill: useMutation({
      mutationFn: ({ bill, values }: { bill: BillRecord; values: BillInput }) => {
        if (!userId) {
          throw new Error("You must be signed in to update bills.");
        }

        if (!businessId) {
          throw new Error("A business workspace is required before you can update bills.");
        }

        return updateBill(businessId, bill, userId, values);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
    updateBillStatus: useMutation({
      mutationFn: ({ bill, status }: { bill: BillRecord; status: Enums<"bill_status"> }) => {
        if (!userId) {
          throw new Error("You must be signed in to update bill status.");
        }

        if (!businessId) {
          throw new Error("A business workspace is required before you can update bill status.");
        }

        return updateBillStatus(businessId, bill, userId, status);
      },
      onSuccess: () => invalidateFinanceAndDirectories(queryClient, businessId, userId),
    }),
  };
};
