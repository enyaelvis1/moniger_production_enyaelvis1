import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import DataPage from "@/components/app/DataPage";
import StatusBadge from "@/components/app/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useToast } from "@/hooks/use-toast";
import { useVendorMutations, useVendorsDirectory, useBanksList, useBankMutations, type VendorDirectoryItem } from "@/hooks/use-directory-data";
import { useSearchParamState } from "@/hooks/use-search-param";
import { Button } from "@/components/ui/button";
import { AdvancedFilter } from "@/components/ui/advanced-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNaira, nigerianBanks } from "@/data/seedData";
import { getFormFieldAriaProps } from "@/lib/accessibility";
import {
  getStringFilterValue,
  isNumberRangeFilterValue,
  matchesNumberRange,
  type AdvancedFilterDefinition,
  type AdvancedFilterState,
} from "@/lib/advanced-filters";
import { createFormValidator, getFriendlyErrorMessage, ValidationRules } from "@/lib/error-handling";
import { filterPhoneInput, normalizePhoneNumber, phonePlaceholder } from "@/lib/phone";

const billStatusVariant = (status: VendorDirectoryItem["bills"][number]["status"]) => {
  const variants = {
    overdue: "red",
    paid: "green",
    scheduled: "blue",
    unpaid: "amber",
  } as const;

  return variants[status];
};

const billStatusLabel = (status: VendorDirectoryItem["bills"][number]["status"]) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const normalizeRequiredText = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeOptionalText = (value: string) => {
  const normalized = normalizeRequiredText(value);
  return normalized || null;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const getDeleteErrorMessage = (error: unknown, entityName: string) => {
  const message = getErrorMessage(error, `Unable to delete ${entityName}.`);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("violates foreign key constraint")) {
    return `This ${entityName} already has linked records and cannot be deleted yet.`;
  }

  return message;
};

type VendorFormState = {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankId: string;
  businessName: string;
  contactName: string;
  email: string;
  notes: string;
  phone: string;
};
type VendorFormErrors = Partial<Record<"accountNumber" | "businessName" | "email" | "phone", string>>;
type VendorFormStep = "business" | "payout";

const emptyForm: VendorFormState = {
  accountName: "",
  accountNumber: "",
  bankName: "",
  bankId: "",
  businessName: "",
  contactName: "",
  email: "",
  notes: "",
  phone: "",
};

const vendorFormValidator = createFormValidator({
  accountNumber: [ValidationRules.optional(ValidationRules.accountNumber())],
  businessName: [ValidationRules.trimmedRequired()],
  email: [ValidationRules.optional(ValidationRules.email())],
  phone: [ValidationRules.optional(ValidationRules.phone())],
});
const inputErrorClassName = "border-destructive focus-visible:ring-destructive";
const inlineErrorClassName = "text-sm font-medium text-destructive";
const vendorStepOrder: VendorFormStep[] = ["business", "payout"];
const vendorStepMeta: Record<VendorFormStep, { description: string; index: number; title: string }> = {
  business: {
    description: "Business and contact",
    index: 1,
    title: "Business",
  },
  payout: {
    description: "Payout and notes",
    index: 2,
    title: "Payout",
  },
};

const VendorsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const vendorsQuery = useVendorsDirectory(businessId);
  const banksQuery = useBanksList();
  const { createBank } = useBankMutations(businessId, user?.id);
  const [bankFilter, setBankFilter] = useState("");
  const { createVendor, deleteVendor, updateVendor } = useVendorMutations(businessId, user?.id);

  const [search, setSearch] = useSearchParamState();
  const [tab, setTab] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailVendorId, setDetailVendorId] = useState<string | null>(null);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);
  const [form, setForm] = useState<VendorFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<VendorFormErrors>({});
  const [formStep, setFormStep] = useState<VendorFormStep>("business");
  const [hasTriedVendorStepAdvance, setHasTriedVendorStepAdvance] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>({});

  const allVendors = useMemo(() => vendorsQuery.data ?? [], [vendorsQuery.data]);
  const detailVendor = useMemo(
    () => allVendors.find((vendor) => vendor.id === detailVendorId) ?? null,
    [allVendors, detailVendorId],
  );
  const advancedFilterDefinitions: AdvancedFilterDefinition[] = useMemo(
    () => [
      {
        emptyLabel: "All contact states",
        id: "contactState",
        label: "Contact Coverage",
        options: [
          { label: "Has email", value: "with-email" },
          { label: "Has contact name", value: "with-contact-name" },
          { label: "Missing contact details", value: "missing-contact" },
        ],
        type: "select",
      },
      {
        emptyLabel: "All bank states",
        id: "bankState",
        label: "Bank Details",
        options: [
          { label: "Has bank details", value: "with-bank-details" },
          { label: "Missing bank details", value: "missing-bank-details" },
        ],
        type: "select",
      },
      {
        emptyLabel: "All activity",
        id: "activity",
        label: "Bill Activity",
        options: [
          { label: "With bill history", value: "with-bills" },
          { label: "Without bill history", value: "without-bills" },
        ],
        type: "select",
      },
      {
        id: "totalPaid",
        label: "Total Paid",
        maxPlaceholder: "10000000",
        minPlaceholder: "0",
        step: "0.01",
        type: "number-range",
      },
    ],
    [],
  );

  useEffect(() => {
    if (detailVendorId && !detailVendor) {
      setDetailVendorId(null);
    }
  }, [detailVendor, detailVendorId]);

  const filtered = useMemo(() => {
    let list = allVendors;
    const contactState = getStringFilterValue(advancedFilters.contactState);
    const bankState = getStringFilterValue(advancedFilters.bankState);
    const activityFilter = getStringFilterValue(advancedFilters.activity);
    const totalPaidRange = isNumberRangeFilterValue(advancedFilters.totalPaid) ? advancedFilters.totalPaid : undefined;

    if (tab === "Paid") {
      list = list.filter((vendor) => vendor.totalPaid > 0);
    }

    list = list.filter((vendor) => {
      if (contactState === "with-email" && !vendor.email) {
        return false;
      }

      if (contactState === "with-contact-name" && !vendor.contactName) {
        return false;
      }

      if (contactState === "missing-contact" && (vendor.email || vendor.contactName || vendor.phone)) {
        return false;
      }

      const hasBankDetails = Boolean(vendor.bankName && vendor.accountName && vendor.accountNumber);
      if (bankState === "with-bank-details" && !hasBankDetails) {
        return false;
      }

      if (bankState === "missing-bank-details" && hasBankDetails) {
        return false;
      }

      if (activityFilter === "with-bills" && vendor.bills.length === 0) {
        return false;
      }

      if (activityFilter === "without-bills" && vendor.bills.length > 0) {
        return false;
      }

      if (!matchesNumberRange(vendor.totalPaid, totalPaidRange)) {
        return false;
      }

      return true;
    });

    if (!search) {
      return list;
    }

    const normalizedSearch = search.toLowerCase();
    return list.filter(
      (vendor) =>
        vendor.businessName.toLowerCase().includes(normalizedSearch) ||
        (vendor.email ?? "").toLowerCase().includes(normalizedSearch) ||
        (vendor.contactName ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [advancedFilters.activity, advancedFilters.bankState, advancedFilters.contactState, advancedFilters.totalPaid, allVendors, search, tab]);

  const tabs = useMemo(
    () => [
      { label: "All", count: allVendors.length, value: "All" },
      { label: "Paid", count: allVendors.filter((vendor) => vendor.totalPaid > 0).length, value: "Paid" },
    ],
    [allVendors],
  );

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isVendorsLoading = vendorsQuery.isLoading && !vendorsQuery.data;
  const isMutating = createVendor.isPending || deleteVendor.isPending || updateVendor.isPending;

  const openCreateModal = () => {
    setEditingVendorId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormStep("business");
    setHasTriedVendorStepAdvance(false);
    setModalOpen(true);
  };

  const openEditModal = (vendor: VendorDirectoryItem) => {
    setEditingVendorId(vendor.id);
    setForm({
      accountName: vendor.accountName ?? "",
      accountNumber: vendor.accountNumber ?? "",
      bankName: vendor.bankName ?? "",
      bankId: vendor.bankId ?? vendor.bankName ?? "",
      businessName: vendor.businessName,
      contactName: vendor.contactName ?? "",
      email: vendor.email ?? "",
      notes: vendor.notes ?? "",
      phone: vendor.phone ?? "",
    });
    setFormErrors({});
    setFormStep("business");
    setHasTriedVendorStepAdvance(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isMutating) {
      return;
    }

    setModalOpen(false);
    setEditingVendorId(null);
    setForm(emptyForm);
    setFormErrors({});
    setFormStep("business");
    setHasTriedVendorStepAdvance(false);
  };

  const clearFormError = (field: keyof VendorFormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const getVendorStepErrors = (step: VendorFormStep): VendorFormErrors => {
    const validationErrors = vendorFormValidator({
      accountNumber: form.accountNumber.trim(),
      businessName: form.businessName,
      email: form.email.trim(),
      phone: form.phone.trim(),
    }) as VendorFormErrors;

    if (step === "business") {
      return {
        businessName: validationErrors.businessName,
        email: validationErrors.email,
        phone: validationErrors.phone,
      };
    }

    return {
      accountNumber: validationErrors.accountNumber,
    };
  };

  const goToVendorStep = (nextStep: VendorFormStep) => {
    const currentStepIndex = vendorStepOrder.indexOf(formStep);
    const nextStepIndex = vendorStepOrder.indexOf(nextStep);

    if (nextStepIndex <= currentStepIndex) {
      setFormStep(nextStep);
      return;
    }

    setHasTriedVendorStepAdvance(true);
    const stepErrors = getVendorStepErrors(formStep);
    const hasErrors = Object.values(stepErrors).some(Boolean);

    if (hasErrors) {
      setFormErrors((currentErrors) => ({ ...currentErrors, ...stepErrors }));
      return;
    }

    setFormErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      if (formStep === "business") {
        delete nextErrors.businessName;
        delete nextErrors.email;
        delete nextErrors.phone;
      }
      if (formStep === "payout") {
        delete nextErrors.accountNumber;
      }
      return nextErrors;
    });
    setFormStep(nextStep);
    setHasTriedVendorStepAdvance(false);
  };

  const handleSaveVendor = async () => {
    const validationErrors = vendorFormValidator({
      accountNumber: form.accountNumber.trim(),
      businessName: form.businessName,
      email: form.email.trim(),
      phone: form.phone.trim(),
    }) as VendorFormErrors;

    if (Object.keys(validationErrors).length > 0) {
      setHasTriedVendorStepAdvance(true);
      setFormErrors(validationErrors);
      setFormStep(validationErrors.accountNumber ? "payout" : "business");
      return;
    }

    const normalizedBusinessName = normalizeRequiredText(form.businessName);

    // Determine bank selection: prefer bankId (DB id). If a name was chosen and not present in DB, create it.
    let selectedBankId: string | null = form.bankId?.trim() || null;
    let selectedBankName: string | null = form.bankName || null;

    if (selectedBankId) {
      const foundById = banksQuery.data?.find((b) => b.id === selectedBankId);
      if (foundById) {
        selectedBankName = foundById.name;
      } else {
        // Maybe the value is a fallback name; try to find by label
        const foundByName = banksQuery.data?.find((b) => b.name.toLowerCase() === selectedBankId?.toLowerCase());
        if (foundByName) {
          selectedBankId = foundByName.id;
          selectedBankName = foundByName.name;
        } else if (!selectedBankId.match?.(/^[0-9a-fA-F-]{36}$/)) {
          // treat as a name string and create the bank
          try {
            const created = await createBank.mutateAsync(selectedBankId);
            selectedBankId = created?.id ?? selectedBankId;
            selectedBankName = created?.name ?? selectedBankName;
          } catch (err) {
            toast({ title: "Unable to add bank", description: getErrorMessage(err, "Please try again."), variant: "destructive" });
            return;
          }
        }
      }
    }

    const payload = {
      account_name: normalizeOptionalText(form.accountName),
      account_number: normalizeOptionalText(form.accountNumber),
      bank_name: normalizeOptionalText(selectedBankName ?? form.bankName),
      bank_id: selectedBankId,
      business_name: normalizedBusinessName,
      contact_name: normalizeOptionalText(form.contactName),
      email: normalizeOptionalText(form.email),
      notes: normalizeOptionalText(form.notes),
      phone: normalizePhoneNumber(form.phone),
    };

    try {
      if (editingVendorId) {
        await updateVendor.mutateAsync({ values: payload, vendorId: editingVendorId });
        toast({ title: "Vendor updated", description: `${normalizedBusinessName} has been updated.` });
      } else {
        await createVendor.mutateAsync(payload);
        toast({ title: "Vendor added", description: `${normalizedBusinessName} has been added to your vendor list.` });
      }

      setFormErrors({});
      closeModal();
    } catch (error) {
      toast({
        title: editingVendorId ? "Unable to update vendor" : "Unable to add vendor",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteVendor = async (vendor: VendorDirectoryItem) => {
    const confirmed = window.confirm(`Delete ${vendor.businessName}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteVendor.mutateAsync({ vendorId: vendor.id, vendorName: vendor.businessName });
      toast({ title: "Vendor deleted", description: `${vendor.businessName} has been removed.` });
    } catch (error) {
      toast({
        title: "Unable to delete vendor",
        description: getDeleteErrorMessage(error, "vendor"),
        variant: "destructive",
      });
    }
  };

  const currentVendorStepErrors = getVendorStepErrors(formStep);
  const currentVendorStepMessage =
    (hasTriedVendorStepAdvance ? Object.values(currentVendorStepErrors).find((value): value is string => Boolean(value)) : undefined) ??
    (formStep === "business"
      ? "Add the core vendor identity so the payout step has the right context."
      : "Finish payout details if you want this vendor ready for payable workflows.");

  const formBankLabel = banksQuery.data?.find((b) => b.id === form.bankId)?.name ?? form.bankName;

  const columns = [
    {
      key: "name",
      header: "Vendor Name",
      render: (row: VendorDirectoryItem) => <span className="font-medium text-foreground">{row.businessName}</span>,
    },
    { key: "email", header: "Email", render: (row: VendorDirectoryItem) => row.email || "—" },
    { key: "phone", header: "Phone", render: (row: VendorDirectoryItem) => row.phone || "—" },
    { key: "account", header: "Account Number", render: (row: VendorDirectoryItem) => row.accountNumber || "—" },
    {
      key: "totalPaid",
      header: "Total Paid",
      render: (row: VendorDirectoryItem) => <span className="font-medium">{formatNaira(row.totalPaid)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: VendorDirectoryItem) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              setDetailVendorId(row.id);
            }}
            aria-label={`View vendor ${row.businessName}`}
          >
            <Eye size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              openEditModal(row);
            }}
            aria-label={`Edit vendor ${row.businessName}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              void handleDeleteVendor(row);
            }}
            aria-label={`Delete vendor ${row.businessName}`}
          >
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppLayout>
      <div className="page-enter space-y-6">
        {settingsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(settingsQuery.error, "We could not load your workspace.")}
          </div>
        ) : null}

        {vendorsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(vendorsQuery.error, "We could not load your vendors right now.")}
          </div>
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Vendors will appear here once the business record is available.
          </div>
        ) : null}

        {detailVendor ? (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setDetailVendorId(null)} className="mb-2">
              ← Back to Vendors
            </Button>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col items-start gap-4 sm:flex-row">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                  {detailVendor.businessName[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-foreground">{detailVendor.businessName}</h2>
                  <p className="text-sm text-muted-foreground">{detailVendor.contactName || "No contact name"}</p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{detailVendor.email || "No email"}</span>
                    <span>{detailVendor.phone || "No phone"}</span>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {(detailVendor.bankName || "No bank") + " — " + (detailVendor.accountNumber || "No account number")}
                  </div>
                  {detailVendor.accountName ? (
                    <div className="mt-1 text-sm text-muted-foreground">{detailVendor.accountName}</div>
                  ) : null}
                  {detailVendor.notes ? <p className="mt-2 text-sm text-muted-foreground">{detailVendor.notes}</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-xl font-bold text-foreground">{formatNaira(detailVendor.totalPaid)}</p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">Transaction History</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Transaction history for vendor {detailVendor.businessName}</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th scope="col" className="table-header px-4 py-3 text-left">Bill #</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Date</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Amount</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailVendor.bills.map((bill, index) => (
                      <tr key={bill.id} className={`border-b border-border last:border-0 ${index % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 font-medium">{bill.billNumber}</td>
                        <td className="px-4 py-3">{bill.billDate}</td>
                        <td className="px-4 py-3 font-medium">{formatNaira(bill.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={billStatusVariant(bill.status)}>{billStatusLabel(bill.status)}</StatusBadge>
                        </td>
                      </tr>
                    ))}
                    {detailVendor.bills.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          No transactions yet
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {modalOpen ? (
              <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 xl:p-8">
                <div className="sticky top-0 z-20 -mx-5 border-b border-border bg-card/95 px-5 pb-5 pt-4 backdrop-blur supports-[backdrop-filter]:bg-card/90 sm:-mx-6 sm:px-6 xl:static xl:mx-0 xl:bg-transparent xl:px-0 xl:pt-0 xl:backdrop-blur-0">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-secondary">Vendor workspace</p>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {editingVendorId ? "Edit Vendor" : "Add Vendor"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Manage vendor contacts and payout details for bills and payable workflows.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 xl:hidden">
                    {vendorStepOrder.map((step, index) => {
                      const stepIndex = vendorStepOrder.indexOf(step);
                      const activeStepIndex = vendorStepOrder.indexOf(formStep);
                      const isActive = formStep === step;
                      const isComplete = stepIndex < activeStepIndex;
                      const canJump = stepIndex <= activeStepIndex + 1;

                      return (
                        <div key={step} className="flex min-w-0 flex-1 items-center">
                          <button
                            type="button"
                            onClick={() => goToVendorStep(step)}
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                              isActive
                                ? "bg-primary text-primary-foreground"
                                : isComplete
                                  ? "bg-secondary/15 text-secondary"
                                  : "bg-muted text-muted-foreground"
                            }`}
                            aria-current={isActive ? "step" : undefined}
                            aria-label={`Go to step ${vendorStepMeta[step].index}: ${vendorStepMeta[step].description}`}
                            disabled={!canJump && !isComplete}
                          >
                            {vendorStepMeta[step].index}
                          </button>
                          {index < vendorStepOrder.length - 1 ? (
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
                  <div className="hidden gap-2 xl:grid xl:grid-cols-2">
                    {vendorStepOrder.map((step) => {
                      const stepIndex = vendorStepOrder.indexOf(step);
                      const activeStepIndex = vendorStepOrder.indexOf(formStep);
                      const isActive = formStep === step;
                      const isComplete = stepIndex < activeStepIndex;
                      const canJump = stepIndex <= activeStepIndex + 1;

                      return (
                        <button
                          key={step}
                          type="button"
                          onClick={() => goToVendorStep(step)}
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
                                Step {vendorStepMeta[step].index}
                              </p>
                              <p className={`mt-1 text-sm font-semibold ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                                {vendorStepMeta[step].title}
                              </p>
                              <p className={`text-sm ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                {vendorStepMeta[step].description}
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
                              {isComplete ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-semibold">{vendorStepMeta[step].index}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    {formStep === "business" ? (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="vendor-business-name">Business Name</Label>
                          <Input
                            {...getFormFieldAriaProps({
                              error: formErrors.businessName,
                              id: "vendor-business-name",
                              required: true,
                            })}
                            value={form.businessName}
                            onChange={(event) => {
                              clearFormError("businessName");
                              setForm((current) => ({ ...current, businessName: event.target.value }));
                            }}
                            className={`rounded-lg ${formErrors.businessName ? inputErrorClassName : ""}`}
                          />
                          {formErrors.businessName ? (
                            <p id="vendor-business-name-error" className={inlineErrorClassName} role="alert">
                              {formErrors.businessName}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vendor-contact-name">Contact Name</Label>
                          <Input
                            id="vendor-contact-name"
                            value={form.contactName}
                            onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                            className="rounded-lg"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vendor-phone">Phone</Label>
                          <Input
                            {...getFormFieldAriaProps({
                              error: formErrors.phone,
                              id: "vendor-phone",
                            })}
                            id="vendor-phone"
                            type="tel"
                            inputMode="tel"
                            pattern="[+0-9 ()\\-]+"
                            value={form.phone}
                            onChange={(event) => {
                              clearFormError("phone");
                              setForm((current) => ({ ...current, phone: filterPhoneInput(event.target.value) }));
                            }}
                            className={`rounded-lg ${formErrors.phone ? inputErrorClassName : ""}`}
                            placeholder={phonePlaceholder}
                          />
                          <p className="text-xs text-muted-foreground">Use international format, for example {phonePlaceholder}.</p>
                          {formErrors.phone ? (
                            <p id="vendor-phone-error" className={inlineErrorClassName} role="alert">
                              {formErrors.phone}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="vendor-email">Email</Label>
                          <Input
                            {...getFormFieldAriaProps({
                              error: formErrors.email,
                              id: "vendor-email",
                            })}
                            type="email"
                            value={form.email}
                            onChange={(event) => {
                              clearFormError("email");
                              setForm((current) => ({ ...current, email: event.target.value }));
                            }}
                            className={`rounded-lg ${formErrors.email ? inputErrorClassName : ""}`}
                          />
                          {formErrors.email ? (
                            <p id="vendor-email-error" className={inlineErrorClassName} role="alert">
                              {formErrors.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Bank Name</Label>
                          <Select value={form.bankId || form.bankName} onValueChange={(value) => setForm((current) => ({ ...current, bankId: value }))}>
                            <SelectTrigger className="rounded-lg">
                              <SelectValue placeholder="Select bank" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="p-2">
                                <Input
                                  placeholder="Search or add bank"
                                  value={bankFilter}
                                  onChange={(e) => setBankFilter(e.target.value)}
                                  className="w-full"
                                />
                              </div>
                              {(() => {
                                const normalizedQuery = bankFilter.trim().toLowerCase();

                                const bankOptions: { value: string; label: string }[] = banksQuery.data && banksQuery.data.length > 0
                                  ? banksQuery.data.map((b) => ({ value: b.id, label: b.name }))
                                  : nigerianBanks.map((n) => ({ value: n, label: n }));

                                const filtered = normalizedQuery
                                  ? bankOptions.filter((opt) => opt.label.toLowerCase().includes(normalizedQuery))
                                  : bankOptions;

                                return (
                                  <>
                                    {filtered.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                    {normalizedQuery && !bankOptions.some((n) => n.label.toLowerCase() === normalizedQuery) ? (
                                      <div className="px-2 py-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            const newName = bankFilter.trim();
                                            if (!newName) return;
                                            try {
                                              const created = await createBank.mutateAsync(newName);
                                              // created should be the inserted bank row { id, name, is_active }
                                              setForm((current) => ({ ...current, bankId: created?.id ?? newName, bankName: created?.name ?? newName }));
                                              setBankFilter("");
                                              toast({ title: "Bank added", description: `${newName} has been added.` });
                                            } catch (err) {
                                              toast({ title: "Unable to add bank", description: getErrorMessage(err, "Please try again."), variant: "destructive" });
                                            }
                                          }}
                                          className="w-full"
                                        >
                                          Add "{bankFilter.trim()}"
                                        </Button>
                                      </div>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vendor-account-number">Account Number</Label>
                          <Input
                            {...getFormFieldAriaProps({
                              error: formErrors.accountNumber,
                              id: "vendor-account-number",
                            })}
                            value={form.accountNumber}
                            onChange={(event) => {
                              clearFormError("accountNumber");
                              setForm((current) => ({ ...current, accountNumber: event.target.value }));
                            }}
                            className={`rounded-lg ${formErrors.accountNumber ? inputErrorClassName : ""}`}
                          />
                          {formErrors.accountNumber ? (
                            <p id="vendor-account-number-error" className={inlineErrorClassName} role="alert">
                              {formErrors.accountNumber}
                            </p>
                          ) : null}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vendor-account-name">Account Name</Label>
                          <Input
                            id="vendor-account-name"
                            value={form.accountName}
                            onChange={(event) => setForm((current) => ({ ...current, accountName: event.target.value }))}
                            className="rounded-lg"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="vendor-notes">Notes</Label>
                          <Textarea
                            id="vendor-notes"
                            value={form.notes}
                            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                            className="min-h-[140px] rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-4 border-t border-border pt-5">
                      <div className="xl:hidden">
                        <p className="text-sm font-semibold text-foreground">
                          Step {vendorStepMeta[formStep].index}: {vendorStepMeta[formStep].title}
                        </p>
                        <p className="text-sm text-muted-foreground">{vendorStepMeta[formStep].description}</p>
                      </div>
                      <div
                        className={`rounded-xl border px-4 py-3 text-sm ${
                          hasTriedVendorStepAdvance && Object.values(currentVendorStepErrors).some(Boolean)
                            ? "border-destructive/20 bg-destructive/5 text-destructive"
                            : "border-border bg-muted/20 text-muted-foreground"
                        }`}
                        role="status"
                      >
                        {currentVendorStepMessage}
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                        <div className="flex gap-3">
                        {formStep === "payout" ? (
                          <Button variant="outline" className="rounded-xl px-4" onClick={() => goToVendorStep("business")} disabled={isMutating}>
                            <ArrowLeft className="h-4 w-4" />
                            Back
                          </Button>
                        ) : null}
                        {formStep === "business" ? (
                          <Button variant="outline" className="rounded-xl px-4" onClick={() => goToVendorStep("payout")} disabled={isMutating}>
                            Continue to Payout
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button variant="ghost" className="rounded-lg" onClick={closeModal} disabled={isMutating}>
                          Cancel
                        </Button>
                        <Button className="rounded-lg btn-press" onClick={() => void handleSaveVendor()} disabled={isMutating}>
                          {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          {editingVendorId ? "Save Changes" : "Add Vendor"}
                        </Button>
                      </div>
                      </div>
                    </div>
                  </div>

                  <aside className="rounded-2xl border border-border bg-muted/20 p-5">
                    <h3 className="text-base font-semibold text-foreground">Quick summary</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Business</p>
                        <p className="font-medium text-foreground">{form.businessName || "Not set yet"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Primary contact</p>
                        <p className="font-medium text-foreground">{form.contactName || form.email || "Not set yet"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Bank readiness</p>
                        <p className="font-medium text-foreground">
                          {formBankLabel && form.accountNumber ? "Payout details captured" : "Payout details pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Current step</p>
                        <p className="font-medium text-foreground">
                          {formStep === "business" ? "Business and contact" : "Payout and notes"}
                        </p>
                      </div>
                    </div>
                  </aside>
                </div>
              </section>
            ) : null}

            <DataPage
              title="Vendors"
              actionLabel={modalOpen ? "Close Form" : "+ Add Vendor"}
              onAction={modalOpen ? closeModal : openCreateModal}
              tabs={tabs}
              activeTab={tab}
              onTabChange={setTab}
              columns={columns}
              data={filtered}
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Vendor name, email, or contact"
              toolbarSlot={
                <AdvancedFilter
                  definitions={advancedFilterDefinitions}
                  state={advancedFilters}
                  onChange={setAdvancedFilters}
                  storageKey="vendors"
                />
              }
              emptyTitle="No vendors found"
              emptyDescription="Add your first vendor to manage payables."
              onRowClick={(vendor) => setDetailVendorId(vendor.id)}
              isLoading={isSettingsLoading || isVendorsLoading}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default VendorsPage;
