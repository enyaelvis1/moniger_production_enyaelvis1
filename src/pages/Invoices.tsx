import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Copy, ExternalLink, Eye, Loader2, MessageCircle, MoreHorizontal, Pencil, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { addDays, format } from "date-fns";
import AppLayout from "@/components/app/AppLayout";
import DataPage from "@/components/app/DataPage";
import OperationStatusNotice, { type OperationStatusState } from "@/components/app/OperationStatusNotice";
import StatusBadge from "@/components/app/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomersDirectory } from "@/hooks/use-directory-data";
import {
  useInvoiceMutations,
  useInvoicesData,
  type FinanceLineItem,
  type InvoiceInput,
  type InvoiceRecord,
} from "@/hooks/use-finance-data";
import { useSendInvoiceDeliveryEmail } from "@/hooks/use-email-delivery";
import { useLocalization } from "@/hooks/use-localization";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useToast } from "@/hooks/use-toast";
import { useSearchParamState } from "@/hooks/use-search-param";
import { Button } from "@/components/ui/button";
import { AdvancedFilter } from "@/components/ui/advanced-filter";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNaira } from "@/data/seedData";
import { waitForUiFrame } from "@/lib/async";
import { createExportFileName, openPrintDocument } from "@/lib/export";
import { getFormFieldAriaProps } from "@/lib/accessibility";
import { buildInvoicePaymentUrl, buildInvoicePaymentWhatsAppUrl } from "@/lib/paystack-payments";
import {
  getStringFilterValue,
  isDateRangeFilterValue,
  isNumberRangeFilterValue,
  matchesDateRange,
  matchesNumberRange,
  type AdvancedFilterDefinition,
  type AdvancedFilterState,
} from "@/lib/advanced-filters";
import { createFormValidator, getFriendlyErrorMessage, ValidationRules } from "@/lib/error-handling";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import { Link, useNavigate } from "react-router-dom";

type SheetMode = "create" | "edit" | "view";
type InvoiceFormStep = "details" | "items" | "review";
type InvoiceFormState = {
  customerId: string;
  dueDate: string;
  invoiceNumber: string;
  issueDate: string;
  lineItems: FinanceLineItem[];
  notes: string;
  taxPercent: number;
};
type InvoiceFormErrors = Partial<Record<"customerId" | "dueDate" | "issueDate" | "lineItems", string>>;

type DeliveryDialogSource = "create" | "edit" | "table";
type DeliveryDialogContext = {
  invoice: InvoiceRecord | null;
  persistedInvoiceId: string | null;
  source: DeliveryDialogSource;
  targetStatus: InvoiceRecord["status"];
};

type InvoiceDeliveryFormState = {
  email: string;
  message: string;
  subject: string;
};
type InvoicePageActionStatus =
  | null
  | {
      action: "delivery" | "pdf";
      description: string;
      invoiceId: string | null;
      state: OperationStatusState;
      title: string;
    };
type InvoiceDialogStatus =
  | null
  | {
      description: string;
      state: OperationStatusState;
      title: string;
    };

const emptyLineItem = (): FinanceLineItem => ({
  description: "",
  qty: 1,
  unitPrice: 0,
});

const emptyDeliveryForm = (): InvoiceDeliveryFormState => ({
  email: "",
  message: "",
  subject: "",
});

const createInvoiceForm = (invoiceNumber: string): InvoiceFormState => ({
  customerId: "",
  dueDate: format(addDays(new Date(), 14), "yyyy-MM-dd"),
  invoiceNumber,
  issueDate: format(new Date(), "yyyy-MM-dd"),
  lineItems: [emptyLineItem()],
  notes: "",
  taxPercent: 0,
});

const invoiceFormValidator = createFormValidator({
  customerId: [ValidationRules.required()],
  dueDate: [ValidationRules.required("Choose a due date or use the default 14-day term.")],
  issueDate: [ValidationRules.required()],
});
const inputErrorClassName = "border-destructive focus-visible:ring-destructive";
const selectErrorClassName = "border-destructive focus:ring-destructive";
const inlineErrorClassName = "text-sm font-medium text-destructive";
const invoiceStepOrder: InvoiceFormStep[] = ["details", "items", "review"];
const invoiceStepMeta: Record<InvoiceFormStep, { description: string; index: number; title: string }> = {
  details: {
    description: "Customer and dates",
    index: 1,
    title: "Details",
  },
  items: {
    description: "Items and totals",
    index: 2,
    title: "Items",
  },
  review: {
    description: "Review and send",
    index: 3,
    title: "Review",
  },
};

const statusBadge = (status: InvoiceRecord["status"]) => {
  const map = {
    cancelled: { label: "Cancelled", variant: "dark" },
    draft: { label: "Draft", variant: "grey" },
    overdue: { label: "Overdue", variant: "red" },
    paid: { label: "Paid", variant: "green" },
    sent: { label: "Sent", variant: "blue" },
  } as const;
  const config = map[status];
  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
};

const normalizeOptionalText = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
};

const normalizeDeliveryMessage = (value: string) => value.replace(/\r\n/g, "\n").trim();
const normalizeDeliverySubject = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeEmailAddress = (value: string) => value.trim().toLowerCase();
const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const canPrepareInvoiceDelivery = (status: InvoiceRecord["status"]) => status !== "paid" && status !== "cancelled";
const canShareInvoicePaymentLink = (invoice: InvoiceRecord) =>
  invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.status !== "draft" && invoice.balanceDue > 0;
const getDeliveryTargetStatus = (status?: InvoiceRecord["status"] | null): InvoiceRecord["status"] =>
  status === "overdue" ? "overdue" : "sent";
const isResendAction = (invoice?: InvoiceRecord | null) =>
  Boolean(invoice && (invoice.deliveryAttemptCount > 0 || invoice.status === "sent" || invoice.status === "overdue"));
const getBackendDeliveryActionLabel = (invoice?: InvoiceRecord | null) =>
  isResendAction(invoice) ? "Resend Email" : "Send Email";
const getMailAppDeliveryActionLabel = (invoice?: InvoiceRecord | null) =>
  isResendAction(invoice) ? "Resend via Mail App" : "Open Mail App";

const buildInvoiceDeliveryDefaults = ({
  amount,
  businessName,
  customerEmail,
  customerName,
  dueDate,
  existingDeliveryEmail,
  existingDeliveryMessage,
  existingDeliverySubject,
  invoiceNumber,
  notes,
}: {
  amount: number;
  businessName: string;
  customerEmail?: string | null;
  customerName: string;
  dueDate?: string | null;
  existingDeliveryEmail?: string | null;
  existingDeliveryMessage?: string | null;
  existingDeliverySubject?: string | null;
  invoiceNumber: string;
  notes?: string | null;
}) => {
  const normalizedNotes = notes?.trim() ?? "";
  const amountLine = dueDate
    ? `The balance of ${formatNaira(amount)} is due on ${dueDate}.`
    : `The balance due is ${formatNaira(amount)}.`;

  return {
    email: existingDeliveryEmail || customerEmail || "",
    message:
      existingDeliveryMessage ||
      `Hello ${customerName},\n\nPlease find invoice ${invoiceNumber} from ${businessName}. ${amountLine}${
        normalizedNotes ? `\n\nNotes:\n${normalizedNotes}` : ""
      }\n\nThank you,\n${businessName}`,
    subject: existingDeliverySubject || `Invoice ${invoiceNumber} from ${businessName}`,
  };
};

const buildMailtoHref = ({ email, message, subject }: InvoiceDeliveryFormState) => {
  const parameters = [
    subject ? `subject=${encodeURIComponent(subject)}` : "",
    message ? `body=${encodeURIComponent(message)}` : "",
  ].filter(Boolean);

  return `mailto:${email}${parameters.length ? `?${parameters.join("&")}` : ""}`;
};

const getDeliverySummaryLabel = (invoice: InvoiceRecord) => {
  if (invoice.deliveryStatus === "failed") {
    return invoice.deliveryMethod === "backend_email" ? "Email failed" : "Needs attention";
  }

  if (invoice.deliveryStatus === "sent") {
    return invoice.deliveryAttemptCount > 1 ? "Resent by email" : "Sent by email";
  }

  if (invoice.deliveryStatus === "prepared") {
    return invoice.deliveryAttemptCount > 1 ? "Resend prepared" : "Prepared in mail app";
  }

  if (invoice.sentAt) {
    return "Legacy sent record";
  }

  return "Not prepared yet";
};

const getDeliveryMethodLabel = (invoice: InvoiceRecord) =>
  invoice.deliveryMethod === "backend_email" ? "Backend email" : "Mail app handoff";
const getPaymentLinkSummaryLabel = (invoice: InvoiceRecord) => {
  if (invoice.status === "paid" || invoice.balanceDue <= 0) {
    return "Settled";
  }

  if (!invoice.paymentLinkEnabled) {
    return "Not shared yet";
  }

  return "Live payment link";
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const getDeleteErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error, "Unable to delete invoice.");
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("violates foreign key constraint")) {
    return "This invoice already has linked records and cannot be deleted yet.";
  }

  return message;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) => (count === 1 ? singular : plural);

const calculateTotals = (lineItems: FinanceLineItem[], taxPercent: number) => {
  const validLineItems = lineItems.filter((item) => item.description.trim());
  const subtotal = validLineItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.qty) || 0) * Math.max(0, Number(item.unitPrice) || 0),
    0,
  );
  const normalizedTaxPercent = Math.max(0, Number(taxPercent) || 0);
  const taxAmount = subtotal * (normalizedTaxPercent / 100);
  const grandTotal = subtotal + taxAmount;

  return {
    grandTotal,
    subtotal,
    taxAmount,
    validLineItems,
  };
};

const generateNextDocumentNumber = (existingNumbers: string[], prefix: string, padLength: number) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matcher = new RegExp(`^${escapedPrefix}-(\\d+)$`);
  const highestNumber = existingNumbers.reduce((highest, numberValue) => {
    const match = matcher.exec(numberValue);
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]));
  }, 0);

  return `${prefix}-${String(highestNumber + 1).padStart(padLength, "0")}`;
};

const InvoicesPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { formatCurrency, formatDateTime, language, t } = useLocalization();
  const settingsQuery = useSettingsData(user?.id);
  const { subscription } = useWorkspaceSubscription();
  const businessId = settingsQuery.data?.business?.id;
  const businessName = settingsQuery.data?.business?.name ?? "Moniger Workspace";
  const customersQuery = useCustomersDirectory(businessId);
  const invoicesQuery = useInvoicesData(businessId);
  const { createInvoice, deleteInvoice, deliverInvoice, enableInvoicePaymentLink, updateInvoice, updateInvoiceStatus } = useInvoiceMutations(
    businessId,
    user?.id,
  );
  const sendInvoiceDeliveryEmail = useSendInvoiceDeliveryEmail(businessId, user?.id);

  const [search, setSearch] = useSearchParamState();
  const [tab, setTab] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [formStep, setFormStep] = useState<InvoiceFormStep>("details");
  const [hasTriedInvoiceStepAdvance, setHasTriedInvoiceStepAdvance] = useState(false);
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);
  const [savedDraftInvoiceId, setSavedDraftInvoiceId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(createInvoiceForm("INV-0001"));
  const [formErrors, setFormErrors] = useState<InvoiceFormErrors>({});
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>({});
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryDialogContext, setDeliveryDialogContext] = useState<DeliveryDialogContext | null>(null);
  const [deliveryForm, setDeliveryForm] = useState<InvoiceDeliveryFormState>(emptyDeliveryForm());
  const [pageActionStatus, setPageActionStatus] = useState<InvoicePageActionStatus>(null);
  const [deliveryDialogStatus, setDeliveryDialogStatus] = useState<InvoiceDialogStatus>(null);

  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const isStarterPlan = subscription?.plan === "starter";
  const starterInvoiceCount = useMemo(() => {
    if (!isStarterPlan) return 0;
    const startOfMonth = format(new Date(), "yyyy-MM-01");
    return invoices.filter((invoice) => invoice.issueDate >= startOfMonth && invoice.status !== "cancelled").length;
  }, [format, invoices, isStarterPlan]);
  const starterInvoiceLimitReached = isStarterPlan && starterInvoiceCount >= 10;
  const customerById = useMemo(() => new Map(customers.map((customer) => [customer.id, customer])), [customers]);
  const activeInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === activeInvoiceId) ?? null,
    [activeInvoiceId, invoices],
  );
  const activeCustomer = useMemo(() => customerById.get(form.customerId) ?? null, [customerById, form.customerId]);
  const nextNumber = useMemo(
    () => generateNextDocumentNumber(invoices.map((invoice) => invoice.invoiceNumber), "INV", 4),
    [invoices],
  );
  const advancedFilterDefinitions: AdvancedFilterDefinition[] = useMemo(
    () => [
      {
        emptyLabel: "All customers",
        id: "customerId",
        label: "Customer",
        options: customers.map((customer) => ({ label: customer.name, value: customer.id })),
        type: "select",
      },
      {
        fromLabel: "Issued from",
        id: "issueDate",
        label: "Issue Date",
        toLabel: "Issued to",
        type: "date-range",
      },
      {
        fromLabel: "Due from",
        id: "dueDate",
        label: "Due Date",
        toLabel: "Due to",
        type: "date-range",
      },
      {
        id: "amount",
        label: "Amount",
        maxPlaceholder: "10000000",
        minPlaceholder: "0",
        step: "0.01",
        type: "number-range",
      },
    ],
    [customers],
  );

  useEffect(() => {
    if (activeInvoiceId && !activeInvoice) {
      setActiveInvoiceId(null);
      setDrawerOpen(false);
      setFormStep("details");
      setHasTriedInvoiceStepAdvance(false);
    }
  }, [activeInvoice, activeInvoiceId]);

  const filtered = useMemo(() => {
    let list = invoices;
    const customerFilter = getStringFilterValue(advancedFilters.customerId);
    const issueDateRange = isDateRangeFilterValue(advancedFilters.issueDate) ? advancedFilters.issueDate : undefined;
    const dueDateRange = isDateRangeFilterValue(advancedFilters.dueDate) ? advancedFilters.dueDate : undefined;
    const amountRange = isNumberRangeFilterValue(advancedFilters.amount) ? advancedFilters.amount : undefined;

    if (tab !== "all") {
      list = list.filter((invoice) => invoice.status === tab);
    }

    list = list.filter((invoice) => {
      if (customerFilter && invoice.customerId !== customerFilter) {
        return false;
      }

      if (!matchesDateRange(invoice.issueDate, issueDateRange)) {
        return false;
      }

      if (!matchesDateRange(invoice.dueDate, dueDateRange)) {
        return false;
      }

      if (!matchesNumberRange(invoice.amount, amountRange)) {
        return false;
      }

      return true;
    });

    if (!search) {
      return list;
    }

    const normalizedSearch = search.toLowerCase();
    return list.filter(
      (invoice) =>
        invoice.invoiceNumber.toLowerCase().includes(normalizedSearch) ||
        invoice.customerName.toLowerCase().includes(normalizedSearch),
    );
  }, [advancedFilters.amount, advancedFilters.customerId, advancedFilters.dueDate, advancedFilters.issueDate, invoices, search, tab]);

  const tabs = useMemo(
    () => [
      { label: "All", count: invoices.length, value: "all" },
      { label: "Draft", count: invoices.filter((invoice) => invoice.status === "draft").length, value: "draft" },
      { label: "Sent", count: invoices.filter((invoice) => invoice.status === "sent").length, value: "sent" },
      { label: "Overdue", count: invoices.filter((invoice) => invoice.status === "overdue").length, value: "overdue" },
      { label: "Paid", count: invoices.filter((invoice) => invoice.status === "paid").length, value: "paid" },
    ],
    [invoices],
  );

  const { grandTotal, subtotal, taxAmount, validLineItems } = useMemo(
    () => calculateTotals(form.lineItems, form.taxPercent),
    [form.lineItems, form.taxPercent],
  );
  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isInvoicesLoading = invoicesQuery.isLoading && !invoicesQuery.data;
  const isCustomersLoading = customersQuery.isLoading && !customersQuery.data;
  const isMutating =
    createInvoice.isPending ||
    deleteInvoice.isPending ||
    deliverInvoice.isPending ||
    enableInvoicePaymentLink.isPending ||
    sendInvoiceDeliveryEmail.isPending ||
    updateInvoice.isPending ||
    updateInvoiceStatus.isPending;
  const isDeliverySubmitting =
    createInvoice.isPending || deliverInvoice.isPending || sendInvoiceDeliveryEmail.isPending || updateInvoice.isPending;
  const isReadOnly = sheetMode === "view";

  const openCreateDrawer = () => {
    if (starterInvoiceLimitReached) {
      navigate("/subscription");
      return;
    }
    setSheetMode("create");
    setFormStep("details");
    setActiveInvoiceId(null);
    setSavedDraftInvoiceId(null);
    setForm(createInvoiceForm(nextNumber));
    setFormErrors({});
    setHasTriedInvoiceStepAdvance(false);
    setDrawerOpen(true);
  };

  const openViewDrawer = (invoice: InvoiceRecord) => {
    setSheetMode("view");
    setFormStep("details");
    setActiveInvoiceId(invoice.id);
    setForm({
      customerId: invoice.customerId,
      dueDate: invoice.dueDate ?? "",
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      lineItems: invoice.lineItems.length ? invoice.lineItems.map((item) => ({ ...item })) : [emptyLineItem()],
      notes: invoice.notes,
      taxPercent: invoice.taxPercent,
    });
    setFormErrors({});
    setHasTriedInvoiceStepAdvance(false);
    setDrawerOpen(true);
  };

  const openEditDrawer = (invoice: InvoiceRecord) => {
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      toast({
        title: "Invoice locked",
        description: "Paid or cancelled invoices are view-only for now.",
      });
      return;
    }

    setSheetMode("edit");
    setFormStep("details");
    setActiveInvoiceId(invoice.id);
    setForm({
      customerId: invoice.customerId,
      dueDate: invoice.dueDate ?? "",
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      lineItems: invoice.lineItems.length ? invoice.lineItems.map((item) => ({ ...item })) : [emptyLineItem()],
      notes: invoice.notes,
      taxPercent: invoice.taxPercent,
    });
    setFormErrors({});
    setHasTriedInvoiceStepAdvance(false);
    setDrawerOpen(true);
  };

  const closeDeliveryDialog = () => {
    if (isDeliverySubmitting) {
      return;
    }

    setDeliveryDialogOpen(false);
    setDeliveryDialogContext(null);
    setDeliveryForm(emptyDeliveryForm());
    setDeliveryDialogStatus(null);
  };

  const closeDrawer = () => {
    if (isMutating) {
      return;
    }

    setDrawerOpen(false);
    setActiveInvoiceId(null);
    setSavedDraftInvoiceId(null);
    setSheetMode("create");
    setFormStep("details");
    setForm(createInvoiceForm(nextNumber));
    setFormErrors({});
    setHasTriedInvoiceStepAdvance(false);
    if (deliveryDialogContext?.source !== "table") {
      setDeliveryDialogOpen(false);
      setDeliveryDialogContext(null);
      setDeliveryForm(emptyDeliveryForm());
    }
  };

  const clearFormError = (field: keyof InvoiceFormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const addLineItem = () => {
    clearFormError("lineItems");
    setForm((currentForm) => ({ ...currentForm, lineItems: [...currentForm.lineItems, emptyLineItem()] }));
  };

  const updateLineItem = (index: number, field: keyof FinanceLineItem, value: number | string) => {
    clearFormError("lineItems");
    setForm((currentForm) => ({
      ...currentForm,
      lineItems: currentForm.lineItems.map((lineItem, itemIndex) =>
        itemIndex === index ? { ...lineItem, [field]: value } : lineItem,
      ),
    }));
  };

  const removeLineItem = (index: number) => {
    clearFormError("lineItems");
    setForm((currentForm) => ({
      ...currentForm,
      lineItems:
        currentForm.lineItems.length <= 1
          ? currentForm.lineItems
          : currentForm.lineItems.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const buildPayload = (
    status: InvoiceRecord["status"],
    options: Partial<Pick<InvoiceInput, "delivery_email" | "delivery_message" | "delivery_subject" | "record_delivery_attempt">> = {},
  ) => ({
    customer_id: form.customerId,
    delivery_email: options.delivery_email,
    delivery_message: options.delivery_message,
    delivery_subject: options.delivery_subject,
    due_date: normalizeOptionalText(form.dueDate),
    invoice_number: form.invoiceNumber,
    issue_date: form.issueDate,
    line_items: validLineItems.map((item) => ({
      description: item.description.trim(),
      qty: Math.max(0, Number(item.qty) || 0),
      unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    })),
    notes: normalizeOptionalText(form.notes),
    record_delivery_attempt: options.record_delivery_attempt,
    status,
    tax_percent: Math.max(0, Number(form.taxPercent) || 0),
  });

  const validateForm = (): InvoiceFormErrors => {
    const errors = invoiceFormValidator({
      customerId: form.customerId,
      dueDate: form.dueDate,
      issueDate: form.issueDate,
    }) as InvoiceFormErrors;

    if (validLineItems.length === 0) {
      errors.lineItems = "Add at least one line item with a description.";
    } else if (validLineItems.some((item) => item.qty <= 0)) {
      errors.lineItems = "Each line item quantity must be greater than zero.";
    }

    return errors;
  };

  const getInvoiceStepErrors = (step: InvoiceFormStep): InvoiceFormErrors => {
    const validationErrors = validateForm();

    if (step === "details") {
      return {
        customerId: validationErrors.customerId,
        dueDate: validationErrors.dueDate,
        issueDate: validationErrors.issueDate,
      };
    }

    if (step === "items") {
      return {
        lineItems: validationErrors.lineItems,
      };
    }

    return validationErrors;
  };

  const goToInvoiceStep = (nextStep: InvoiceFormStep) => {
    const currentStepIndex = invoiceStepOrder.indexOf(formStep);
    const nextStepIndex = invoiceStepOrder.indexOf(nextStep);

    if (nextStepIndex <= currentStepIndex) {
      setFormStep(nextStep);
      return;
    }

    setHasTriedInvoiceStepAdvance(true);
    const stepErrors = getInvoiceStepErrors(formStep);
    const hasErrors = Object.values(stepErrors).some(Boolean);

    if (hasErrors) {
      setFormErrors((currentErrors) => ({ ...currentErrors, ...stepErrors }));
      return;
    }

    setFormErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      if (formStep === "details") {
        delete nextErrors.customerId;
        delete nextErrors.issueDate;
      }
      if (formStep === "items") {
        delete nextErrors.lineItems;
      }
      return nextErrors;
    });
    setFormStep(nextStep);
    setHasTriedInvoiceStepAdvance(false);
  };

  const openDeliveryDialogForForm = () => {
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setHasTriedInvoiceStepAdvance(true);
      setFormErrors(validationErrors);
      return;
    }

    setDeliveryForm(
      buildInvoiceDeliveryDefaults({
        amount: grandTotal,
        businessName,
        customerEmail: activeInvoice?.deliveryEmail || activeCustomer?.email || "",
        customerName: activeInvoice?.customerName ?? activeCustomer?.name ?? "there",
        dueDate: normalizeOptionalText(form.dueDate),
        existingDeliveryEmail: activeInvoice?.deliveryEmail,
        existingDeliveryMessage: activeInvoice?.deliveryMessage,
        existingDeliverySubject: activeInvoice?.deliverySubject,
        invoiceNumber: form.invoiceNumber,
        notes: form.notes,
      }),
    );
    setDeliveryDialogStatus(null);
    setDeliveryDialogContext({
      invoice: activeInvoice,
      persistedInvoiceId: activeInvoice?.id ?? savedDraftInvoiceId,
      source: sheetMode === "edit" ? "edit" : "create",
      targetStatus: getDeliveryTargetStatus(activeInvoice?.status),
    });
    setDeliveryDialogOpen(true);
  };

  const openDeliveryDialogForInvoice = (invoice: InvoiceRecord) => {
    if (!canPrepareInvoiceDelivery(invoice.status)) {
      toast({
        title: "Invoice locked",
        description: "Paid or cancelled invoices cannot be sent again.",
      });
      return;
    }

    const customer = customerById.get(invoice.customerId);

    setDeliveryForm(
      buildInvoiceDeliveryDefaults({
        amount: invoice.amount,
        businessName,
        customerEmail: invoice.deliveryEmail || customer?.email || "",
        customerName: invoice.customerName,
        dueDate: invoice.dueDate,
        existingDeliveryEmail: invoice.deliveryEmail,
        existingDeliveryMessage: invoice.deliveryMessage,
        existingDeliverySubject: invoice.deliverySubject,
        invoiceNumber: invoice.invoiceNumber,
        notes: invoice.notes,
      }),
    );
    setDeliveryDialogStatus(null);
    setDeliveryDialogContext({
      invoice,
      persistedInvoiceId: invoice.id,
      source: "table",
      targetStatus: getDeliveryTargetStatus(invoice.status),
    });
    setDeliveryDialogOpen(true);
  };

  const handleSaveInvoice = async (
    targetStatus: InvoiceRecord["status"],
    options: Partial<Pick<InvoiceInput, "delivery_email" | "delivery_message" | "delivery_subject" | "record_delivery_attempt">> = {},
  ) => {
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setHasTriedInvoiceStepAdvance(true);
      setFormErrors(validationErrors);
      setFormStep(validationErrors.lineItems ? "items" : "details");
      return;
    }

    try {
      if (sheetMode === "edit" && activeInvoice) {
        await updateInvoice.mutateAsync({
          invoice: activeInvoice,
          values: buildPayload(targetStatus, options),
        });
        toast({
          title: "Invoice updated",
          description: `${form.invoiceNumber} has been saved.`,
        });
      } else {
        await createInvoice.mutateAsync(buildPayload(targetStatus, options));
        toast({
          title: targetStatus === "sent" ? "Invoice sent" : "Draft saved",
          description: `${form.invoiceNumber} has been created.`,
        });
      }

      setFormErrors({});
      closeDrawer();
    } catch (error) {
      toast({
        title: sheetMode === "edit" ? "Unable to update invoice" : "Unable to create invoice",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleDeliverInvoice = async (method: "backend_email" | "mail_app" = "backend_email") => {
    if (!deliveryDialogContext) {
      return;
    }

    const normalizedEmail = normalizeEmailAddress(deliveryForm.email);
    const normalizedSubject = normalizeDeliverySubject(deliveryForm.subject);
    const normalizedMessage = normalizeDeliveryMessage(deliveryForm.message);

    if (!isValidEmailAddress(normalizedEmail)) {
      toast({
        title: "Valid email required",
        description: "Enter the recipient email address before continuing.",
        variant: "destructive",
      });
      return;
    }

    if (!normalizedSubject) {
      toast({
        title: "Subject required",
        description:
          method === "backend_email"
            ? "Add an email subject before sending the invoice."
            : "Add an email subject before opening your mail app.",
        variant: "destructive",
      });
      return;
    }

    const preparedDelivery = {
      email: normalizedEmail,
      message: normalizedMessage,
      subject: normalizedSubject,
    };
    const mailtoHref = buildMailtoHref(preparedDelivery);
    const actionLabel =
      method === "backend_email"
        ? getBackendDeliveryActionLabel(deliveryDialogContext.invoice)
        : getMailAppDeliveryActionLabel(deliveryDialogContext.invoice);
    const deliveryOptions = {
      delivery_email: normalizedEmail,
      delivery_message: normalizedMessage || null,
      delivery_subject: normalizedSubject,
      record_delivery_attempt: true,
    } as const;
    let persistedInvoiceId = deliveryDialogContext.invoice?.id ?? deliveryDialogContext.persistedInvoiceId;
    let draftSavedBeforeSend = false;

    setDeliveryDialogStatus({
      description:
        method === "backend_email"
          ? "We are saving the delivery record and sending the invoice from moniger.net."
          : "We are updating the invoice delivery record and preparing your mail app handoff.",
      state: "running",
      title: actionLabel,
    });
    await waitForUiFrame();

    try {
      if (method === "backend_email") {
        if (deliveryDialogContext.source === "edit" && deliveryDialogContext.invoice) {
          const updatedInvoice = await updateInvoice.mutateAsync({
            invoice: deliveryDialogContext.invoice,
            values: buildPayload(deliveryDialogContext.invoice.status === "draft" ? "draft" : deliveryDialogContext.targetStatus, {
              ...deliveryOptions,
              record_delivery_attempt: false,
            }),
          });
          persistedInvoiceId = updatedInvoice.id;
        } else if (deliveryDialogContext.source === "create" && !persistedInvoiceId) {
          const createdInvoice = await createInvoice.mutateAsync(
            buildPayload("draft", {
              ...deliveryOptions,
              record_delivery_attempt: false,
            }),
          );
          persistedInvoiceId = createdInvoice.id;
          draftSavedBeforeSend = true;
          setSavedDraftInvoiceId(createdInvoice.id);
          setDeliveryDialogContext((currentContext) =>
            currentContext
              ? {
                  ...currentContext,
                  persistedInvoiceId: createdInvoice.id,
                }
              : currentContext,
          );
        }

        if (!persistedInvoiceId) {
          throw new Error("We could not determine which invoice to send.");
        }

        await sendInvoiceDeliveryEmail.mutateAsync({
          businessId: businessId!,
          email: normalizedEmail,
          invoiceId: persistedInvoiceId,
          message: normalizedMessage || null,
          subject: normalizedSubject,
        });
      } else if (deliveryDialogContext.source === "table" && deliveryDialogContext.invoice) {
        const deliveredInvoice = await deliverInvoice.mutateAsync({
          delivery: {
            ...preparedDelivery,
            method: "mail_app",
          },
          invoice: deliveryDialogContext.invoice,
        });
        persistedInvoiceId = deliveredInvoice.id;
      } else if (deliveryDialogContext.source === "edit" && deliveryDialogContext.invoice) {
        const updatedInvoice = await updateInvoice.mutateAsync({
          invoice: deliveryDialogContext.invoice,
          values: buildPayload(deliveryDialogContext.targetStatus, deliveryOptions),
        });
        persistedInvoiceId = updatedInvoice.id;
      } else {
        const createdInvoice = await createInvoice.mutateAsync(buildPayload(deliveryDialogContext.targetStatus, deliveryOptions));
        persistedInvoiceId = createdInvoice.id;
      }

      setPageActionStatus({
        action: "delivery",
        description:
          method === "backend_email"
            ? `Invoice email sent to ${normalizedEmail}.`
            : "Your default mail app has been opened. Attach the exported PDF before sending if needed.",
        invoiceId: persistedInvoiceId ?? null,
        state: "success",
        title: actionLabel,
      });
      closeDeliveryDialog();
      if (deliveryDialogContext.source !== "table") {
        closeDrawer();
      }
      if (method === "mail_app") {
        window.location.assign(mailtoHref);
      } else {
        toast({
          title: actionLabel,
          description: `Invoice email sent to ${normalizedEmail}.`,
        });
      }
    } catch (error) {
      setDeliveryDialogStatus({
        description:
          draftSavedBeforeSend && method === "backend_email"
            ? `${getErrorMessage(error, "Please try again.")} The invoice draft was saved, so you can retry from the invoice list.`
            : getErrorMessage(error, "Please try again."),
        state: "error",
        title: method === "backend_email" ? "Unable to send email" : "Unable to prepare delivery",
      });
    }
  };

  const currentInvoiceStepErrors = getInvoiceStepErrors(formStep);
  const currentInvoiceStepMessage =
    (hasTriedInvoiceStepAdvance ? Object.values(currentInvoiceStepErrors).find((value): value is string => Boolean(value)) : undefined) ??
    (formStep === "details"
      ? "Choose a customer and due date first. The invoice number and issue date are generated for you."
      : formStep === "items"
        ? "Add at least one billable line item before moving to review."
        : "Everything looks ready. Review the totals and send when you are confident.");

  const handleDeleteInvoice = async (invoice: InvoiceRecord) => {
    if (invoice.status !== "draft" && invoice.status !== "cancelled") {
      toast({
        title: "Invoice locked",
        description: "Only draft or cancelled invoices can be deleted.",
      });
      return;
    }

    const confirmed = window.confirm(`Delete ${invoice.invoiceNumber}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteInvoice.mutateAsync({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
      toast({
        title: "Invoice deleted",
        description: `${invoice.invoiceNumber} has been removed.`,
      });
    } catch (error) {
      toast({
        title: "Unable to delete invoice",
        description: getDeleteErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (invoice: InvoiceRecord, status: InvoiceRecord["status"]) => {
    try {
      await updateInvoiceStatus.mutateAsync({ invoice, status });
      toast({
        title: "Invoice updated",
        description: `${invoice.invoiceNumber} is now ${status}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to update invoice",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleBulkInvoiceStatusChange = async (
    selectedInvoices: InvoiceRecord[],
    status: Extract<InvoiceRecord["status"], "cancelled" | "paid">,
    clearSelection: () => void,
  ) => {
    const eligibleInvoices = selectedInvoices.filter((invoice) => {
      if (status === "paid") {
        return invoice.status !== "paid" && invoice.status !== "cancelled";
      }

      return invoice.status !== "paid" && invoice.status !== "cancelled";
    });

    if (eligibleInvoices.length === 0) {
      toast({
        title: "No invoices updated",
        description: `None of the selected invoices can be marked as ${status}.`,
      });
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;
    let firstError: unknown;

    for (const invoice of eligibleInvoices) {
      try {
        await updateInvoiceStatus.mutateAsync({ invoice, status });
        updatedCount += 1;
      } catch (error) {
        failedCount += 1;
        firstError ??= error;
      }
    }

    if (updatedCount > 0) {
      clearSelection();
    }

    const skippedCount = selectedInvoices.length - eligibleInvoices.length;
    if (failedCount > 0 && updatedCount === 0) {
      toast({
        title: "Bulk update failed",
        description: getErrorMessage(firstError, "Please try again."),
        variant: "destructive",
      });
      return;
    }

    const descriptionParts = [`${updatedCount} ${pluralize(updatedCount, "invoice")} updated`];
    if (skippedCount > 0) {
      descriptionParts.push(`${skippedCount} skipped`);
    }
    if (failedCount > 0) {
      descriptionParts.push(`${failedCount} failed`);
    }

    toast({
      title: failedCount > 0 ? "Bulk update partially completed" : "Invoices updated",
      description: descriptionParts.join(", "),
      variant: failedCount > 0 ? "destructive" : "default",
    });
  };

  const handleBulkInvoiceDelete = async (selectedInvoices: InvoiceRecord[], clearSelection: () => void) => {
    const deletableInvoices = selectedInvoices.filter(
      (invoice) => invoice.status === "draft" || invoice.status === "cancelled",
    );

    if (deletableInvoices.length === 0) {
      toast({
        title: "No invoices deleted",
        description: "Only draft or cancelled invoices can be deleted.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${deletableInvoices.length} ${pluralize(deletableInvoices.length, "invoice")}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    let deletedCount = 0;
    let failedCount = 0;
    let firstError: unknown;

    for (const invoice of deletableInvoices) {
      try {
        await deleteInvoice.mutateAsync({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber });
        deletedCount += 1;
      } catch (error) {
        failedCount += 1;
        firstError ??= error;
      }
    }

    if (deletedCount > 0) {
      clearSelection();
    }

    const skippedCount = selectedInvoices.length - deletableInvoices.length;
    if (failedCount > 0 && deletedCount === 0) {
      toast({
        title: "Bulk delete failed",
        description: getDeleteErrorMessage(firstError),
        variant: "destructive",
      });
      return;
    }

    const descriptionParts = [`${deletedCount} ${pluralize(deletedCount, "invoice")} deleted`];
    if (skippedCount > 0) {
      descriptionParts.push(`${skippedCount} skipped`);
    }
    if (failedCount > 0) {
      descriptionParts.push(`${failedCount} failed`);
    }

    toast({
      title: failedCount > 0 ? "Bulk delete partially completed" : "Invoices deleted",
      description: descriptionParts.join(", "),
      variant: failedCount > 0 ? "destructive" : "default",
    });
  };

  const handleDownloadInvoicePdf = async (invoice: InvoiceRecord) => {
    if (isStarterPlan) {
      toast({
        title: "PDF export is a paid-plan feature",
        description: "Upgrade to Growth or Business to download invoice PDFs.",
      });
      navigate("/subscription");
      return;
    }

    const invoiceTotals = calculateTotals(invoice.lineItems, invoice.taxPercent);

    setPageActionStatus({
      action: "pdf",
      description: `We are preparing a print-ready PDF export for ${invoice.invoiceNumber}.`,
      invoiceId: invoice.id,
      state: "running",
      title: "Preparing invoice export",
    });
    await waitForUiFrame();

    try {
      openPrintDocument({
        eyebrowLabel: t("export.eyebrow"),
        fileName: createExportFileName(invoice.invoiceNumber),
        generatedAtLabel: t("export.generatedAt", { timestamp: formatDateTime(new Date()) }),
        htmlLang: language,
        metadata: [
          { label: "Workspace", value: businessName },
          { label: "Invoice Number", value: invoice.invoiceNumber },
          { label: "Customer", value: invoice.customerName },
          { label: "Status", value: invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1) },
          { label: "Issue Date", value: invoice.issueDate },
          { label: "Due Date", value: invoice.dueDate ?? "Not set" },
        ],
        sections: [
          {
            table: {
              columns: ["Description", "Qty", "Unit Price", "Line Total"],
              rows:
                invoiceTotals.validLineItems.length > 0
                  ? invoiceTotals.validLineItems.map((item) => [
                      item.description,
                      String(item.qty),
                      formatCurrency(item.unitPrice),
                      formatCurrency((Number(item.qty) || 0) * (Number(item.unitPrice) || 0)),
                    ])
                  : [["No line items yet", "", "", ""]],
            },
            title: "Line Items",
          },
          {
            rows: [
              { label: "Subtotal", value: formatCurrency(invoiceTotals.subtotal) },
              { label: `Tax (${invoice.taxPercent}%)`, value: formatCurrency(invoiceTotals.taxAmount) },
              { label: "Total", value: formatCurrency(invoiceTotals.grandTotal) },
              { label: "Amount Paid", value: formatCurrency(invoice.amountPaid) },
              { label: "Balance Due", value: formatCurrency(invoice.balanceDue) },
            ],
            title: "Totals",
          },
          ...(invoice.notes
            ? [
                {
                  text: [invoice.notes],
                  title: "Notes",
                },
              ]
            : []),
        ],
        subtitle: `Printable invoice for ${invoice.customerName}`,
        title: `Invoice ${invoice.invoiceNumber}`,
      });
      setPageActionStatus({
        action: "pdf",
        description: `Invoice ${invoice.invoiceNumber} opened in a print-ready browser window.`,
        invoiceId: invoice.id,
        state: "success",
        title: "Invoice export ready",
      });
    } catch (error) {
      setPageActionStatus({
        action: "pdf",
        description: getErrorMessage(error, "Please allow popups and try again."),
        invoiceId: invoice.id,
        state: "error",
        title: "Unable to export invoice",
      });
    }
  };

  const resolveInvoicePaymentLink = async (invoice: InvoiceRecord) => {
    if (!canShareInvoicePaymentLink(invoice)) {
      throw new Error("Only sent or overdue invoices with an outstanding balance can be shared for payment.");
    }

    const paymentPublicToken =
      invoice.paymentLinkEnabled && invoice.paymentPublicToken
        ? invoice.paymentPublicToken
        : (await enableInvoicePaymentLink.mutateAsync({ invoice })).paymentPublicToken;

    return buildInvoicePaymentUrl(paymentPublicToken);
  };

  const copyTextToClipboard = async (value: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    window.prompt("Copy this payment link", value);
  };

  const handleCopyPaymentLink = async (invoice: InvoiceRecord) => {
    try {
      const paymentUrl = await resolveInvoicePaymentLink(invoice);
      await copyTextToClipboard(paymentUrl);
      toast({
        title: "Payment link copied",
        description: `${invoice.invoiceNumber} is ready to share.`,
      });
    } catch (error) {
      toast({
        title: "Unable to copy payment link",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleOpenPaymentLink = async (invoice: InvoiceRecord) => {
    try {
      const paymentUrl = await resolveInvoicePaymentLink(invoice);
      window.open(paymentUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "Unable to open payment link",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleSharePaymentLinkOnWhatsApp = async (invoice: InvoiceRecord) => {
    try {
      const paymentUrl = await resolveInvoicePaymentLink(invoice);
      const whatsappUrl = buildInvoicePaymentWhatsAppUrl({
        amountLabel: formatCurrency(invoice.balanceDue),
        invoiceNumber: invoice.invoiceNumber,
        paymentUrl,
      });
      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "Unable to open WhatsApp share",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const retryPageAction = () => {
    if (!pageActionStatus || pageActionStatus.state !== "error" || pageActionStatus.action !== "pdf" || !pageActionStatus.invoiceId) {
      return;
    }

    const invoice = invoices.find((currentInvoice) => currentInvoice.id === pageActionStatus.invoiceId);
    if (!invoice) {
      return;
    }

    void handleDownloadInvoicePdf(invoice);
  };

  const columns = [
    {
      key: "invoiceNumber",
      header: "Invoice #",
      render: (row: InvoiceRecord) => <span className="font-medium text-foreground">{row.invoiceNumber}</span>,
    },
    { key: "customer", header: "Customer", render: (row: InvoiceRecord) => row.customerName },
    { key: "issueDate", header: "Issue Date", render: (row: InvoiceRecord) => row.issueDate },
    { key: "dueDate", header: "Due Date", render: (row: InvoiceRecord) => row.dueDate || "-" },
    { key: "amount", header: "Amount", render: (row: InvoiceRecord) => <span className="font-medium">{formatNaira(row.amount)}</span> },
    { key: "status", header: "Status", render: (row: InvoiceRecord) => statusBadge(row.status) },
    {
      key: "actions",
      header: "Actions",
      render: (row: InvoiceRecord) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              openViewDrawer(row);
            }}
            aria-label={`View invoice ${row.invoiceNumber}`}
          >
            <Eye size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              openEditDrawer(row);
            }}
            aria-label={`Edit invoice ${row.invoiceNumber}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              openDeliveryDialogForInvoice(row);
            }}
            disabled={!canPrepareInvoiceDelivery(row.status)}
            aria-label={`${getBackendDeliveryActionLabel(row)} for invoice ${row.invoiceNumber}`}
          >
            <Send size={14} aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Open actions for invoice ${row.invoiceNumber}`}
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openDeliveryDialogForInvoice(row)} disabled={!canPrepareInvoiceDelivery(row.status)}>
                {getBackendDeliveryActionLabel(row)}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleCopyPaymentLink(row)} disabled={!canShareInvoicePaymentLink(row)}>
                Copy Payment Link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleSharePaymentLinkOnWhatsApp(row)} disabled={!canShareInvoicePaymentLink(row)}>
                Share via WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleOpenPaymentLink(row)} disabled={!canShareInvoicePaymentLink(row)}>
                Open Payment Page
              </DropdownMenuItem>
              {!isStarterPlan ? (
                <DropdownMenuItem onClick={() => void handleDownloadInvoicePdf(row)}>
                  Download PDF
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => void handleStatusChange(row, "paid")}
                disabled={row.status === "paid" || row.status === "cancelled"}
              >
                Mark as Paid
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleStatusChange(row, "cancelled")}
                className="text-destructive"
                disabled={row.status === "paid" || row.status === "cancelled"}
              >
                Cancel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleDeleteInvoice(row)} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="page-enter space-y-6">
        {settingsQuery.error ? (
          <OperationStatusNotice
            title="Workspace unavailable"
            description={getErrorMessage(settingsQuery.error, "We could not load your workspace.")}
            state="error"
            onRetry={() => void settingsQuery.refetch()}
            retryLabel="Retry workspace"
          />
        ) : null}

        {invoicesQuery.error ? (
          <OperationStatusNotice
            title="Invoices unavailable"
            description={getErrorMessage(invoicesQuery.error, "We could not load your invoices right now.")}
            state="error"
            onRetry={() => void invoicesQuery.refetch()}
            retryLabel="Retry invoices"
          />
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Invoices will appear here once the business record is available.
          </div>
        ) : null}

        {pageActionStatus ? (
          <OperationStatusNotice
            description={pageActionStatus.description}
            state={pageActionStatus.state}
            title={pageActionStatus.title}
            onRetry={pageActionStatus.state === "error" && pageActionStatus.action === "pdf" ? retryPageAction : undefined}
            retryLabel="Retry invoice export"
          />
        ) : null}

        {isStarterPlan ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p>
                Starter includes up to 10 invoices per calendar month ({Math.min(starterInvoiceCount, 10)}/10 used).
                Advanced filters and PDF exports are available on paid plans.
              </p>
              <Link to="/subscription" className="shrink-0 font-semibold text-primary hover:underline">View plans</Link>
            </div>
          </div>
        ) : null}

        <div className="space-y-6">
          {drawerOpen ? (
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 xl:p-8">
              <div className="sticky top-0 z-20 -mx-5 border-b border-border bg-card/95 px-5 pb-5 pt-4 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:-mx-6 sm:px-6 xl:mx-0 xl:bg-card/95 xl:px-0 xl:pt-0 xl:backdrop-blur-0">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-secondary">Invoice workspace</p>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {sheetMode === "create"
                        ? "Create Invoice"
                        : sheetMode === "edit"
                          ? `Edit ${form.invoiceNumber}`
                          : `Invoice ${form.invoiceNumber}`}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Manage customer, line items, totals, and delivery details without leaving the page.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 xl:hidden">
                  {invoiceStepOrder.map((step, index) => {
                    const stepIndex = invoiceStepOrder.indexOf(step);
                    const activeStepIndex = invoiceStepOrder.indexOf(formStep);
                    const isActive = formStep === step;
                    const isComplete = stepIndex < activeStepIndex;
                    const canJump = stepIndex <= activeStepIndex + 1;

                    return (
                      <div key={step} className="flex min-w-0 flex-1 items-center">
                        <button
                          type="button"
                          onClick={() => goToInvoiceStep(step)}
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : isComplete
                                ? "bg-secondary/15 text-secondary"
                                : "bg-muted text-muted-foreground"
                          }`}
                          aria-current={isActive ? "step" : undefined}
                          aria-label={`Go to step ${invoiceStepMeta[step].index}: ${invoiceStepMeta[step].description}`}
                          disabled={!canJump && !isComplete}
                        >
                          {invoiceStepMeta[step].index}
                        </button>
                        {index < invoiceStepOrder.length - 1 ? (
                          <div
                            className={`mx-2 h-[2px] min-w-0 flex-1 rounded-full ${
                              stepIndex < activeStepIndex ? "bg-primary/40" : "bg-border"
                            }`}
                            aria-hidden="true"
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <div className="hidden gap-2 xl:grid xl:grid-cols-3">
                  {invoiceStepOrder.map((step) => {
                    const stepIndex = invoiceStepOrder.indexOf(step);
                    const activeStepIndex = invoiceStepOrder.indexOf(formStep);
                    const isActive = formStep === step;
                    const isComplete = stepIndex < activeStepIndex;
                    const canJump = stepIndex <= activeStepIndex + 1;

                    return (
                      <button
                        key={step}
                        type="button"
                        onClick={() => goToInvoiceStep(step)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          isActive
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : isComplete
                              ? "border-secondary/30 bg-secondary/10 hover:border-secondary/50"
                              : "border-border bg-background hover:border-primary/30"
                        }`}
                        aria-current={isActive ? "step" : undefined}
                        disabled={!canJump && !isComplete}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              Step {invoiceStepMeta[step].index}
                            </p>
                            <p className={`mt-1 text-sm font-semibold ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                              {invoiceStepMeta[step].title}
                            </p>
                            <p className={`text-sm ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                              {invoiceStepMeta[step].description}
                            </p>
                          </div>
                          <div
                            className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border ${
                              isActive
                                ? "border-primary-foreground/40 bg-primary-foreground/10"
                                : isComplete
                                  ? "border-secondary/30 bg-secondary/10 text-secondary"
                                  : "border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-semibold">{invoiceStepMeta[step].index}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {formStep !== "review" ? (
                  <Button
                    type="button"
                    onClick={() => goToInvoiceStep(formStep === "details" ? "items" : "review")}
                    disabled={isMutating}
                    className="shrink-0 rounded-xl px-4"
                  >
                    {formStep === "details" ? "Next: Items" : "Next: Review"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-6 pb-28">
                  {formStep === "details" ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2 lg:col-span-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="invoice-customer">Customer</Label>
                          {!isReadOnly ? (
                            <Link
                              to="/customers"
                              className="inline-flex items-center gap-1.5 rounded-lg border-2 border-primary bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-primary hover:text-primary-foreground"
                            >
                              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                              Create customer
                            </Link>
                          ) : null}
                        </div>
                        <Select
                          value={form.customerId}
                          onValueChange={(value) => {
                            clearFormError("customerId");
                            setForm((currentForm) => ({ ...currentForm, customerId: value }));
                          }}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger
                            {...getFormFieldAriaProps({
                              error: formErrors.customerId,
                              id: "invoice-customer",
                              required: true,
                            })}
                            className={`rounded-lg ${formErrors.customerId ? selectErrorClassName : ""}`}
                          >
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formErrors.customerId ? (
                          <p id="invoice-customer-error" className={inlineErrorClassName} role="alert">
                            {formErrors.customerId}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice-number">Invoice # <span className="font-normal text-muted-foreground">(automatic)</span></Label>
                        <Input id="invoice-number" value={form.invoiceNumber} disabled className="rounded-lg bg-muted" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice-issue-date">Issue Date</Label>
                        <Input
                          {...getFormFieldAriaProps({
                            error: formErrors.issueDate,
                            id: "invoice-issue-date",
                            required: true,
                          })}
                          type="date"
                          value={form.issueDate}
                          onChange={(event) => {
                            clearFormError("issueDate");
                            setForm((currentForm) => ({ ...currentForm, issueDate: event.target.value }));
                          }}
                          className={`rounded-lg ${formErrors.issueDate ? inputErrorClassName : ""}`}
                          disabled={isReadOnly}
                        />
                        {formErrors.issueDate ? (
                          <p id="invoice-issue-date-error" className={inlineErrorClassName} role="alert">
                            {formErrors.issueDate}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="invoice-due-date">Due Date <span className="text-destructive">*</span></Label>
                        <Input
                          id="invoice-due-date"
                          type="date"
                          value={form.dueDate}
                          onChange={(event) => {
                            clearFormError("dueDate");
                            setForm((currentForm) => ({ ...currentForm, dueDate: event.target.value }));
                          }}
                          className={`rounded-lg ${formErrors.dueDate ? inputErrorClassName : ""}`}
                          disabled={isReadOnly}
                        />
                        {formErrors.dueDate ? <p className={inlineErrorClassName} role="alert">{formErrors.dueDate}</p> : null}
                      </div>

                      <div className="space-y-2 lg:col-span-2">
                        <Label>Notes (optional)</Label>
                        <Textarea
                          value={form.notes}
                          onChange={(event) => setForm((currentForm) => ({ ...currentForm, notes: event.target.value }))}
                          className="min-h-[140px] rounded-lg"
                          rows={5}
                          disabled={isReadOnly}
                        />
                      </div>
                    </div>
                  ) : null}

                  {formStep === "items" ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="invoice-line-item-description-0">Line Items</Label>
                        <div className="space-y-2">
                          {form.lineItems.map((lineItem, index) => (
                            <div
                              key={`${index}-${lineItem.id ?? "new"}`}
                              className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_96px_160px_auto] lg:items-end"
                            >
                              <Input
                                id={`invoice-line-item-description-${index}`}
                                aria-describedby={formErrors.lineItems ? "invoice-line-items-error" : undefined}
                                aria-invalid={!!formErrors.lineItems}
                                placeholder="Description"
                                value={lineItem.description}
                                onChange={(event) => updateLineItem(index, "description", event.target.value)}
                                className={`rounded-lg ${formErrors.lineItems ? inputErrorClassName : ""}`}
                                disabled={isReadOnly}
                              />
                              <Input
                                aria-describedby={formErrors.lineItems ? "invoice-line-items-error" : undefined}
                                aria-invalid={!!formErrors.lineItems}
                                type="number"
                                placeholder="Qty"
                                value={lineItem.qty}
                                onChange={(event) => updateLineItem(index, "qty", Number(event.target.value))}
                                className={`rounded-lg ${formErrors.lineItems ? inputErrorClassName : ""}`}
                                disabled={isReadOnly}
                              />
                              <Input
                                aria-describedby={formErrors.lineItems ? "invoice-line-items-error" : undefined}
                                aria-invalid={!!formErrors.lineItems}
                                type="number"
                                placeholder="Price"
                                value={lineItem.unitPrice || ""}
                                onChange={(event) => updateLineItem(index, "unitPrice", Number(event.target.value))}
                                className={`rounded-lg ${formErrors.lineItems ? inputErrorClassName : ""}`}
                                disabled={isReadOnly}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => removeLineItem(index)}
                                disabled={isReadOnly || form.lineItems.length <= 1}
                                aria-label={`Remove line item ${index + 1}`}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        {formErrors.lineItems ? (
                          <p id="invoice-line-items-error" className={inlineErrorClassName} role="alert">
                            {formErrors.lineItems}
                          </p>
                        ) : null}
                        {!isReadOnly ? (
                          <Button variant="ghost" size="sm" onClick={addLineItem} className="gap-1 text-secondary">
                            <Plus size={14} />
                            Add Line Item
                          </Button>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-border bg-muted/20 p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span className="font-medium">{formatNaira(subtotal)}</span>
                          </div>
                          <div className="grid gap-2 text-sm sm:grid-cols-[auto_auto_minmax(80px,1fr)] sm:items-center">
                            <span className="text-muted-foreground">Tax %</span>
                            <Input
                              type="number"
                              value={form.taxPercent || ""}
                              onChange={(event) =>
                                setForm((currentForm) => ({ ...currentForm, taxPercent: Number(event.target.value) }))
                              }
                              className="h-10 w-full rounded-lg text-left sm:w-24 sm:text-right"
                              disabled={isReadOnly}
                            />
                            <span className="text-left font-medium sm:min-w-[80px] sm:text-right">{formatNaira(taxAmount)}</span>
                          </div>
                          <div className="flex justify-between border-t border-border pt-3 text-lg font-bold text-primary">
                            <span>Grand Total</span>
                            <span>{formatNaira(grandTotal)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {formStep === "review" ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-muted/20 p-5">
                        <h3 className="text-base font-semibold text-foreground">Invoice summary</h3>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Customer</p>
                            <p className="font-medium text-foreground">{activeCustomer?.name ?? activeInvoice?.customerName ?? "Unassigned"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Issue date</p>
                            <p className="font-medium text-foreground">{form.issueDate || "Not set"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Due date</p>
                            <p className="font-medium text-foreground">{form.dueDate || "Not set"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Line items</p>
                            <p className="font-medium text-foreground">{validLineItems.length}</p>
                          </div>
                        </div>
                        {form.notes ? (
                          <div className="mt-4 border-t border-border pt-4">
                            <p className="text-sm text-muted-foreground">Notes</p>
                            <p className="mt-1 text-sm text-foreground">{form.notes}</p>
                          </div>
                        ) : null}
                      </div>

                      {activeInvoice ? (
                        <div className="space-y-4">
                          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">Delivery</p>
                                <p className="text-xs text-muted-foreground">{getDeliverySummaryLabel(activeInvoice)}</p>
                              </div>
                              {isReadOnly && canPrepareInvoiceDelivery(activeInvoice.status) ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-lg"
                                  onClick={() => openDeliveryDialogForInvoice(activeInvoice)}
                                  disabled={isMutating}
                                >
                                  {getBackendDeliveryActionLabel(activeInvoice)}
                                </Button>
                              ) : null}
                            </div>
                            <div className="grid gap-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Recipient</span>
                                <span className="text-right font-medium">
                                  {activeInvoice.deliveryEmail || customerById.get(activeInvoice.customerId)?.email || "Not set"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Method</span>
                                <span className="text-right font-medium">{getDeliveryMethodLabel(activeInvoice)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Attempts</span>
                                <span className="text-right font-medium">{activeInvoice.deliveryAttemptCount}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Last delivery attempt</span>
                                <span className="text-right font-medium">
                                  {activeInvoice.deliveryLastAttemptAt ? format(new Date(activeInvoice.deliveryLastAttemptAt), "PPp") : "Not yet"}
                                </span>
                              </div>
                            </div>
                            {activeInvoice.deliveryLastError ? (
                              <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-3 py-2 text-sm text-[#B42318]">
                                {activeInvoice.deliveryLastError}
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-foreground">Payment Link</p>
                                <p className="text-xs text-muted-foreground">{getPaymentLinkSummaryLabel(activeInvoice)}</p>
                              </div>
                              <div className="rounded-full bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                                {activeInvoice.paymentLinkEnabled ? "Enabled" : "Private"}
                              </div>
                            </div>
                            <div className="grid gap-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Amount due</span>
                                <span className="text-right font-medium">{formatCurrency(activeInvoice.balanceDue)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Last shared</span>
                                <span className="text-right font-medium">
                                  {activeInvoice.paymentLinkLastSharedAt ? format(new Date(activeInvoice.paymentLinkLastSharedAt), "PPp") : "Not yet"}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => void handleCopyPaymentLink(activeInvoice)}
                                disabled={isMutating || !canShareInvoicePaymentLink(activeInvoice)}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Link
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => void handleOpenPaymentLink(activeInvoice)}
                                disabled={isMutating || !canShareInvoicePaymentLink(activeInvoice)}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Page
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-lg"
                                onClick={() => void handleSharePaymentLinkOnWhatsApp(activeInvoice)}
                                disabled={isMutating || !canShareInvoicePaymentLink(activeInvoice)}
                              >
                                <MessageCircle className="mr-2 h-4 w-4" />
                                WhatsApp
                              </Button>
                            </div>
                            {!canShareInvoicePaymentLink(activeInvoice) ? (
                              <p className="text-xs text-muted-foreground">
                                Send the invoice first before sharing a live payment link.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t-2 border-[#5B67F7] bg-[#10203F] px-4 py-3 text-white shadow-[0_-10px_30px_rgba(16,32,63,0.25)] md:left-[var(--sidebar-width)] md:px-6 xl:px-8">
                    <div className="xl:hidden">
                      <p className="text-sm font-semibold text-foreground">
                        Step {invoiceStepMeta[formStep].index}: {invoiceStepMeta[formStep].title}
                      </p>
                      <p className="text-sm text-muted-foreground">{invoiceStepMeta[formStep].description}</p>
                    </div>
                    <div
                      className={`rounded-xl border px-4 py-3 text-sm ${
                        hasTriedInvoiceStepAdvance && Object.values(currentInvoiceStepErrors).some(Boolean)
                          ? "border-destructive/20 bg-destructive/5 text-destructive"
                          : "border-white/20 bg-white/10 text-white/90"
                      }`}
                      role="status"
                    >
                      {currentInvoiceStepMessage}
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex gap-3">
                        {formStep !== "details" ? (
                          <Button
                            variant={formStep === "details" ? "default" : "outline"}
                            className="rounded-xl px-4"
                            onClick={() => goToInvoiceStep(formStep === "review" ? "items" : "details")}
                            disabled={isMutating}
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Back
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-end gap-3">
                        <Button variant="ghost" className="rounded-lg text-white hover:bg-white/10 hover:text-white" onClick={closeDrawer} disabled={isMutating}>
                          {isReadOnly ? "Close" : "Cancel"}
                        </Button>
                        {formStep !== "review" ? (
                          <Button
                            variant="default"
                            className="h-11 rounded-xl bg-[#5B67F7] px-5 font-bold text-white shadow-lg shadow-[#5B67F7]/30 hover:bg-[#4653D8]"
                            onClick={() => goToInvoiceStep(formStep === "details" ? "items" : "review")}
                            disabled={isMutating}
                          >
                            {formStep === "details" ? "Next: Items" : "Next: Review"}
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {formStep === "review" ? (
                      <div className="flex flex-col gap-3 sm:flex-row">
                        {isReadOnly ? (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 rounded-lg btn-press"
                              onClick={closeDrawer}
                            >
                              Close
                            </Button>
                            <Button
                              className="flex-1 rounded-lg btn-press"
                              onClick={() => {
                                if (activeInvoice) {
                                  openEditDrawer(activeInvoice);
                                }
                              }}
                              disabled={!activeInvoice || activeInvoice.status === "paid" || activeInvoice.status === "cancelled"}
                            >
                              Edit Invoice
                            </Button>
                          </>
                        ) : sheetMode === "edit" ? (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 rounded-lg btn-press"
                              onClick={() =>
                                void handleSaveInvoice(activeInvoice?.status === "sent" ? "sent" : "draft", {
                                  record_delivery_attempt: false,
                                })
                              }
                              disabled={isMutating}
                            >
                              {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Save Changes
                            </Button>
                            <Button
                              className="flex-1 rounded-lg btn-press"
                              onClick={openDeliveryDialogForForm}
                              disabled={isMutating}
                            >
                              {getBackendDeliveryActionLabel(activeInvoice)}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              className="flex-1 rounded-lg btn-press"
                              onClick={() => void handleSaveInvoice("draft")}
                              disabled={isMutating}
                            >
                              {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Save Draft
                            </Button>
                            <Button
                              className="flex-1 rounded-lg btn-press"
                              onClick={openDeliveryDialogForForm}
                              disabled={isMutating}
                            >
                              Send Email
                            </Button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <aside className="rounded-2xl border border-border bg-muted/20 p-5">
                  <h3 className="text-base font-semibold text-foreground">Live summary</h3>
                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium text-foreground">{activeCustomer?.name ?? activeInvoice?.customerName ?? "Not selected yet"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Invoice status</p>
                      <p className="font-medium text-foreground capitalize">{activeInvoice?.status ?? (sheetMode === "create" ? "draft" : sheetMode)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Subtotal</p>
                      <p className="font-medium text-foreground">{formatNaira(subtotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Grand total</p>
                      <p className="text-lg font-semibold text-foreground">{formatNaira(grandTotal)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Current step</p>
                      <p className="font-medium text-foreground">
                        {formStep === "details" ? "Details" : formStep === "items" ? "Items and totals" : "Review and send"}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          ) : null}

          <DataPage
            title="Invoices"
            actionLabel={drawerOpen ? "Close Form" : starterInvoiceLimitReached ? "Upgrade to create invoices" : "+ New Invoice"}
            onAction={drawerOpen ? closeDrawer : openCreateDrawer}
            actionTitle={starterInvoiceLimitReached ? "Starter allows up to 10 invoices per calendar month" : undefined}
            tabs={tabs}
            activeTab={tab}
            onTabChange={setTab}
            columns={columns}
            data={filtered}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Invoice number or customer"
            toolbarSlot={isStarterPlan ? null : <AdvancedFilter definitions={advancedFilterDefinitions} state={advancedFilters} onChange={setAdvancedFilters} storageKey="invoices" />}
            emptyTitle="No invoices found"
            emptyDescription="Create your first invoice to get started."
            onRowClick={openViewDrawer}
            isLoading={isSettingsLoading || isInvoicesLoading || isCustomersLoading}
            enableRowSelection
            renderBulkActions={({ clearSelection, selectedRows }) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleBulkInvoiceStatusChange(selectedRows, "paid", clearSelection)}
                  disabled={isMutating}
                >
                  Mark Paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleBulkInvoiceStatusChange(selectedRows, "cancelled", clearSelection)}
                  disabled={isMutating}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => void handleBulkInvoiceDelete(selectedRows, clearSelection)}
                  disabled={isMutating}
                >
                  Delete
                </Button>
              </>
            )}
          />
        </div>
      </div>

      <Dialog open={deliveryDialogOpen} onOpenChange={(open) => (open ? setDeliveryDialogOpen(true) : closeDeliveryDialog())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{getBackendDeliveryActionLabel(deliveryDialogContext?.invoice)}</DialogTitle>
            <DialogDescription>
              We will send this invoice from moniger.net using the details below. If you prefer to attach a PDF and send it
              yourself, you can still open your mail app instead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {deliveryDialogStatus ? (
              <OperationStatusNotice
                description={deliveryDialogStatus.description}
                state={deliveryDialogStatus.state}
                title={deliveryDialogStatus.title}
                onRetry={deliveryDialogStatus.state === "error" ? () => void handleDeliverInvoice("backend_email") : undefined}
                retryLabel="Retry invoice email"
              />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="invoice-delivery-email">Recipient email</Label>
              <Input
                id="invoice-delivery-email"
                type="email"
                value={deliveryForm.email}
                onChange={(event) => {
                  setDeliveryDialogStatus(null);
                  setDeliveryForm((current) => ({ ...current, email: event.target.value }));
                }}
                className="rounded-lg"
                disabled={isDeliverySubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-delivery-subject">Subject</Label>
              <Input
                id="invoice-delivery-subject"
                value={deliveryForm.subject}
                onChange={(event) => {
                  setDeliveryDialogStatus(null);
                  setDeliveryForm((current) => ({ ...current, subject: event.target.value }));
                }}
                className="rounded-lg"
                disabled={isDeliverySubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-delivery-message">Message</Label>
              <Textarea
                id="invoice-delivery-message"
                value={deliveryForm.message}
                onChange={(event) => {
                  setDeliveryDialogStatus(null);
                  setDeliveryForm((current) => ({ ...current, message: event.target.value }));
                }}
                className="min-h-[180px] rounded-lg"
                rows={8}
                disabled={isDeliverySubmitting}
              />
            </div>
            <div className="rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-medium">
                  {deliveryDialogContext?.invoice?.invoiceNumber ?? form.invoiceNumber}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Customer</span>
                <span className="text-right font-medium">
                  {deliveryDialogContext?.invoice?.customerName ?? activeCustomer?.name ?? "Unassigned"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-medium">
                  {formatNaira(deliveryDialogContext?.invoice?.amount ?? grandTotal)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">Status after send</span>
                <span className="font-medium capitalize">{deliveryDialogContext?.targetStatus ?? "sent"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="flex-1 rounded-lg btn-press"
                onClick={closeDeliveryDialog}
                disabled={isDeliverySubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="flex-1 rounded-lg btn-press"
                onClick={() => void handleDeliverInvoice("mail_app")}
                disabled={isDeliverySubmitting}
              >
                Open Mail App
              </Button>
              <Button
                className="flex-1 rounded-lg btn-press"
                onClick={() => void handleDeliverInvoice("backend_email")}
                disabled={isDeliverySubmitting}
              >
                {isDeliverySubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {getBackendDeliveryActionLabel(deliveryDialogContext?.invoice)}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default InvoicesPage;
