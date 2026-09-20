import { useQuery } from "@tanstack/react-query";
import { addDays, format, formatDistanceToNow, isWithinInterval, parseISO, startOfDay, startOfMonth, subMonths } from "date-fns";
import type { Json, Tables } from "@/integrations/supabase/types";
import { liveOperationsQueryOptions, operationsQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

type InvoiceInsightRow = Pick<
  Tables<"invoices">,
  | "amount_paid"
  | "balance_due"
  | "customer_id"
  | "due_date"
  | "id"
  | "invoice_number"
  | "issue_date"
  | "paid_at"
  | "status"
  | "total_amount"
>;
type BillInsightRow = Pick<
  Tables<"bills">,
  | "amount_paid"
  | "balance_due"
  | "bill_date"
  | "bill_number"
  | "due_date"
  | "id"
  | "scheduled_payment_date"
  | "status"
  | "total_amount"
  | "updated_at"
  | "vendor_id"
>;
type PaymentInsightRow = Pick<
  Tables<"payments">,
  | "amount"
  | "bill_id"
  | "currency"
  | "gateway"
  | "id"
  | "invoice_id"
  | "metadata"
  | "paid_on"
  | "payment_type"
  | "status"
>;
type AuditRow = Pick<Tables<"audit_logs">, "action" | "created_at" | "detail" | "entity_type" | "id" | "summary">;
type CustomerNameRow = Pick<Tables<"customers">, "id" | "name">;
type VendorNameRow = Pick<Tables<"vendors">, "business_name" | "id">;

export type ActivityModule = "Invoices" | "Bills" | "Payments" | "Vendors" | "Customers" | "Workspace" | "System";

export type ActivityItem = {
  absoluteTime: string;
  action: string;
  createdAt: string;
  detail: string;
  id: string;
  module: ActivityModule;
  relativeTime: string;
};

export type DashboardDueBill = {
  amount: number;
  billNumber: string;
  dueDate: string;
  vendorName: string;
};

export type DashboardInsights = {
  collectedThisMonth: number;
  confirmedReceivablePaymentsThisMonth: number;
  dueThisWeek: DashboardDueBill[];
  dueThisWeekCount: number;
  openInvoices: number;
  overdueCount: number;
  paystackCollectedThisMonth: number;
  recentActivity: ActivityItem[];
  totalPayable: number;
  totalReceivable: number;
};

export type CashFlowPoint = {
  month: string;
  payables: number;
  receivables: number;
};

export type InvoiceStatusPoint = {
  color: string;
  name: string;
  value: number;
};

export type MonthlySummaryRow = {
  billsPaid: number;
  collected: number;
  invoiced: number;
  month: string;
  net: number;
};

export type ReportsInsights = {
  cashFlowData: CashFlowPoint[];
  collectionSummary: {
    confirmedReceivablePayments: number;
    paystackSettlements: number;
    totalCollected: number;
    totalPayablesSettled: number;
  };
  invoiceStatusData: InvoiceStatusPoint[];
  monthlySummary: MonthlySummaryRow[];
  totalInvoices: number;
  totalBills: number;
  totalCustomers: number;
  totalVendors: number;
};

export type OperationsData = {
  auditEntries: ActivityItem[];
  dashboard: DashboardInsights;
  reports: ReportsInsights;
};

const operationsQueryKey = (businessId: string) => ["operations", businessId] as const;
const statusColors = {
  cancelled: "hsl(220, 13%, 46%)",
  draft: "hsl(215, 16%, 47%)",
  overdue: "hsl(0, 72%, 51%)",
  paid: "hsl(142, 72%, 37%)",
  sent: "hsl(204, 70%, 44%)",
} as const;

const formatMoney = (amount: number, currency = "NGN") => {
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

const readMetadataString = (metadata: Json, key: string) => {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const value = metadata[key];
  return typeof value === "string" ? value : "";
};

const parseDateValue = (value: string) => parseISO(value.length === 10 ? `${value}T00:00:00` : value);

const getDetailText = (detail: Json) => {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return "";
  }

  if (typeof detail.description === "string") {
    return detail.description;
  }

  const currency = typeof detail.currency === "string" ? detail.currency : "NGN";
  const parts: string[] = [];

  if (typeof detail.document_number === "string") {
    parts.push(detail.document_number);
  }

  if (typeof detail.customer_name === "string") {
    parts.push(detail.customer_name);
  }

  if (typeof detail.vendor_name === "string") {
    parts.push(detail.vendor_name);
  }

  if (typeof detail.email === "string") {
    parts.push(detail.email);
  }

  if (typeof detail.amount === "number") {
    parts.push(formatMoney(detail.amount, currency));
  }

  if (typeof detail.status === "string") {
    parts.push(`Status: ${detail.status}`);
  }

  return parts.join(" • ");
};

const getModuleFromEntityType = (entityType: string): ActivityModule => {
  switch (entityType) {
    case "invoice":
      return "Invoices";
    case "bill":
      return "Bills";
    case "payment":
      return "Payments";
    case "vendor":
      return "Vendors";
    case "customer":
      return "Customers";
    case "business":
    case "profile":
    case "seed":
      return "Workspace";
    default:
      return "System";
  }
};

const createActivityItem = (entry: {
  action: string;
  createdAt: string;
  detail: string;
  entityType: string;
  id: string;
}) => {
  const createdAtDate = parseDateValue(entry.createdAt);

  return {
    absoluteTime: format(createdAtDate, "MMM d, yyyy 'at' h:mm a"),
    action: entry.action,
    createdAt: entry.createdAt,
    detail: entry.detail,
    id: entry.id,
    module: getModuleFromEntityType(entry.entityType),
    relativeTime: formatDistanceToNow(createdAtDate, { addSuffix: true }),
  } satisfies ActivityItem;
};

const createFallbackActivity = (
  invoices: InvoiceInsightRow[],
  bills: BillInsightRow[],
  payments: PaymentInsightRow[],
  customerNameById: Map<string, string>,
  vendorNameById: Map<string, string>,
) => {
  const invoiceEvents = invoices.map((invoice) =>
    createActivityItem({
      action: `Invoice ${invoice.invoice_number} recorded`,
      createdAt: invoice.issue_date,
      detail: customerNameById.get(invoice.customer_id) ?? "Customer record",
      entityType: "invoice",
      id: `invoice-${invoice.id}`,
    }),
  );
  const billEvents = bills.map((bill) =>
    createActivityItem({
      action: `Bill ${bill.bill_number} recorded`,
      createdAt: bill.bill_date,
      detail: vendorNameById.get(bill.vendor_id) ?? "Vendor record",
      entityType: "bill",
      id: `bill-${bill.id}`,
    }),
  );
  const paymentEvents = payments.map((payment) =>
    createActivityItem({
      action:
        payment.payment_type === "receivable"
          ? `Receivable payment ${payment.status}`
          : `Payable payment ${payment.status}`,
      createdAt: payment.paid_on,
      detail: formatMoney(Number(payment.amount), payment.currency),
      entityType: "payment",
      id: `payment-${payment.id}`,
    }),
  );

  return [...paymentEvents, ...invoiceEvents, ...billEvents]
    .sort((left, right) => parseDateValue(right.createdAt).getTime() - parseDateValue(left.createdAt).getTime())
    .slice(0, 5);
};

const fetchOperationsData = async (businessId: string): Promise<OperationsData> => {
  const [
    { data: invoiceRows, error: invoiceError },
    { data: billRows, error: billError },
    { data: paymentRows, error: paymentError },
    { data: auditRows, error: auditError },
    { data: customerRows, error: customerError },
    { data: vendorRows, error: vendorError },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, customer_id, invoice_number, issue_date, due_date, status, total_amount, amount_paid, balance_due, paid_at")
      .eq("business_id", businessId),
    supabase
      .from("bills")
      .select("id, vendor_id, bill_number, bill_date, due_date, status, total_amount, amount_paid, balance_due, scheduled_payment_date, updated_at")
      .eq("business_id", businessId),
    supabase
      .from("payments")
      .select("id, invoice_id, bill_id, amount, currency, gateway, metadata, paid_on, payment_type, status")
      .eq("business_id", businessId),
    supabase
      .from("audit_logs")
      .select("id, entity_type, action, summary, detail, created_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name").eq("business_id", businessId),
    supabase.from("vendors").select("id, business_name").eq("business_id", businessId),
  ]);

  if (invoiceError) {
    throw invoiceError;
  }

  if (billError) {
    throw billError;
  }

  if (paymentError) {
    throw paymentError;
  }

  if (auditError) {
    throw auditError;
  }

  if (customerError) {
    throw customerError;
  }

  if (vendorError) {
    throw vendorError;
  }

  const invoices = (invoiceRows ?? []) as InvoiceInsightRow[];
  const bills = (billRows ?? []) as BillInsightRow[];
  const payments = (paymentRows ?? []) as PaymentInsightRow[];
  const audits = (auditRows ?? []) as AuditRow[];
  const customerNameById = new Map(((customerRows ?? []) as CustomerNameRow[]).map((row) => [row.id, row.name]));
  const vendorNameById = new Map(((vendorRows ?? []) as VendorNameRow[]).map((row) => [row.id, row.business_name]));

  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const dueWindowStart = startOfDay(today);
  const dueWindowEnd = addDays(dueWindowStart, 7);
  const openInvoices = invoices.filter((invoice) => invoice.status !== "paid" && invoice.status !== "cancelled" && Number(invoice.balance_due) > 0);
  const openBills = bills.filter((bill) => bill.status !== "paid" && Number(bill.balance_due) > 0);

  const totalReceivable = openInvoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);
  const totalPayable = openBills.reduce((sum, bill) => sum + Number(bill.balance_due ?? 0), 0);

  const dueThisWeekAll = openBills
    .filter((bill) => {
      if (!bill.due_date) {
        return false;
      }

      const dueDate = parseDateValue(bill.due_date);
      return isWithinInterval(dueDate, { end: dueWindowEnd, start: dueWindowStart });
    })
    .sort((left, right) => (left.due_date ?? "").localeCompare(right.due_date ?? ""));
  const dueThisWeek = dueThisWeekAll
    .slice(0, 5)
    .map((bill) => ({
      amount: Number(bill.balance_due ?? bill.total_amount ?? 0),
      billNumber: bill.bill_number,
      dueDate: bill.due_date ?? bill.bill_date,
      vendorName: vendorNameById.get(bill.vendor_id) ?? "Unknown Vendor",
    }));

  const overdueInvoices = openInvoices.filter((invoice) => {
    if (invoice.status === "overdue") {
      return true;
    }

    return invoice.due_date ? parseDateValue(invoice.due_date) < new Date() : false;
  });
  const overdueBills = openBills.filter((bill) => {
    if (bill.status === "overdue") {
      return true;
    }

    return bill.due_date ? parseDateValue(bill.due_date) < new Date() : false;
  });

  const completedReceivablePayments = payments.filter(
    (payment) => payment.payment_type === "receivable" && payment.status === "completed",
  );
  const completedPayablePayments = payments.filter(
    (payment) => payment.payment_type === "payable" && payment.status === "completed",
  );
  const completedPaystackReceivablePayments = completedReceivablePayments.filter(
    (payment) =>
      payment.gateway === "paystack" ||
      readMetadataString(payment.metadata, "source") === "paystack_public_link" ||
      readMetadataString(payment.metadata, "provider_status") === "success",
  );
  const completedInvoiceIds = new Set(
    completedReceivablePayments.map((payment) => payment.invoice_id).filter((id): id is string => Boolean(id)),
  );
  const completedBillIds = new Set(
    completedPayablePayments.map((payment) => payment.bill_id).filter((id): id is string => Boolean(id)),
  );

  const collectedThisMonthFromPayments = completedReceivablePayments.reduce((sum, payment) => {
    const paidOn = parseDateValue(payment.paid_on);
    return paidOn >= currentMonthStart ? sum + Number(payment.amount ?? 0) : sum;
  }, 0);
  const paystackCollectedThisMonth = completedPaystackReceivablePayments.reduce((sum, payment) => {
    const paidOn = parseDateValue(payment.paid_on);
    return paidOn >= currentMonthStart ? sum + Number(payment.amount ?? 0) : sum;
  }, 0);
  const confirmedReceivablePaymentsThisMonth = completedReceivablePayments.filter((payment) => {
    const paidOn = parseDateValue(payment.paid_on);
    return paidOn >= currentMonthStart;
  }).length;
  const collectedThisMonthFallback = invoices.reduce((sum, invoice) => {
    if (invoice.status !== "paid" || !invoice.paid_at || completedInvoiceIds.has(invoice.id)) {
      return sum;
    }

    const paidAt = parseDateValue(invoice.paid_at);
    return paidAt >= currentMonthStart ? sum + Number(invoice.amount_paid ?? 0) : sum;
  }, 0);

  const auditEntries = audits.map((entry) =>
    createActivityItem({
      action: entry.summary,
      createdAt: entry.created_at,
      detail: getDetailText(entry.detail),
      entityType: entry.entity_type,
      id: String(entry.id),
    }),
  );
  const recentActivity =
    auditEntries.length > 0 ? auditEntries.slice(0, 5) : createFallbackActivity(invoices, bills, payments, customerNameById, vendorNameById);

  const monthStarts = Array.from({ length: 6 }, (_, index) => startOfMonth(subMonths(today, 5 - index)));
  const monthBuckets = new Map(
    monthStarts.map((monthStart) => [
      format(monthStart, "yyyy-MM"),
      {
        billsPaid: 0,
        collected: 0,
        invoiced: 0,
        label: format(monthStart, "MMM yyyy"),
        payables: 0,
        receivables: 0,
      },
    ]),
  );

  for (const invoice of invoices) {
    const issueKey = format(parseDateValue(invoice.issue_date), "yyyy-MM");
    const bucket = monthBuckets.get(issueKey);

    if (bucket) {
      bucket.invoiced += Number(invoice.total_amount ?? 0);
      bucket.receivables += Number(invoice.total_amount ?? 0);
    }

    if (invoice.status === "paid" && invoice.paid_at && !completedInvoiceIds.has(invoice.id)) {
      const paidKey = format(parseDateValue(invoice.paid_at), "yyyy-MM");
      const paidBucket = monthBuckets.get(paidKey);

      if (paidBucket) {
        paidBucket.collected += Number(invoice.amount_paid ?? 0);
      }
    }
  }

  for (const bill of bills) {
    const billKey = format(parseDateValue(bill.bill_date), "yyyy-MM");
    const bucket = monthBuckets.get(billKey);

    if (bucket) {
      bucket.payables += Number(bill.total_amount ?? 0);
    }

    if (bill.status === "paid" && !completedBillIds.has(bill.id)) {
      const fallbackPaidDate = bill.scheduled_payment_date ?? bill.due_date ?? bill.updated_at ?? bill.bill_date;
      const paidBucket = monthBuckets.get(format(parseDateValue(fallbackPaidDate), "yyyy-MM"));

      if (paidBucket) {
        paidBucket.billsPaid += Number(bill.amount_paid ?? bill.total_amount ?? 0);
      }
    }
  }

  for (const payment of completedReceivablePayments) {
    const bucket = monthBuckets.get(format(parseDateValue(payment.paid_on), "yyyy-MM"));

    if (bucket) {
      bucket.collected += Number(payment.amount ?? 0);
    }
  }

  for (const payment of completedPayablePayments) {
    const bucket = monthBuckets.get(format(parseDateValue(payment.paid_on), "yyyy-MM"));

    if (bucket) {
      bucket.billsPaid += Number(payment.amount ?? 0);
    }
  }

  const cashFlowData = Array.from(monthBuckets.values()).map((bucket) => ({
    month: bucket.label,
    payables: bucket.payables,
    receivables: bucket.receivables,
  }));
  const monthlySummary = Array.from(monthBuckets.values()).map((bucket) => ({
    billsPaid: bucket.billsPaid,
    collected: bucket.collected,
    invoiced: bucket.invoiced,
    month: bucket.label,
    net: bucket.collected - bucket.billsPaid,
  }));
  const invoiceStatusOrder: Array<{ label: string; status: InvoiceInsightRow["status"] }> = [
    { label: "Paid", status: "paid" },
    { label: "Sent", status: "sent" },
    { label: "Overdue", status: "overdue" },
    { label: "Draft", status: "draft" },
    { label: "Cancelled", status: "cancelled" },
  ];
  const invoiceStatusData = invoiceStatusOrder
    .map(({ label, status }) => ({
      color: statusColors[status],
      name: label,
      value: invoices.filter((invoice) => invoice.status === status).length,
    }))
    .filter((item) => item.value > 0);

  return {
    auditEntries,
    dashboard: {
      collectedThisMonth: collectedThisMonthFromPayments + collectedThisMonthFallback,
      confirmedReceivablePaymentsThisMonth,
      dueThisWeek,
      dueThisWeekCount: dueThisWeekAll.length,
      openInvoices: openInvoices.length,
      overdueCount: overdueInvoices.length + overdueBills.length,
      paystackCollectedThisMonth,
      recentActivity,
      totalPayable,
      totalReceivable,
    },
    reports: {
      cashFlowData,
      collectionSummary: {
        confirmedReceivablePayments: completedReceivablePayments.length,
        paystackSettlements: completedPaystackReceivablePayments.length,
        totalCollected: collectedThisMonthFromPayments + collectedThisMonthFallback,
        totalPayablesSettled: completedPayablePayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0),
      },
      invoiceStatusData,
      monthlySummary,
      totalBills: bills.length,
      totalCustomers: customerRows.length,
      totalInvoices: invoices.length,
      totalVendors: vendorRows.length,
    },
  };
};

export const useOperationsData = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? operationsQueryKey(businessId) : ["operations", "missing-business"],
    queryFn: () => fetchOperationsData(businessId!),
    enabled: Boolean(businessId),
    ...operationsQueryOptions,
    ...liveOperationsQueryOptions,
  });
