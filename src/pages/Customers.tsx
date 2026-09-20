import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import DataPage from "@/components/app/DataPage";
import StatusBadge from "@/components/app/StatusBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useCustomersDirectory, useCustomerMutations, type CustomerDirectoryItem } from "@/hooks/use-directory-data";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useToast } from "@/hooks/use-toast";
import { useSearchParamState } from "@/hooks/use-search-param";
import { Button } from "@/components/ui/button";
import { AdvancedFilter } from "@/components/ui/advanced-filter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira } from "@/data/seedData";
import { getFormFieldAriaProps } from "@/lib/accessibility";
import {
  getStringFilterValue,
  isNumberRangeFilterValue,
  matchesNumberRange,
  type AdvancedFilterDefinition,
  type AdvancedFilterState,
} from "@/lib/advanced-filters";
import { createFormValidator, getFriendlyErrorMessage, ValidationRules } from "@/lib/error-handling";
import { normalizePhoneNumber, phonePlaceholder } from "@/lib/phone";

const invoiceStatusVariant = (status: CustomerDirectoryItem["invoices"][number]["status"]) => {
  const variants = {
    cancelled: "dark",
    draft: "grey",
    overdue: "red",
    paid: "green",
    sent: "blue",
  } as const;

  return variants[status];
};

const invoiceStatusLabel = (status: CustomerDirectoryItem["invoices"][number]["status"]) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const normalizeRequiredText = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeOptionalText = (value: string) => {
  const normalized = normalizeRequiredText(value);
  return normalized || null;
};
const formHasValues = (form: CustomerFormState) =>
  Object.values(form).some((value) => value.trim().length > 0);

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const getDeleteErrorMessage = (error: unknown, entityName: string) => {
  const message = getErrorMessage(error, `Unable to delete ${entityName}.`);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("processing or scheduled")) {
    return `This ${entityName} has payment activity that is still processing or scheduled. Finish or cancel those transactions before deleting it.`;
  }

  if (normalizedMessage.includes("invoice record")) {
    return `This ${entityName} has invoice history and cannot be deleted. Keep it for reporting, or we can add an archive option instead.`;
  }

  if (normalizedMessage.includes("violates foreign key constraint")) {
    return `This ${entityName} already has linked records and cannot be deleted yet.`;
  }

  return message;
};

type CustomerFormState = {
  businessName: string;
  cityState: string;
  email: string;
  name: string;
  notes: string;
  phone: string;
  streetAddress: string;
};
type CustomerFormErrors = Partial<Record<"email" | "name" | "phone", string>>;

const emptyForm: CustomerFormState = {
  businessName: "",
  cityState: "",
  email: "",
  name: "",
  notes: "",
  phone: "",
  streetAddress: "",
};

const customerFormValidator = createFormValidator({
  email: [ValidationRules.optional(ValidationRules.email())],
  name: [ValidationRules.trimmedRequired()],
  phone: [ValidationRules.optional(ValidationRules.phone())],
});
const inputErrorClassName = "border-destructive focus-visible:ring-destructive";
const inlineErrorClassName = "text-sm font-medium text-destructive";

const CustomersPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const customersQuery = useCustomersDirectory(businessId);
  const { createCustomer, deleteCustomer, updateCustomer } = useCustomerMutations(businessId, user?.id);

  const [search, setSearch] = useSearchParamState();
  const [tab, setTab] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerFormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<CustomerFormErrors>({});
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilterState>({});
  const hasRestoredDraftRef = useRef(false);
  const customerDraftStorageKey = useMemo(
    () => (user?.id ? `moniger:customers:create-draft:${user.id}` : null),
    [user?.id],
  );

  const allCustomers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const detailCustomer = useMemo(
    () => allCustomers.find((customer) => customer.id === detailCustomerId) ?? null,
    [allCustomers, detailCustomerId],
  );
  const advancedFilterDefinitions: AdvancedFilterDefinition[] = useMemo(
    () => [
      {
        emptyLabel: "All contact states",
        id: "contactState",
        label: "Contact Coverage",
        options: [
          { label: "Has email", value: "with-email" },
          { label: "Has phone", value: "with-phone" },
          { label: "Missing contact details", value: "missing-contact" },
        ],
        type: "select",
      },
      {
        emptyLabel: "All activity",
        id: "activity",
        label: "Invoice Activity",
        options: [
          { label: "With invoice history", value: "with-invoices" },
          { label: "Without invoice history", value: "without-invoices" },
        ],
        type: "select",
      },
      {
        id: "outstanding",
        label: "Outstanding Balance",
        maxPlaceholder: "10000000",
        minPlaceholder: "0",
        step: "0.01",
        type: "number-range",
      },
      {
        id: "totalInvoiced",
        label: "Total Invoiced",
        maxPlaceholder: "10000000",
        minPlaceholder: "0",
        step: "0.01",
        type: "number-range",
      },
    ],
    [],
  );

  useEffect(() => {
    if (detailCustomerId && !detailCustomer) {
      setDetailCustomerId(null);
    }
  }, [detailCustomer, detailCustomerId]);

  useEffect(() => {
    if (!customerDraftStorageKey || hasRestoredDraftRef.current || typeof window === "undefined") {
      return;
    }

    hasRestoredDraftRef.current = true;

    const draft = window.sessionStorage.getItem(customerDraftStorageKey);
    if (!draft) {
      return;
    }

    try {
      const parsedDraft = JSON.parse(draft) as Partial<CustomerFormState>;
      const restoredForm: CustomerFormState = {
        businessName: parsedDraft.businessName ?? "",
        cityState: parsedDraft.cityState ?? "",
        email: parsedDraft.email ?? "",
        name: parsedDraft.name ?? "",
        notes: parsedDraft.notes ?? "",
        phone: parsedDraft.phone ?? "",
        streetAddress: parsedDraft.streetAddress ?? "",
      };

      if (!formHasValues(restoredForm)) {
        window.sessionStorage.removeItem(customerDraftStorageKey);
        return;
      }

      setEditingCustomerId(null);
      setForm(restoredForm);
      setFormErrors({});
      setModalOpen(true);
    } catch {
      window.sessionStorage.removeItem(customerDraftStorageKey);
    }
  }, [customerDraftStorageKey]);

  useEffect(() => {
    if (!customerDraftStorageKey || typeof window === "undefined") {
      return;
    }

    if (!modalOpen || editingCustomerId) {
      return;
    }

    if (!formHasValues(form)) {
      window.sessionStorage.removeItem(customerDraftStorageKey);
      return;
    }

    window.sessionStorage.setItem(customerDraftStorageKey, JSON.stringify(form));
  }, [customerDraftStorageKey, editingCustomerId, form, modalOpen]);

  const filtered = useMemo(() => {
    let list = allCustomers;
    const contactState = getStringFilterValue(advancedFilters.contactState);
    const activityFilter = getStringFilterValue(advancedFilters.activity);
    const outstandingRange = isNumberRangeFilterValue(advancedFilters.outstanding) ? advancedFilters.outstanding : undefined;
    const totalInvoicedRange = isNumberRangeFilterValue(advancedFilters.totalInvoiced)
      ? advancedFilters.totalInvoiced
      : undefined;

    if (tab === "Outstanding") {
      list = list.filter((customer) => customer.outstanding > 0);
    }

    list = list.filter((customer) => {
      if (contactState === "with-email" && !customer.email) {
        return false;
      }

      if (contactState === "with-phone" && !customer.phone) {
        return false;
      }

      if (contactState === "missing-contact" && (customer.email || customer.phone)) {
        return false;
      }

      if (activityFilter === "with-invoices" && customer.invoices.length === 0) {
        return false;
      }

      if (activityFilter === "without-invoices" && customer.invoices.length > 0) {
        return false;
      }

      if (!matchesNumberRange(customer.outstanding, outstandingRange)) {
        return false;
      }

      if (!matchesNumberRange(customer.totalInvoiced, totalInvoicedRange)) {
        return false;
      }

      return true;
    });

    if (!search) {
      return list;
    }

    const normalizedSearch = search.toLowerCase();
    return list.filter(
      (customer) =>
        customer.name.toLowerCase().includes(normalizedSearch) ||
        (customer.businessName ?? "").toLowerCase().includes(normalizedSearch) ||
        (customer.email ?? "").toLowerCase().includes(normalizedSearch) ||
        (customer.phone ?? "").toLowerCase().includes(normalizedSearch),
    );
  }, [advancedFilters.activity, advancedFilters.contactState, advancedFilters.outstanding, advancedFilters.totalInvoiced, allCustomers, search, tab]);

  const tabs = useMemo(
    () => [
      { label: "All", count: allCustomers.length, value: "All" },
      { label: "Outstanding", count: allCustomers.filter((customer) => customer.outstanding > 0).length, value: "Outstanding" },
    ],
    [allCustomers],
  );

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isCustomersLoading = customersQuery.isLoading && !customersQuery.data;
  const isMutating = createCustomer.isPending || deleteCustomer.isPending || updateCustomer.isPending;

  const openCreateModal = () => {
    setEditingCustomerId(null);
    setFormErrors({});
    if (customerDraftStorageKey && typeof window !== "undefined") {
      const draft = window.sessionStorage.getItem(customerDraftStorageKey);

      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft) as Partial<CustomerFormState>;
          setForm({
            businessName: parsedDraft.businessName ?? "",
            cityState: parsedDraft.cityState ?? "",
            email: parsedDraft.email ?? "",
            name: parsedDraft.name ?? "",
            notes: parsedDraft.notes ?? "",
            phone: parsedDraft.phone ?? "",
            streetAddress: parsedDraft.streetAddress ?? "",
          });
          setModalOpen(true);
          return;
        } catch {
          window.sessionStorage.removeItem(customerDraftStorageKey);
        }
      }
    }

    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEditModal = (customer: CustomerDirectoryItem) => {
    setEditingCustomerId(customer.id);
    setForm({
      businessName: customer.businessName ?? "",
      cityState: customer.cityState ?? "",
      email: customer.email ?? "",
      name: customer.name,
      notes: customer.notes ?? "",
      phone: customer.phone ?? "",
      streetAddress: customer.streetAddress ?? "",
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    if (isMutating) {
      return;
    }

    if (!editingCustomerId && customerDraftStorageKey && typeof window !== "undefined") {
      window.sessionStorage.removeItem(customerDraftStorageKey);
    }

    setModalOpen(false);
    setEditingCustomerId(null);
    setForm(emptyForm);
    setFormErrors({});
  };

  const clearFormError = (field: keyof CustomerFormErrors) => {
    setFormErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleSaveCustomer = async () => {
    const validationErrors = customerFormValidator({
      email: form.email.trim(),
      name: form.name,
      phone: form.phone.trim(),
    }) as CustomerFormErrors;

    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      return;
    }

    const normalizedName = normalizeRequiredText(form.name);

    const payload = {
      business_name: normalizeOptionalText(form.businessName),
      city_state: normalizeOptionalText(form.cityState),
      email: normalizeOptionalText(form.email),
      name: normalizedName,
      notes: normalizeOptionalText(form.notes),
      phone: normalizePhoneNumber(form.phone),
      street_address: normalizeOptionalText(form.streetAddress),
    };

    try {
      if (editingCustomerId) {
        await updateCustomer.mutateAsync({ customerId: editingCustomerId, values: payload });
        toast({ title: "Customer updated", description: `${normalizedName} has been updated.` });
      } else {
        await createCustomer.mutateAsync(payload);
        toast({ title: "Customer added", description: `${normalizedName} has been added to your customer list.` });
      }

      setFormErrors({});
      closeModal();
    } catch (error) {
      toast({
        title: editingCustomerId ? "Unable to update customer" : "Unable to add customer",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleDeleteCustomer = async (customer: CustomerDirectoryItem) => {
    const confirmed = window.confirm(`Delete ${customer.name}? This cannot be undone.`);

    if (!confirmed) {
      return;
    }

    try {
      await deleteCustomer.mutateAsync({ customerId: customer.id, customerName: customer.name });
      toast({ title: "Customer deleted", description: `${customer.name} has been removed.` });
    } catch (error) {
      toast({
        title: "Unable to delete customer",
        description: getDeleteErrorMessage(error, "customer"),
        variant: "destructive",
      });
    }
  };

  const columns = [
    {
      key: "name",
      header: "Customer",
      render: (row: CustomerDirectoryItem) => (
        <div className="min-w-0">
          <span className="block font-medium text-foreground">{row.name}</span>
          {row.businessName ? (
            <span className="block text-xs text-muted-foreground">{row.businessName}</span>
          ) : null}
        </div>
      ),
    },
    { key: "email", header: "Email", render: (row: CustomerDirectoryItem) => row.email || "—" },
    { key: "phone", header: "Phone", render: (row: CustomerDirectoryItem) => row.phone || "—" },
    {
      key: "totalInvoiced",
      header: "Total Invoiced",
      render: (row: CustomerDirectoryItem) => <span className="font-medium">{formatNaira(row.totalInvoiced)}</span>,
    },
    {
      key: "outstanding",
      header: "Outstanding",
      render: (row: CustomerDirectoryItem) => (
        <span className={`font-medium ${row.outstanding > 0 ? "text-destructive" : "text-success"}`}>
          {formatNaira(row.outstanding)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (row: CustomerDirectoryItem) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(event) => {
              event.stopPropagation();
              setDetailCustomerId(row.id);
            }}
            aria-label={`View customer ${row.name}`}
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
            aria-label={`Edit customer ${row.name}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive"
            onClick={(event) => {
              event.stopPropagation();
              void handleDeleteCustomer(row);
            }}
            aria-label={`Delete customer ${row.name}`}
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

        {customersQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(customersQuery.error, "We could not load your customers right now.")}
          </div>
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Customers will appear here once the business record is available.
          </div>
        ) : null}

        {detailCustomer ? (
          <div className="space-y-6">
            <Button variant="ghost" onClick={() => setDetailCustomerId(null)} className="mb-2">
              ← Back to Customers
            </Button>
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col items-start gap-4 sm:flex-row">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-lg font-bold text-secondary-foreground">
                  {detailCustomer.name[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-foreground">{detailCustomer.name}</h2>
                  {detailCustomer.businessName ? (
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{detailCustomer.businessName}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span>{detailCustomer.email || "No email"}</span>
                    <span>{detailCustomer.phone || "No phone"}</span>
                  </div>
                  {detailCustomer.streetAddress ? (
                    <p className="mt-2 text-sm text-muted-foreground">{detailCustomer.streetAddress}</p>
                  ) : null}
                  {detailCustomer.cityState ? (
                    <p className="text-sm text-muted-foreground">{detailCustomer.cityState}</p>
                  ) : null}
                  {!detailCustomer.streetAddress && !detailCustomer.cityState && detailCustomer.billingAddress ? (
                    <p className="mt-2 text-sm text-muted-foreground">{detailCustomer.billingAddress}</p>
                  ) : null}
                  {detailCustomer.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">{detailCustomer.notes}</p>
                  ) : null}
                </div>
                <div className="space-y-1 text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Invoiced</p>
                    <p className="text-lg font-bold text-foreground">{formatNaira(detailCustomer.totalInvoiced)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Outstanding</p>
                    <p className={`text-lg font-bold ${detailCustomer.outstanding > 0 ? "text-destructive" : "text-success"}`}>
                      {formatNaira(detailCustomer.outstanding)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-semibold text-foreground">Invoices</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Invoices for customer {detailCustomer.name}</caption>
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th scope="col" className="table-header px-4 py-3 text-left">Invoice #</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Issue Date</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Due Date</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Amount</th>
                      <th scope="col" className="table-header px-4 py-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailCustomer.invoices.map((invoice, index) => (
                      <tr key={invoice.id} className={`border-b border-border last:border-0 ${index % 2 === 1 ? "bg-muted/10" : ""}`}>
                        <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                        <td className="px-4 py-3">{invoice.issueDate}</td>
                        <td className="px-4 py-3">{invoice.dueDate || "—"}</td>
                        <td className="px-4 py-3 font-medium">{formatNaira(invoice.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge variant={invoiceStatusVariant(invoice.status)}>
                            {invoiceStatusLabel(invoice.status)}
                          </StatusBadge>
                        </td>
                      </tr>
                    ))}
                    {detailCustomer.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          No invoices yet
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <DataPage
            title="Customers"
            actionLabel="+ Add Customer"
            onAction={openCreateModal}
            tabs={tabs}
            activeTab={tab}
            onTabChange={setTab}
            columns={columns}
            data={filtered}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Customer name, business name, email, or phone"
            toolbarSlot={
              <AdvancedFilter
                definitions={advancedFilterDefinitions}
                state={advancedFilters}
                onChange={setAdvancedFilters}
                storageKey="customers"
              />
            }
            emptyTitle="No customers found"
            emptyDescription="Add your first customer to start invoicing."
            onRowClick={(customer) => setDetailCustomerId(customer.id)}
            isLoading={isSettingsLoading || isCustomersLoading}
          />
        )}
      </div>

      <Dialog open={modalOpen} onOpenChange={(open) => (open ? setModalOpen(true) : closeModal())}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCustomerId ? "Edit Customer" : "Add Customer"}</DialogTitle>
            <DialogDescription>
              Capture the customer details used for invoices, billing, and contact history.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Customer Name</Label>
              <Input
                {...getFormFieldAriaProps({
                  error: formErrors.name,
                  id: "customer-name",
                  required: true,
                })}
                value={form.name}
                onChange={(event) => {
                  clearFormError("name");
                  setForm((current) => ({ ...current, name: event.target.value }));
                }}
                className={`rounded-lg ${formErrors.name ? inputErrorClassName : ""}`}
              />
              {formErrors.name ? (
                <p id="customer-name-error" className={inlineErrorClassName} role="alert">
                  {formErrors.name}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-business-name">Business Name</Label>
              <Input
                id="customer-business-name"
                value={form.businessName}
                onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
                className="rounded-lg"
                placeholder="Optional business or company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                {...getFormFieldAriaProps({
                  error: formErrors.email,
                  id: "customer-email",
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
                <p id="customer-email-error" className={inlineErrorClassName} role="alert">
                  {formErrors.email}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone</Label>
              <Input
                {...getFormFieldAriaProps({
                  error: formErrors.phone,
                  id: "customer-phone",
                })}
                id="customer-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => {
                  clearFormError("phone");
                  setForm((current) => ({ ...current, phone: event.target.value }));
                }}
                className={`rounded-lg ${formErrors.phone ? inputErrorClassName : ""}`}
                placeholder={phonePlaceholder}
              />
              <p className="text-xs text-muted-foreground">Use international format, for example {phonePlaceholder}.</p>
              {formErrors.phone ? (
                <p id="customer-phone-error" className={inlineErrorClassName} role="alert">
                  {formErrors.phone}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-street-address">Street Address</Label>
              <Input
                id="customer-street-address"
                value={form.streetAddress}
                onChange={(event) => setForm((current) => ({ ...current, streetAddress: event.target.value }))}
                className="rounded-lg"
                placeholder="12 Marina Rd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-city-state">City / State</Label>
              <Input
                id="customer-city-state"
                value={form.cityState}
                onChange={(event) => setForm((current) => ({ ...current, cityState: event.target.value }))}
                className="rounded-lg"
                placeholder="Lagos, LA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-notes">Notes</Label>
              <Textarea
                id="customer-notes"
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="rounded-lg"
              />
            </div>
            <Button className="w-full rounded-lg btn-press" onClick={() => void handleSaveCustomer()} disabled={isMutating}>
              {isMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingCustomerId ? "Save Changes" : "Add Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CustomersPage;
