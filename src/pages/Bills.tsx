import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, MoreHorizontal, Pencil } from "lucide-react";
import { format } from "date-fns";
import AppLayout from "@/components/app/AppLayout";
import DataPage from "@/components/app/DataPage";
import OperationStatusNotice from "@/components/app/OperationStatusNotice";
import StatusBadge from "@/components/app/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useVendorsDirectory } from "@/hooks/use-directory-data";
import { useBillMutations, useBillsData, useCategoriesList, type BillRecord } from "@/hooks/use-finance-data";
import { useSettingsData } from "@/hooks/use-settings-data";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { billCategories, formatNaira } from "@/data/seedData";
import { getFormFieldAriaProps } from "@/lib/accessibility";
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
import { createFormValidator, getFriendlyErrorMessage, ValidationRules } from "@/lib/error-handling";

type SheetMode = "create" | "edit" | "view";
type BillFormState = {
  amount: number;
  billDate: string;
  billNumber: string;
  category: string;
  dueDate: string;
  notes: string;
  vendorId: string;
};
type BillFormErrors = Partial<Record<"amount" | "billDate" | "vendorId", string>>;

const createBillForm = (billNumber: string): BillFormState => ({
  amount: 0,
  billDate: format(new Date(), "yyyy-MM-dd"),
  billNumber,
  category: "",
  dueDate: "",
  notes: "",
  vendorId: "",
});

const billFormValidator = createFormValidator({
  amount: [ValidationRules.minNumber(0.01, "Enter an amount greater than zero.")],
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
  return Number.isNaN(scheduledDate.getTime()) ? null : scheduledDate.toISOString();
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

const pluralize = (count: number, singular: string, plural = `${singular}s`) => (count === 1 ? singular : plural);

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

const BillsPage = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const vendorsQuery = useVendorsDirectory(businessId);
  const billsQuery = useBillsData(businessId);
  const { createBill, deleteBill, updateBill, updateBillStatus } = useBillMutations(businessId, user?.id);

  const [search, setSearch] = useSearchParamState();
  const [tab, setTab] = useState("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState<SheetMode>("create");
  const [activeBillId, setActiveBillId] = useState<string | null>(null);
  const [form, setForm] = useState<BillFormState>(createBillForm("BILL-001"));
  const [formErrors, setFormErrors] = useState<BillFormErrors>({});
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>({});
  const [payingBillId, setPayingBillId] = useState<string | null>(null);

  const bills = useMemo(() => billsQuery.data ?? [], [billsQuery.data]);
  const vendors = useMemo(() => vendorsQuery.data ?? [], [vendorsQuery.data]);
  const categoriesQuery = useCategoriesList();
  const categoriesOptions = useMemo(
    () => (categoriesQuery.data?.map((c) => ({ label: c.name, value: c.name })) ?? billCategories.map((category) => ({ label: category, value: category }))),
    [categoriesQuery.data],
  );
  const activeBill = useMemo(() => bills.find((bill) => bill.id === activeBillId) ?? null, [activeBillId, bills]);
  const nextNumber = useMemo(
    () => generateNextDocumentNumber(bills.map((bill) => bill.billNumber), "BILL", 3),
    [bills],
  );
  const advancedFilterDefinitions: AdvancedFilterDefinition[] = useMemo(
    () => [
      {
        emptyLabel: "All vendors",
        id: "vendorId",
        label: "Vendor",
        options: vendors.map((vendor) => ({ label: vendor.businessName, value: vendor.id })),
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
    const selectedCategories = getMultiSelectFilterValue(advancedFilters.category);
    const billDateRange = isDateRangeFilterValue(advancedFilters.billDate) ? advancedFilters.billDate : undefined;
    const dueDateRange = isDateRangeFilterValue(advancedFilters.dueDate) ? advancedFilters.dueDate : undefined;
    const amountRange = isNumberRangeFilterValue(advancedFilters.amount) ? advancedFilters.amount : undefined;

    if (tab !== "all") {
      list = list.filter((bill) => bill.status === tab);
    }

    list = list.filter((bill) => {
      if (vendorFilter && bill.vendorId !== vendorFilter) {
        return false;
      }

      if (selectedCategories.length > 0 && !selectedCategories.includes(bill.category || "")) {
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
  }, [advancedFilters.amount, advancedFilters.billDate, advancedFilters.category, advancedFilters.dueDate, advancedFilters.vendorId, bills, search, tab]);

  const tabs = useMemo(
    () => [
      { label: "All", count: bills.length, value: "all" },
      { label: "Unpaid", count: bills.filter((bill) => bill.status === "unpaid").length, value: "unpaid" },
      { label: "Scheduled", count: bills.filter((bill) => bill.status === "scheduled").length, value: "scheduled" },
      { label: "Paid", count: bills.filter((bill) => bill.status === "paid").length, value: "paid" },
      { label: "Overdue", count: bills.filter((bill) => bill.status === "overdue").length, value: "overdue" },
    ],
    [bills],
  );

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isBillsLoading = billsQuery.isLoading && !billsQuery.data;
  const isVendorsLoading = vendorsQuery.isLoading && !vendorsQuery.data;
  const isMutating =
    createBill.isPending || deleteBill.isPending || updateBill.isPending || updateBillStatus.isPending || payingBillId !== null;
  const isReadOnly = sheetMode === "view";

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
      amount: Number(form.amount) || 0,
      billDate: form.billDate,
      vendorId: form.vendorId,
    }) as BillFormErrors;
  };

  const buildPayload = (status: BillRecord["status"]) => ({
    amount: Math.max(0, Number(form.amount) || 0),
    bill_date: form.billDate,
    bill_number: form.billNumber,
    category: normalizeOptionalText(form.category),
    due_date: normalizeOptionalText(form.dueDate),
    notes: normalizeOptionalText(form.notes),
    scheduled_payment_date: status === "scheduled" ? normalizeOptionalText(form.dueDate) ?? form.billDate : null,
    status,
    vendor_id: form.vendorId,
  });

  const handleSaveBill = async (targetStatus: BillRecord["status"]) => {
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
          title: targetStatus === "paid" ? "Bill paid" : targetStatus === "scheduled" ? "Bill scheduled" : "Bill updated",
          description:
            targetStatus === "paid"
              ? `${form.billNumber} has been marked as paid.`
              : `${form.billNumber} has been saved.`,
        });
      } else {
        await createBill.mutateAsync(buildPayload(targetStatus));
        toast({
          title: targetStatus === "paid" ? "Bill paid" : targetStatus === "scheduled" ? "Bill scheduled" : "Bill saved",
          description: `${form.billNumber} has been created.`,
        });
      }

      setFormErrors({});
      closeDrawer();
    } catch (error) {
      toast({
        title: sheetMode === "edit" ? "Unable to update bill" : "Unable to create bill",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handlePayNow = async (bill: BillRecord) => {
    if (!businessId || !user?.id) {
      toast({
        title: "Unable to start payout",
        description: "A signed-in workspace owner, admin, or accountant is required before you can pay a bill.",
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

    let payoutResult: Awaited<ReturnType<typeof requestWorkspaceBillPayout>> | null = null;

    try {
      payoutResult = await requestWorkspaceBillPayout({
        billId: bill.id,
        businessId,
        idempotencyKey: `bill-${bill.id}`,
      });

      await queryClient.invalidateQueries({ queryKey: ["bills", businessId] });
      await queryClient.invalidateQueries({ queryKey: ["workspace-payouts", businessId] });

      toast({
        title: payoutResult.payoutStatus === "pending_approval" ? "Payout needs approval" : "Payout submitted",
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
        description: "A signed-in workspace owner, admin, or accountant is required before you can schedule a bill payout.",
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
        description: "Add a due date to this bill before scheduling the payout.",
        variant: "destructive",
      });
      return;
    }

    const scheduledFor = buildScheduledFor(bill.dueDate);
    if (!scheduledFor) {
      toast({
        title: "Unable to schedule payout",
        description: "The bill due date could not be converted into a payout time.",
        variant: "destructive",
      });
      return;
    }

    setPayingBillId(bill.id);

    let scheduleResult: Awaited<ReturnType<typeof scheduleWorkspaceBillPayout>> | null = null;

    try {
      scheduleResult = await scheduleWorkspaceBillPayout({
        billId: bill.id,
        businessId,
        idempotencyKey: `bill-schedule-${bill.id}`,
        scheduledFor,
      });

      await updateBillStatus.mutateAsync({ bill, status: "scheduled" });
      await queryClient.invalidateQueries({ queryKey: ["workspace-payouts", businessId] });

      toast({
        title: scheduleResult.payoutStatus === "pending_approval" ? "Payout needs approval" : "Payout scheduled",
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

    const confirmed = window.confirm(`Delete ${bill.billNumber}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteBill.mutateAsync({ billId: bill.id, billNumber: bill.billNumber });
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

  const handleStatusChange = async (bill: BillRecord, status: BillRecord["status"]) => {
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

    const descriptionParts = [`${updatedCount} ${pluralize(updatedCount, "bill")} updated`];
    if (skippedCount > 0) {
      descriptionParts.push(`${skippedCount} skipped`);
    }
    if (failedCount > 0) {
      descriptionParts.push(`${failedCount} failed`);
    }

    toast({
      title: failedCount > 0 ? "Bulk update partially completed" : "Bills updated",
      description: descriptionParts.join(", "),
      variant: failedCount > 0 ? "destructive" : "default",
    });
  };

  const handleBulkBillDelete = async (selectedBills: BillRecord[], clearSelection: () => void) => {
    const deletableBills = selectedBills.filter((bill) => bill.status === "unpaid");

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
        await deleteBill.mutateAsync({ billId: bill.id, billNumber: bill.billNumber });
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

    const descriptionParts = [`${deletedCount} ${pluralize(deletedCount, "bill")} deleted`];
    if (skippedCount > 0) {
      descriptionParts.push(`${skippedCount} skipped`);
    }
    if (failedCount > 0) {
      descriptionParts.push(`${failedCount} failed`);
    }

    toast({
      title: failedCount > 0 ? "Bulk delete partially completed" : "Bills deleted",
      description: descriptionParts.join(", "),
      variant: failedCount > 0 ? "destructive" : "default",
    });
  };

  const columns = [
    {
      key: "billNumber",
      header: "Bill #",
      render: (row: BillRecord) => <span className="font-medium text-foreground">{row.billNumber}</span>,
    },
    { key: "vendor", header: "Vendor", render: (row: BillRecord) => row.vendorName },
    { key: "billDate", header: "Bill Date", render: (row: BillRecord) => row.billDate },
    { key: "dueDate", header: "Due Date", render: (row: BillRecord) => row.dueDate || "-" },
    { key: "amount", header: "Amount", render: (row: BillRecord) => <span className="font-medium">{formatNaira(row.amount)}</span> },
    { key: "status", header: "Status", render: (row: BillRecord) => statusBadge(row.status) },
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
              <DropdownMenuItem onClick={() => void handlePayNow(row)} disabled={row.status === "paid" || payingBillId === row.id}>
                {payingBillId === row.id ? "Paying..." : "Pay now"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => void handleSchedulePayment(row)}
                disabled={row.status === "paid" || row.status === "scheduled" || !row.dueDate}
              >
                Schedule Payment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleDeleteBill(row)} className="text-destructive">
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

        {billsQuery.error ? (
          <OperationStatusNotice
            title="Bills unavailable"
            description={getErrorMessage(billsQuery.error, "We could not load your bills right now.")}
            state="error"
            onRetry={() => void billsQuery.refetch()}
            retryLabel="Retry bills"
          />
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Bills will appear here once the business record is available.
          </div>
        ) : null}

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
                onClick={() => void handleBulkBillStatusChange(selectedRows, "scheduled", clearSelection)}
                disabled={isMutating}
              >
                Schedule
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleBulkBillStatusChange(selectedRows, "paid", clearSelection)}
                disabled={isMutating}
              >
                Mark Paid
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleBulkBillStatusChange(selectedRows, "unpaid", clearSelection)}
                disabled={isMutating}
              >
                Mark Unpaid
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleBulkBillDelete(selectedRows, clearSelection)}
                disabled={isMutating}
              >
                Delete
              </Button>
            </>
          )}
        />
      </div>

      <Sheet open={drawerOpen} onOpenChange={(open) => (open ? setDrawerOpen(true) : closeDrawer())}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>
              {sheetMode === "create"
                ? "Add Bill"
                : sheetMode === "edit"
                  ? `Edit ${form.billNumber}`
                  : `Bill ${form.billNumber}`}
            </SheetTitle>
            <SheetDescription>
              Review vendor, amount, dates, and payment details for this bill.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bill-vendor">Vendor</Label>
              <Select
                value={form.vendorId}
                onValueChange={(value) => {
                  clearFormError("vendorId");
                  setForm((currentForm) => ({ ...currentForm, vendorId: value }));
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
              {formErrors.vendorId ? (
                <p id="bill-vendor-error" className={inlineErrorClassName} role="alert">
                  {formErrors.vendorId}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-number">Bill #</Label>
              <Input id="bill-number" value={form.billNumber} disabled className="rounded-lg bg-muted" />
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
                    setForm((currentForm) => ({ ...currentForm, billDate: event.target.value }));
                  }}
                  className={`rounded-lg ${formErrors.billDate ? inputErrorClassName : ""}`}
                  disabled={isReadOnly}
                />
                {formErrors.billDate ? (
                  <p id="bill-date-error" className={inlineErrorClassName} role="alert">
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
                  onChange={(event) => setForm((currentForm) => ({ ...currentForm, dueDate: event.target.value }))}
                  className="rounded-lg"
                  disabled={isReadOnly}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bill-amount">Amount</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                <Input
                  {...getFormFieldAriaProps({
                    label: "Amount",
                    error: formErrors.amount,
                    id: "bill-amount",
                    required: true,
                  })}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={form.amount || ""}
                  onChange={(event) => {
                    clearFormError("amount");
                    setForm((currentForm) => ({ ...currentForm, amount: Number(event.target.value) }));
                  }}
                  className={`rounded-lg pl-9 ${formErrors.amount ? inputErrorClassName : ""}`}
                  placeholder="0"
                  disabled={isReadOnly}
                />
              </div>
              {formErrors.amount ? (
                <p id="bill-amount-error" className={inlineErrorClassName} role="alert">
                  {formErrors.amount}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((currentForm) => ({ ...currentForm, category: value }))}
                disabled={isReadOnly}
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categoriesQuery.data?.length ? categoriesQuery.data.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  )) : billCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))) as React.ReactNode}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={form.notes}
                onChange={(event) => setForm((currentForm) => ({ ...currentForm, notes: event.target.value }))}
                className="rounded-lg"
                rows={3}
                disabled={isReadOnly}
              />
            </div>
            <div className="flex gap-3 pt-4">
              {isReadOnly ? (
                <>
                  <Button variant="outline" className="flex-1 rounded-lg btn-press" onClick={closeDrawer}>
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
                      void handleSaveBill(sheetMode === "edit" && activeBill?.status === "scheduled" ? "scheduled" : "unpaid")
                    }
                    disabled={isMutating}
                  >
                    {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
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
                      onClick={() => activeBill && void handlePayNow(activeBill)}
                      disabled={isMutating || !activeBill || payingBillId === activeBill.id}
                    >
                      {payingBillId === activeBill?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {payingBillId === activeBill?.id ? "Paying..." : "Pay now"}
                    </Button>
                  ) : null}
                </>
              )}
            </div>
            {!isReadOnly ? (
              <p className="text-xs text-muted-foreground">
                `Pay now` creates a real payout request through the workspace wallet and the bill settles when the transfer
                completes. Use `Schedule Payment` if the payment should happen later.
              </p>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
};

export default BillsPage;
