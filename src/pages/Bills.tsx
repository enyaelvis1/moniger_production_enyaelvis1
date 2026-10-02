import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Mail,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { format } from "date-fns";
import AppLayout from "@/components/app/AppLayout";
import DataPage from "@/components/app/DataPage";
import OperationStatusNotice from "@/components/app/OperationStatusNotice";
import StatusBadge from "@/components/app/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorsDirectory } from "@/hooks/use-directory-data";
import {
  useBillMutations,
  useBillsData,
  useCategoriesList,
  type BillRecord,
  type FinanceLineItem,
} from "@/hooks/use-finance-data";
import { useSendBillDeliveryEmail } from "@/hooks/use-email-delivery";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import { useBillAttachments } from "@/hooks/use-bill-attachments";
import { useToast } from "@/hooks/use-toast";
import {
  getWorkspacePayoutErrorMessage,
  requestWorkspaceBillPayout,
  scheduleWorkspaceBillPayout,
} from "@/lib/workspace-payout-execution";
import { useSearchParamState } from "@/hooks/use-search-param";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AdvancedFilter } from "@/components/ui/advanced-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { billCategories, formatNaira } from "@/data/seedData";
import { getFormFieldAriaProps } from "@/lib/accessibility";
import { openPrintDocument } from "@/lib/export";
import {
  getMultiSelectFilterValue,
  getStringFilterValue,
  isDateRangeFilterValue,
  isNumberRangeFilterValue,
  matchesDateRange,
  matchesNumberRange,
  type AdvancedFilterDefinition,
  type AdvancedFilterState,
} from "@/lib/advanced-filters";
import {
  createFormValidator,
  getFriendlyErrorMessage,
  ValidationRules,
} from "@/lib/error-handling";

type SheetMode = "create" | "edit" | "view";
type BillFormState = {
  amount: number;
  billDate: string;
  billNumber: string;
  category: string;
  dueDate: string;
  notes: string;
  subtotal: number;
  taxTotal: number;
  lineItems: FinanceLineItem[];
  vendorId: string;
};
type BillFormErrors = Partial<
  Record<"amount" | "billDate" | "vendorId", string>
>;

const createBillForm = (billNumber: string): BillFormState => ({
  amount: 0,
  billDate: format(new Date(), "yyyy-MM-dd"),
  billNumber,
  category: "",
  dueDate: "",
  notes: "",
  subtotal: 0,
  taxTotal: 0,
  lineItems: [],
  vendorId: "",
});

const billFormValidator = createFormValidator({
  amount: [
    ValidationRules.minNumber(0.01, "Enter an amount greater than zero."),
  ],
  billDate: [ValidationRules.required()],
  vendorId: [ValidationRules.required()],
});
const inputErrorClassName = "border-destructive focus-visible:ring-destructive";
const selectErrorClassName = "border-destructive focus:ring-destructive";
const inlineErrorClassName = "text-sm font-medium text-destructive";

const statusBadge = (status: BillRecord["status"]) => {
  const map = {
    overdue: { label: "Overdue", variant: "red" },
    paid: { label: "Paid", variant: "green" },
    scheduled: { label: "Scheduled", variant: "blue" },
    unpaid: { label: "Unpaid", variant: "amber" },
  } as const;
  const config = map[status];
  return <StatusBadge variant={config.variant}>{config.label}</StatusBadge>;
};

const normalizeOptionalText = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
};

const buildScheduledFor = (dueDate: string) => {
  const scheduledDate = new Date(`${dueDate}T23:59:59+01:00`);
  return Number.isNaN(scheduledDate.getTime())
    ? null
    : scheduledDate.toISOString();
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const getDeleteErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error, "Unable to delete bill.");
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("violates foreign key constraint")) {
    return "This bill already has linked records and cannot be deleted yet.";
  }

  return message;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  count === 1 ? singular : plural;

const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const generateNextDocumentNumber = (
  existingNumbers: string[],
  prefix: string,
  padLength: number,
) => {
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

const BillsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { entitlements } = useWorkspaceSubscription();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const vendorsQuery = useVendorsDirectory(businessId);
  const billsQuery = useBillsData(businessId);
  const { createBill, deleteBill, updateBill, updateBillStatus } =
    useBillMutations(businessId, user?.id);
  const sendBillEmail = useSendBillDeliveryEmail(businessId, user?.id);

  const [search, setSearch] = useSearchParamState();
  const [tab, setTab] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [form, setForm] = useState<BillFormState>(createBillForm("BILL-001"));
  const [formErrors, setFormErrors] = useState<BillFormErrors>({});
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>(
    {},
  );
  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [replacingAttachmentId, setReplacingAttachmentId] = useState<
    string | null
  >(null);
  const billAttachments = useBillAttachments(
    businessId,
    activeBillId ?? undefined,
  );

  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const vendors = useMemo(() => vendorsQuery.data ?? [], [vendorsQuery.data]);
  const categoriesQuery = useCategoriesList();
  const categoriesOptions = useMemo(
    () =>
      categoriesQuery.data?.map((c) => ({ label: c.name, value: c.name })) ??
      billCategories.map((category) => ({ label: category, value: category })),
    [categoriesQuery.data],
  );
  const activeBill = useMemo(
    () => bills.find((bill) => bill.id === activeBillId) ?? null,
    [activeBillId, bills],
  );
  const nextNumber = useMemo(
    () =>
      generateNextDocumentNumber(
        bills.map((bill) => bill.billNumber),
        "BILL",
        3,
      ),
    [bills],
  );
  const advancedFilterDefinitions: AdvancedFilterDefinition[] = useMemo(
    () => [
      {
        emptyLabel: "All vendors",
        id: "vendorId",
        label: "Vendor",
        options: vendors.map((vendor) => ({
          label: vendor.businessName,
          value: vendor.id,
        })),
        type: "select",
      },
      {
        id: "category",
        label: "Category",
        options: categoriesOptions,
        type: "multi-select",
      },
      {
        fromLabel: "Billed from",
        id: "billDate",
        label: "Bill Date",
        toLabel: "Billed to",
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
    [vendors],
  );

  useEffect(() => {
    if (activeBillId && !activeBill) {
      setActiveBillId(null);
      setDrawerOpen(false);
    }
  }, [activeBill, activeBillId]);

  const filtered = useMemo(() => {
    let list = bills;
    const vendorFilter = getStringFilterValue(advancedFilters.vendorId);
    const selectedCategories = getMultiSelectFilterValue(
      advancedFilters.category,
    );
    const billDateRange = isDateRangeFilterValue(advancedFilters.billDate)
      ? advancedFilters.billDate
      : undefined;
    const dueDateRange = isDateRangeFilterValue(advancedFilters.dueDate)
      ? advancedFilters.dueDate
      : undefined;
    const amountRange = isNumberRangeFilterValue(advancedFilters.amount)
      ? advancedFilters.amount
      : undefined;

    if (tab !== "all") {
      list = list.filter((bill) => bill.status === tab);
    }

    list = list.filter((bill) => {
      if (vendorFilter && bill.vendorId !== vendorFilter) {
        return false;
      }

      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(bill.category || "")
      ) {
        return false;
      }

      if (!matchesDateRange(bill.billDate, billDateRange)) {
        return false;
      }

      if (!matchesDateRange(bill.dueDate, dueDateRange)) {
        return false;
      }

      if (!matchesNumberRange(bill.amount, amountRange)) {
        return false;
      }

      return true;
    });

    if (!search) {
      return list;
    }

    const normalizedSearch = search.toLowerCase();
    return list.filter(
      (bill) =>
        bill.billNumber.toLowerCase().includes(normalizedSearch) ||
        bill.vendorName.toLowerCase().includes(normalizedSearch),
    );
  }, [
    advancedFilters.amount,
    advancedFilters.billDate,
    advancedFilters.category,
    advancedFilters.dueDate,
    advancedFilters.vendorId,
    bills,
    search,
    tab,
  ]);

  const tabs = useMemo(
    () => [
      { label: "All", count: bills.length, value: "all" },
      {
        label: "Unpaid",
        count: bills.filter((bill) => bill.status === "unpaid").length,
        value: "unpaid",
      },
      {
        label: "Scheduled",
        count: bills.filter((bill) => bill.status === "scheduled").length,
        value: "scheduled",
      },
      {
        label: "Paid",
        count: bills.filter((bill) => bill.status === "paid").length,
        value: "paid",
      },
      {
        label: "Overdue",
        count: bills.filter((bill) => bill.status === "overdue").length,
        value: "overdue",
      },
    ],
    [bills],
  );

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isBillsLoading = billsQuery.isLoading && !billsQuery.data;
  const isVendorsLoading = vendorsQuery.isLoading && !vendorsQuery.data;
  const isMutating =
    createBill.isPending ||
    deleteBill.isPending ||
    updateBill.isPending ||
    updateBillStatus.isPending ||
    payingBillId !== null;
  const isReadOnly = sheetMode === "view";
  const canManageAttachments = entitlements.canAccessPaidFeatures;

  const openCreateDrawer = () => {
    setSheetMode("create");
    setActiveBillId(null);
    setForm(createBillForm(nextNumber));
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openViewDrawer = (bill: BillRecord) => {
    setSheetMode("view");
    setActiveBillId(bill.id);
    setForm({
      amount: bill.amount,
      billDate: bill.billDate,
      billNumber: bill.billNumber,
      category: bill.category,
      dueDate: bill.dueDate ?? "",
      notes: bill.notes,
      subtotal: bill.subtotal,
      taxTotal: bill.taxTotal,
      lineItems: bill.lineItems,
      vendorId: bill.vendorId,
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const openEditDrawer = (bill: BillRecord) => {
    if (bill.status === "paid") {
      toast({
        title: "Bill locked",
        description: "Paid bills are view-only for now.",
      });
      return;
    }

    setSheetMode("edit");
    setActiveBillId(bill.id);
    setForm({
      amount: bill.amount,
      billDate: bill.billDate,
      billNumber: bill.billNumber,
      category: bill.category,
      dueDate: bill.dueDate ?? "",
      notes: bill.notes,
      subtotal: bill.subtotal,
      taxTotal: bill.taxTotal,
      lineItems: bill.lineItems,
      vendorId: bill.vendorId,
    });
    setFormErrors({});
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (isMutating) {
      return;
    }

    setDrawerOpen(false);
    setActiveBillId(null);
    setSheetMode("create");
    setForm(createBillForm(nextNumber));
    setFormErrors({});
  };

  const clearFormError = (field: keyof BillFormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const validateForm = (): BillFormErrors => {
    return billFormValidator({
      amount: Number(form.subtotal) + Number(form.taxTotal) || 0,
      billDate: form.billDate,
      vendorId: form.vendorId,
    }) as BillFormErrors;
  };

  const lineItemsSubtotal = form.lineItems.reduce(
    (total, item) =>
      total +
      Math.max(0, Number(item.qty) || 0) *
        Math.max(0, Number(item.unitPrice) || 0),
    0,
  );
  const effectiveSubtotal =
    form.lineItems.length > 0
      ? Math.round(lineItemsSubtotal * 100) / 100
      : Number(form.subtotal) || 0;

  const buildPayload = (status: BillRecord["status"]) => ({
    amount: Math.max(0, effectiveSubtotal + (Number(form.taxTotal) || 0)),
    bill_date: form.billDate,
    bill_number: form.billNumber,
    category: normalizeOptionalText(form.category),
    due_date: normalizeOptionalText(form.dueDate),
    notes: normalizeOptionalText(form.notes),
    scheduled_payment_date:
      status === "scheduled"
        ? (normalizeOptionalText(form.dueDate) ?? form.billDate)
        : null,
    status,
    line_items: form.lineItems,
    subtotal: Math.max(0, effectiveSubtotal),
    tax_total: Math.max(0, Number(form.taxTotal) || 0),
    vendor_id: form.vendorId,
  });

  const handleSaveBill = async (targetStatus: BillRecord["status"]) => {
    if (
      form.lineItems.some(
        (item) =>
          !item.description.trim() || item.qty <= 0 || item.unitPrice < 0,
      )
    ) {
      toast({
        title: "Complete bill line items",
        description:
          "Each line item needs a description, a quantity greater than zero, and a valid unit price.",
        variant: "destructive",
      });
      return;
    }
    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    try {
      if (sheetMode === "edit" && activeBill) {
        await updateBill.mutateAsync({
          bill: activeBill,
          values: buildPayload(targetStatus),
        });
        toast({
          title:
            targetStatus === "paid"
              ? "Bill paid"
              : targetStatus === "scheduled"
                ? "Bill scheduled"
                : "Bill updated",
          description:
            targetStatus === "paid"
              ? `${form.billNumber} has been marked as paid.`
              : `${form.billNumber} has been saved.`,
        });
      } else {
        await createBill.mutateAsync(buildPayload(targetStatus));
        toast({
          title:
            targetStatus === "paid"
              ? "Bill paid"
              : targetStatus === "scheduled"
                ? "Bill scheduled"
                : "Bill saved",
          description: `${form.billNumber} has been created.`,
        });
      }

      setFormErrors({});
      closeDrawer();
    } catch (error) {
      toast({
        title:
          sheetMode === "edit"
            ? "Unable to update bill"
            : "Unable to create bill",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleUploadAttachment = async (file: File) => {
    if (!user?.id || !activeBillId) {
      toast({
        title: "Save the bill first",
        description: "Attachments can be added after the bill has been saved.",
      });
      return;
    }

    if (!canManageAttachments) {
      toast({
        title: "Paid plan feature",
        description:
          "Vendor invoice attachments are available on Growth and Business.",
      });
      return;
    }

    try {
      await billAttachments.upload.mutateAsync({ file, userId: user.id });
      toast({
        title: "Attachment uploaded",
        description: `${file.name} is attached to ${form.billNumber}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to upload attachment",
        description: getErrorMessage(
          error,
          "Check the file type and size, then try again.",
        ),
      });
    }
  };

  const handleReplaceAttachment = async (
    attachment: NonNullable<typeof billAttachments.data>[number],
    file: File,
  ) => {
    if (!user?.id) return;
    setReplacingAttachmentId(attachment.id);
    try {
      await billAttachments.upload.mutateAsync({ file, userId: user.id });
      await billAttachments.remove.mutateAsync({ attachment, userId: user.id });
      toast({
        title: "Attachment replaced",
        description: `${attachment.file_name} was replaced with ${file.name}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to replace attachment",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setReplacingAttachmentId(null);
    }
  };

  const handleOpenAttachment = async (
    attachment: NonNullable<typeof billAttachments.data>[number],
  ) => {
    try {
      const url = await billAttachments.createSignedUrl(attachment);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({
        title: "Unable to open attachment",
        description: getErrorMessage(
          error,
          "The private file could not be opened.",
        ),
      });
    }
  };

  const handleRemoveAttachment = async (
    attachment: NonNullable<typeof billAttachments.data>[number],
  ) => {
    if (!window.confirm(`Remove ${attachment.file_name}?`)) return;

    try {
      if (!user?.id)
        throw new Error("You need to be signed in to remove an attachment.");
      await billAttachments.remove.mutateAsync({ attachment, userId: user.id });
      toast({
        title: "Attachment removed",
        description: `${attachment.file_name} was removed from the bill.`,
      });
    } catch (error) {
      toast({
        title: "Unable to remove attachment",
        description: getErrorMessage(
          error,
          "The attachment could not be removed.",
        ),
      });
    }
  };

  const handleSendBillEmail = async (bill: BillRecord) => {
    const vendor = vendors.find((item) => item.id === bill.vendorId);
    if (!vendor?.email) {
      toast({
        title: "Vendor email required",
        description:
          "Add an email address to this vendor before sending the bill.",
        variant: "destructive",
      });
      return;
    }
    try {
      await sendBillEmail.mutateAsync({
        businessId: businessId!,
        billId: bill.id,
        email: vendor.email,
      });
      toast({
        title: "Bill email sent",
        description: `${bill.billNumber} was sent to ${vendor.email}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to send bill email",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handlePrintBill = (bill: BillRecord) => {
    openPrintDocument({
      fileName: `${bill.billNumber}-breakdown`,
      metadata: [
        { label: "Vendor", value: bill.vendorName },
        { label: "Bill number", value: bill.billNumber },
        { label: "Bill date", value: bill.billDate },
        { label: "Due date", value: bill.dueDate ?? "Not specified" },
      ],
      sections: [
        {
          title: "Line items",
          table: {
            columns: ["Description", "Quantity", "Unit price", "Line total"],
            rows: bill.lineItems.map((item) => [
              item.description,
              String(item.qty),
              formatNaira(item.unitPrice),
              formatNaira(item.qty * item.unitPrice),
            ]),
          },
        },
        {
          title: "Totals",
          rows: [
            { label: "Subtotal", value: formatNaira(bill.subtotal) },
            { label: "Tax / charges", value: formatNaira(bill.taxTotal) },
            { label: "Total", value: formatNaira(bill.amount) },
          ],
        },
        ...(bill.notes ? [{ title: "Notes", text: [bill.notes] }] : []),
      ],
      subtitle: "Printable vendor bill breakdown",
      title: `Bill ${bill.billNumber}`,
    });
  };

  const handlePayNow = async (bill: BillRecord) => {
    if (!businessId || !user?.id) {
      toast({
        title: "Unable to start payout",
        description:
          "A signed-in workspace owner, admin, or accountant is required before you can pay a bill.",
        variant: "destructive",
      });
      return;
    }

    if (bill.status === "paid") {
      toast({
        title: "Bill already paid",
        description: `${bill.billNumber} has already settled.`,
      });
      return;
    }

    setPayingBillId(bill.id);

    let payoutResult: Awaited<
      ReturnType<typeof requestWorkspaceBillPayout>
    > | null = null;

    try {
      payoutResult = await requestWorkspaceBillPayout({
        billId: bill.id,
        businessId,
        idempotencyKey: `bill-${bill.id}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["bills", businessId] });
      await queryClient.invalidateQueries({
        queryKey: ["workspace-payouts", businessId],
      });

      toast({
        title:
          payoutResult.payoutStatus === "pending_approval"
            ? "Payout needs approval"
            : "Payout submitted",
        description:
          payoutResult.payoutStatus === "pending_approval"
            ? `${bill.billNumber} is waiting for approval before it can be submitted.`
            : `${bill.billNumber} has been sent for payout and will update when the transfer settles.`,
      });
    } catch (error) {
      if (payoutResult) {
        toast({
          title: "Payout submitted, but bill refresh failed",
          description: `${bill.billNumber} was sent for payout, but we could not refresh the bill list. Please refresh if the bill still looks unpaid.`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Unable to start payout",
        description: getWorkspacePayoutErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setPayingBillId(null);
    }
  };

  const handleSchedulePayment = async (bill: BillRecord) => {
    if (!businessId || !user?.id) {
      toast({
        title: "Unable to schedule payout",
        description:
          "A signed-in workspace owner, admin, or accountant is required before you can schedule a bill payout.",
        variant: "destructive",
      });
      return;
    }

    if (bill.status === "paid") {
      toast({
        title: "Bill already paid",
        description: `${bill.billNumber} has already settled.`,
      });
      return;
    }

    if (bill.status === "scheduled") {
      toast({
        title: "Bill already scheduled",
        description: `${bill.billNumber} is already scheduled for payout.`,
      });
      return;
    }

    if (!bill.dueDate) {
      toast({
        title: "Unable to schedule payout",
        description:
          "Add a due date to this bill before scheduling the payout.",
        variant: "destructive",
      });
      return;
    }

    const scheduledFor = buildScheduledFor(bill.dueDate);
    if (!scheduledFor) {
      toast({
        title: "Unable to schedule payout",
        description:
          "The bill due date could not be converted into a payout time.",
        variant: "destructive",
      });
      return;
    }

    setPayingBillId(bill.id);

    let scheduleResult: Awaited<
      ReturnType<typeof scheduleWorkspaceBillPayout>
    > | null = null;

    try {
      scheduleResult = await scheduleWorkspaceBillPayout({
        billId: bill.id,
        businessId,
        idempotencyKey: `bill-schedule-${bill.id}`,
        scheduledFor,
      });

      await updateBillStatus.mutateAsync({ bill, status: "scheduled" });
      await queryClient.invalidateQueries({
        queryKey: ["workspace-payouts", businessId],
      });

      toast({
        title:
          scheduleResult.payoutStatus === "pending_approval"
            ? "Payout needs approval"
            : "Payout scheduled",
        description:
          scheduleResult.payoutStatus === "pending_approval"
            ? `${bill.billNumber} is waiting for approval before it can be queued.`
            : `${bill.billNumber} is now queued for ${bill.dueDate}.`,
      });
    } catch (error) {
      if (scheduleResult) {
        toast({
          title: "Payout scheduled, but bill update failed",
          description: `${bill.billNumber} was queued, but we could not finish updating the bill record. Please refresh and try again if it still shows as unscheduled.`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Unable to schedule payout",
        description: getWorkspacePayoutErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setPayingBillId(null);
    }
  };

  const handleDeleteBill = async (bill: BillRecord) => {
    if (bill.status !== "unpaid") {
      toast({
        title: "Bill locked",
        description: "Only unpaid bills can be deleted.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${bill.billNumber}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteBill.mutateAsync({
        billId: bill.id,
        billNumber: bill.billNumber,
      });
      toast({
        title: "Bill deleted",
        description: `${bill.billNumber} has been removed.`,
      });
    } catch (error) {
      toast({
        title: "Unable to delete bill",
        description: getDeleteErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (
    bill: BillRecord,
    status: BillRecord["status"],
  ) => {
    try {
      await updateBillStatus.mutateAsync({ bill, status });
      toast({
        title: "Bill updated",
        description: `${bill.billNumber} is now ${status}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to update bill",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleBulkBillStatusChange = async (
    selectedBills: BillRecord[],
    status: Extract<BillRecord["status"], "paid" | "scheduled" | "unpaid">,
    clearSelection: () => void,
  ) => {
    const eligibleBills = selectedBills.filter((bill) => {
      if (status === "scheduled") {
        return bill.status !== "paid" && bill.status !== "scheduled";
      }

      if (status === "paid") {
        return bill.status !== "paid";
      }

      return bill.status !== "paid" && bill.status !== "unpaid";
    });

    if (eligibleBills.length === 0) {
      toast({
        title: "No bills updated",
        description: `None of the selected bills can be marked as ${status}.`,
      });
      return;
    }

    let updatedCount = 0;
    let failedCount = 0;
    let firstError: unknown;

    for (const bill of eligibleBills) {
      try {
        await updateBillStatus.mutateAsync({ bill, status });
        updatedCount += 1;
      } catch (error) {
        failedCount += 1;
        firstError ??= error;
      }
    }

    if (updatedCount > 0) {
      clearSelection();
    }

    const skippedCount = selectedBills.length - eligibleBills.length;
    if (failedCount > 0 && updatedCount === 0) {
      toast({
        title: "Bulk update failed",
        description: getErrorMessage(firstError, "Please try again."),
        variant: "destructive",
      });
      return;
    }

    const descriptionParts = [
      `${updatedCount} ${pluralize(updatedCount, "bill")} updated`,
    ];
    if (skippedCount > 0) {
      descriptionParts.push(`${skippedCount} skipped`);
    }
    if (failedCount > 0) {
      descriptionParts.push(`${failedCount} failed`);
    }

    toast({
      title:
        failedCount > 0 ? "Bulk update partially completed" : "Bills updated",
      description: descriptionParts.join(", "),
      variant: failedCount > 0 ? "destructive" : "default",
    });
  };

  const handleBulkBillDelete = async (
    selectedBills: BillRecord[],
    clearSelection: () => void,
  ) => {
    const deletableBills = selectedBills.filter(
      (bill) => bill.status === "unpaid",
    );

    if (deletableBills.length === 0) {
      toast({
        title: "No bills deleted",
        description: "Only unpaid bills can be deleted.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${deletableBills.length} ${pluralize(deletableBills.length, "bill")}? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    let deletedCount = 0;
    let failedCount = 0;
    let firstError: unknown;

    for (const bill of deletableBills) {
      try {
        await deleteBill.mutateAsync({
          billId: bill.id,
          billNumber: bill.billNumber,
        });
        deletedCount += 1;
      } catch (error) {
        failedCount += 1;
        firstError ??= error;
      }
    }

    if (deletedCount > 0) {
      clearSelection();
    }

    const skippedCount = selectedBills.length - deletableBills.length;
    if (failedCount > 0 && deletedCount === 0) {
      toast({
        title: "Bulk delete failed",
        description: getDeleteErrorMessage(firstError),
        variant: "destructive",
      });
      return;
    }

    const descriptionParts = [
      `${deletedCount} ${pluralize(deletedCount, "bill")} deleted`,
    ];
    if (skippedCount > 0) {
      descriptionParts.push(`${skippedCount} skipped`);
    }
    if (failedCount > 0) {
      descriptionParts.push(`${failedCount} failed`);
    }

    toast({
      title:
        failedCount > 0 ? "Bulk delete partially completed" : "Bills deleted",
      description: descriptionParts.join(", "),
      variant: failedCount > 0 ? "destructive" : "default",
    });
  };

  const columns = [
    {
      key: "billNumber",
      header: "Bill #",
      render: (row: BillRecord) => (
        <span className="font-medium text-foreground">{row.billNumber}</span>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      render: (row: BillRecord) => row.vendorName,
    },
    {
      key: "billDate",
      header: "Bill Date",
      render: (row: BillRecord) => row.billDate,
    },
    {
      key: "dueDate",
      header: "Due Date",
      render: (row: BillRecord) => row.dueDate || "-",
    },
    {
      key: "amount",
      header: "Amount",
      render: (row: BillRecord) => (
        <span className="font-medium">{formatNaira(row.amount)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row: BillRecord) => statusBadge(row.status),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: BillRecord) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              openViewDrawer(row);
            }}
            aria-label={`View bill ${row.billNumber}`}
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
            aria-label={`Edit bill ${row.billNumber}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(event) => event.stopPropagation()}
                aria-label={`Open actions for bill ${row.billNumber}`}
              >
                <MoreHorizontal size={14} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void handlePayNow(row)}
                disabled={row.status === "paid" || payingBillId === row.id}
              >
                {payingBillId === row.id ? "Paying..." : "Pay now"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleSchedulePayment(row)}
                disabled={
                  row.status === "paid" ||
                  row.status === "scheduled" ||
                  !row.dueDate
                }
              >
                Schedule Payment
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleDeleteBill(row)}
                className="text-destructive"
              >
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
            description={getErrorMessage(
              settingsQuery.error,
              "We could not load your workspace.",
            )}
            state="error"
            onRetry={() => void settingsQuery.refetch()}
            retryLabel="Retry workspace"
          />
        ) : null}

        {billsQuery.error ? (
          <OperationStatusNotice
            title="Bills unavailable"
            description={getErrorMessage(
              billsQuery.error,
              "We could not load your bills right now.",
            )}
            state="error"
            onRetry={() => void billsQuery.refetch()}
            retryLabel="Retry bills"
          />
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Bills will appear here once
            the business record is available.
          </div>
        ) : null}

        {!drawerOpen ? (
          <DataPage
            title="Bills"
            actionLabel="+ Add Bill"
            onAction={openCreateDrawer}
            tabs={tabs}
            activeTab={tab}
            onTabChange={setTab}
            columns={columns}
            data={filtered}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Bill number or vendor"
            toolbarSlot={
              <AdvancedFilter
                definitions={advancedFilterDefinitions}
                state={advancedFilters}
                onChange={setAdvancedFilters}
                storageKey="bills"
              />
            }
            emptyTitle="No bills found"
            emptyDescription="Add your first bill to track payables."
            onRowClick={openViewDrawer}
            isLoading={isSettingsLoading || isBillsLoading || isVendorsLoading}
            enableRowSelection
            renderBulkActions={({ clearSelection, selectedRows }) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleBulkBillStatusChange(
                      selectedRows,
                      "scheduled",
                      clearSelection,
                    )
                  }
                  disabled={isMutating}
                >
                  Schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleBulkBillStatusChange(
                      selectedRows,
                      "paid",
                      clearSelection,
                    )
                  }
                  disabled={isMutating}
                >
                  Mark Paid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void handleBulkBillStatusChange(
                      selectedRows,
                      "unpaid",
                      clearSelection,
                    )
                  }
                  disabled={isMutating}
                >
                  Mark Unpaid
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    void handleBulkBillDelete(selectedRows, clearSelection)
                  }
                  disabled={isMutating}
                >
                  Delete
                </Button>
              </>
            )}
          />
        ) : null}

        {drawerOpen ? (
          <section className="rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
              <div>
                <p className="text-sm font-medium text-primary">
                  Bill workspace
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                  {sheetMode === "create"
                    ? "Add Bill"
                    : sheetMode === "edit"
                      ? `Edit ${form.billNumber}`
                      : `Bill ${form.billNumber}`}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review vendor, amount, dates, and payment details for this
                  bill.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeDrawer}
                aria-label="Close bill form"
                disabled={isMutating}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-4 px-6 py-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="bill-vendor">Vendor</Label>
                  {!isReadOnly ? (
                    <Button
                      asChild
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-primary/50 text-primary hover:bg-primary/10"
                    >
                      <Link to="/vendors?create=1">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add vendor
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <Select
                  value={form.vendorId}
                  onValueChange={(value) => {
                    clearFormError("vendorId");
                    setForm((currentForm) => ({
                      ...currentForm,
                      vendorId: value,
                    }));
                  }}
                  disabled={isReadOnly}
                >
                  <SelectTrigger
                    {...getFormFieldAriaProps({
                      label: "Vendor",
                      error: formErrors.vendorId,
                      id: "bill-vendor",
                      required: true,
                    })}
                    className={`rounded-lg ${formErrors.vendorId ? selectErrorClassName : ""}`}
                  >
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.businessName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isReadOnly && vendors.length === 0 ? (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
                    <p className="font-medium">No vendors yet</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a vendor first, then return here to select them for
                      this bill.
                    </p>
                  </div>
                ) : null}
                {formErrors.vendorId ? (
                  <p
                    id="bill-vendor-error"
                    className={inlineErrorClassName}
                    role="alert"
                  >
                    {formErrors.vendorId}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bill-number">Bill #</Label>
                <Input
                  id="bill-number"
                  value={form.billNumber}
                  disabled
                  className="rounded-lg bg-muted"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="bill-date">Bill Date</Label>
                  <Input
                    {...getFormFieldAriaProps({
                      label: "Bill Date",
                      error: formErrors.billDate,
                      id: "bill-date",
                      required: true,
                    })}
                    type="date"
                    value={form.billDate}
                    onChange={(event) => {
                      clearFormError("billDate");
                      setForm((currentForm) => ({
                        ...currentForm,
                        billDate: event.target.value,
                      }));
                    }}
                    className={`rounded-lg ${formErrors.billDate ? inputErrorClassName : ""}`}
                    disabled={isReadOnly}
                  />
                  {formErrors.billDate ? (
                    <p
                      id="bill-date-error"
                      className={inlineErrorClassName}
                      role="alert"
                    >
                      {formErrors.billDate}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bill-due-date">Due Date</Label>
                  <Input
                    id="bill-due-date"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((currentForm) => ({
                        ...currentForm,
                        dueDate: event.target.value,
                      }))
                    }
                    className="rounded-lg"
                    disabled={isReadOnly}
                  />
                </div>
              </div>
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Bill line items
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add a clear description, quantity, and unit price for each
                      charge.
                    </p>
                  </div>
                  {!isReadOnly ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          lineItems: [
                            ...current.lineItems,
                            { description: "", qty: 1, unitPrice: 0 },
                          ],
                        }))
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" /> Add item
                    </Button>
                  ) : null}
                </div>
                {form.lineItems.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                    No line items added. You can use the subtotal field below
                    for older bills.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {form.lineItems.map((item, index) => (
                      <div
                        key={item.id ?? index}
                        className="grid grid-cols-[minmax(0,2fr)_90px_130px_auto] items-end gap-2"
                      >
                        <div className="space-y-1">
                          <Label htmlFor={`bill-item-description-${index}`}>
                            Description
                          </Label>
                          <Input
                            id={`bill-item-description-${index}`}
                            value={item.description}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                lineItems: current.lineItems.map(
                                  (line, lineIndex) =>
                                    lineIndex === index
                                      ? {
                                          ...line,
                                          description: event.target.value,
                                        }
                                      : line,
                                ),
                              }))
                            }
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`bill-item-qty-${index}`}>
                            Quantity
                          </Label>
                          <Input
                            id={`bill-item-qty-${index}`}
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.qty}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                lineItems: current.lineItems.map(
                                  (line, lineIndex) =>
                                    lineIndex === index
                                      ? {
                                          ...line,
                                          qty: Number(event.target.value) || 0,
                                        }
                                      : line,
                                ),
                              }))
                            }
                            disabled={isReadOnly}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`bill-item-price-${index}`}>
                            Unit price
                          </Label>
                          <Input
                            id={`bill-item-price-${index}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                lineItems: current.lineItems.map(
                                  (line, lineIndex) =>
                                    lineIndex === index
                                      ? {
                                          ...line,
                                          unitPrice:
                                            Number(event.target.value) || 0,
                                        }
                                      : line,
                                ),
                              }))
                            }
                            disabled={isReadOnly}
                          />
                        </div>
                        {!isReadOnly ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remove line item ${index + 1}`}
                            onClick={() =>
                              setForm((current) => ({
                                ...current,
                                lineItems: current.lineItems.filter(
                                  (_, lineIndex) => lineIndex !== index,
                                ),
                              }))
                            }
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <div className="w-10" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="mb-3 text-sm font-semibold text-foreground">
                  Bill breakdown
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="bill-subtotal">Subtotal</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        ₦
                      </span>
                      <Input
                        id="bill-subtotal"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={
                          form.lineItems.length > 0
                            ? effectiveSubtotal
                            : form.subtotal || ""
                        }
                        onChange={(event) => {
                          clearFormError("amount");
                          setForm((currentForm) => ({
                            ...currentForm,
                            subtotal: Number(event.target.value) || 0,
                          }));
                        }}
                        className="rounded-lg pl-9"
                        placeholder="0"
                        disabled={isReadOnly || form.lineItems.length > 0}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bill-tax">Tax / charges</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        ₦
                      </span>
                      <Input
                        id="bill-tax"
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={form.taxTotal || ""}
                        onChange={(event) => {
                          clearFormError("amount");
                          setForm((currentForm) => ({
                            ...currentForm,
                            taxTotal: Number(event.target.value) || 0,
                          }));
                        }}
                        className="rounded-lg pl-9"
                        placeholder="0"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bill-amount">Total amount</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        ₦
                      </span>
                      <Input
                        {...getFormFieldAriaProps({
                          label: "Total amount",
                          error: formErrors.amount,
                          id: "bill-amount",
                          required: true,
                        })}
                        type="number"
                        value={effectiveSubtotal + Number(form.taxTotal) || ""}
                        className={`rounded-lg bg-muted pl-9 ${formErrors.amount ? inputErrorClassName : ""}`}
                        readOnly
                        disabled={isReadOnly}
                      />
                    </div>
                    {formErrors.amount ? (
                      <p
                        id="bill-amount-error"
                        className={inlineErrorClassName}
                        role="alert"
                      >
                        {formErrors.amount}
                      </p>
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The total is calculated automatically from the subtotal and
                  tax or charges.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      category: value,
                    }))
                  }
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {
                      (categoriesQuery.data?.length
                        ? categoriesQuery.data.map((c) => (
                            <SelectItem key={c.id} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))
                        : billCategories.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))) as React.ReactNode
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((currentForm) => ({
                      ...currentForm,
                      notes: event.target.value,
                    }))
                  }
                  className="rounded-lg"
                  rows={3}
                  disabled={isReadOnly}
                />
              </div>
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Paperclip className="h-4 w-4" />
                      Vendor invoice attachment
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Attach the supplier invoice for review. Private files are
                      limited to PDF, JPG, PNG, or WEBP up to 10 MB.
                    </p>
                  </div>
                  {canManageAttachments && activeBillId ? (
                    <Button
                      asChild
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={billAttachments.upload.isPending || isReadOnly}
                    >
                      <label
                        htmlFor="bill-attachment-upload"
                        className="cursor-pointer"
                      >
                        {billAttachments.upload.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Paperclip className="mr-2 h-4 w-4" />
                        )}
                        Attach file
                      </label>
                    </Button>
                  ) : null}
                  <Input
                    id="bill-attachment-upload"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={
                      billAttachments.upload.isPending ||
                      isReadOnly ||
                      !activeBillId ||
                      !canManageAttachments
                    }
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void handleUploadAttachment(file);
                    }}
                  />
                </div>
                {billAttachments.upload.isPending ? (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${billAttachments.uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Uploading attachment… {billAttachments.uploadProgress}%
                    </p>
                  </div>
                ) : null}
                {!canManageAttachments ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    Attachments are available on Growth and Business plans.
                    Upgrade to store vendor invoice documents securely.
                  </p>
                ) : !activeBillId ? (
                  <p className="text-xs text-muted-foreground">
                    Save the bill first, then attach the supplier invoice.
                  </p>
                ) : billAttachments.isLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading attachments…
                  </p>
                ) : billAttachments.data?.length ? (
                  <div className="space-y-2">
                    {billAttachments.data.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {attachment.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(attachment.file_size)}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Open ${attachment.file_name}`}
                            onClick={() =>
                              void handleOpenAttachment(attachment)
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          {!isReadOnly ? (
                            <>
                              <Button
                                asChild
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={
                                  replacingAttachmentId === attachment.id
                                }
                                aria-label={`Replace ${attachment.file_name}`}
                              >
                                <label
                                  htmlFor={`replace-bill-attachment-${attachment.id}`}
                                  className="cursor-pointer"
                                >
                                  <Pencil className="h-4 w-4" />
                                </label>
                              </Button>
                              <Input
                                id={`replace-bill-attachment-${attachment.id}`}
                                type="file"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(event) => {
                                  const file = event.target.files?.[0];
                                  event.currentTarget.value = "";
                                  if (file)
                                    void handleReplaceAttachment(
                                      attachment,
                                      file,
                                    );
                                }}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Remove ${attachment.file_name}`}
                                onClick={() =>
                                  void handleRemoveAttachment(attachment)
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No supplier invoice attached yet.
                  </p>
                )}
              </div>
              <div className="flex gap-3 pt-4">
                {isReadOnly ? (
                  <>
                    <Button
                      variant="outline"
                      className="rounded-lg btn-press"
                      onClick={() => activeBill && handlePrintBill(activeBill)}
                      disabled={!activeBill}
                    >
                      <Printer className="mr-2 h-4 w-4" /> Print / Save PDF
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-lg btn-press"
                      onClick={() =>
                        activeBill && void handleSendBillEmail(activeBill)
                      }
                      disabled={!activeBill || sendBillEmail.isPending}
                    >
                      {sendBillEmail.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-2 h-4 w-4" />
                      )}{" "}
                      Send bill email
                    </Button>
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
                        if (activeBill) {
                          openEditDrawer(activeBill);
                        }
                      }}
                      disabled={!activeBill || activeBill.status === "paid"}
                    >
                      Edit Bill
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-lg btn-press"
                      onClick={() =>
                        void handleSaveBill(
                          sheetMode === "edit" &&
                            activeBill?.status === "scheduled"
                            ? "scheduled"
                            : "unpaid",
                        )
                      }
                      disabled={isMutating}
                    >
                      {isMutating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {sheetMode === "edit" ? "Save Changes" : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-lg btn-press"
                      onClick={() => void handleSaveBill("scheduled")}
                      disabled={isMutating}
                    >
                      Schedule Payment
                    </Button>
                    {sheetMode === "edit" ? (
                      <Button
                        className="flex-1 rounded-lg btn-press"
                        onClick={() =>
                          activeBill && void handlePayNow(activeBill)
                        }
                        disabled={
                          isMutating ||
                          !activeBill ||
                          payingBillId === activeBill.id
                        }
                      >
                        {payingBillId === activeBill?.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : null}
                        {payingBillId === activeBill?.id
                          ? "Paying..."
                          : "Pay now"}
                      </Button>
                    ) : null}
                  </>
                )}
              </div>
              {!isReadOnly ? (
                <p className="text-xs text-muted-foreground">
                  Pay now records the bill payment request in Moniger. It is not
                  a provider-executed bank transfer yet. Use Schedule Payment if
                  the payable should be tracked for later.
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </AppLayout>
  );
};

export default BillsPage;
