import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CreditCard, Download, Inbox, PencilLine, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { createExportFileName, downloadCsvFile } from "@/lib/export";
import {
  AdminBadge,
  AdminEmpty,
  AdminGhostButton,
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableWrapper,
  AdminToolbar,
  formatAdminCurrency,
  formatAdminDate,
} from "@/admin/components/AdminUi";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminSubscriptionsResponse,
} from "@/admin/lib/admin-console";

const planTone = {
  business: "info",
  growth: "info",
  starter: "neutral",
} as const;

const statusTone = {
  active: "success",
  cancelled: "danger",
  past_due: "warning",
  paused: "warning",
  trial: "info",
} as const;

type SubscriptionRow = AdminSubscriptionsResponse["rows"][number];

type SubscriptionFormState = {
  amount: string;
  billingCycle: SubscriptionRow["billingCycle"];
  businessId: string;
  cancelAtPeriodEnd: boolean;
  currency: string;
  nextRenewalAt: string;
  notes: string;
  plan: SubscriptionRow["plan"];
  provider: string;
  providerCustomerId: string;
  providerSubscriptionId: string;
  resetTrialEligibility: boolean;
  startedAt: string;
  status: SubscriptionRow["status"];
};

const toFormState = (row: SubscriptionRow): SubscriptionFormState => ({
  amount: String(row.amount),
  billingCycle: row.billingCycle,
  businessId: row.businessId,
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  currency: row.currency,
  nextRenewalAt: row.nextRenewalAt?.slice(0, 10) ?? "",
  notes: row.notes ?? "",
  plan: row.plan,
  provider: row.provider,
  providerCustomerId: row.providerCustomerId ?? "",
  providerSubscriptionId: row.providerSubscriptionId ?? "",
  resetTrialEligibility: false,
  startedAt: row.startedAt.slice(0, 10),
  status: row.status,
});

const billingCycleLabel = {
  annual: "Annual",
  free: "Free",
  manual: "Manual",
  monthly: "Monthly",
} as const;

const AdminSubscriptionsPage = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [billingCycle, setBillingCycle] = useState("all");
  const [editingRow, setEditingRow] = useState<SubscriptionRow | null>(null);
  const [formState, setFormState] = useState<SubscriptionFormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const queryPayload = useMemo(
    () => ({
      billingCycle,
      plan,
      search: deferredSearch,
      status,
    }),
    [billingCycle, deferredSearch, plan, status],
  );
  const subscriptionsQuery = useAdminConsoleQuery<AdminSubscriptionsResponse>("subscriptions.list", queryPayload);
  const subscriptionsErrorMessage = subscriptionsQuery.error instanceof Error
    ? subscriptionsQuery.error.message
    : "The admin subscriptions query failed. Check the admin-console edge function and the subscription migration.";

  const openEditor = (row: SubscriptionRow) => {
    setEditingRow(row);
    setFormState(toFormState(row));
  };

  const closeEditor = () => {
    setEditingRow(null);
    setFormState(null);
  };

  const isDeletable = (row: SubscriptionRow) => row.isTestData && row.provider === "manual" && !row.providerSubscriptionId;
  const rows = subscriptionsQuery.data?.rows ?? [];
  const visibleBusinessIds = rows.map((row) => row.businessId).join(",");
  const deletableRows = rows.filter(isDeletable);
  const selectedRows = rows.filter((row) => selectedBusinessIds.includes(row.businessId));
  const confirmationPhrase = `DELETE ${selectedRows.length} SUBSCRIPTIONS`;

  useEffect(() => {
    setSelectedBusinessIds((current) => {
      const visibleIds = new Set(rows.map((row) => row.businessId));
      const next = current.filter((id) => visibleIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [visibleBusinessIds]);

  const toggleSelection = (businessId: string, checked: boolean) => {
    setSelectedBusinessIds((current) => checked
      ? Array.from(new Set([...current, businessId]))
      : current.filter((id) => id !== businessId));
  };

  const toggleAllDeletable = (checked: boolean) => {
    setSelectedBusinessIds(checked ? deletableRows.map((row) => row.businessId) : []);
  };

  const deleteSubscriptions = async () => {
    if (selectedRows.length === 0) return;
    setIsDeleting(true);
    try {
      await invokeAdminConsole("subscriptions.delete", {
        confirmation: deleteConfirmation.trim(),
        reason: deleteReason.trim(),
        subscriptionIds: selectedBusinessIds,
      });
      await subscriptionsQuery.refetch();
      setSelectedBusinessIds([]);
      setDeleteReason("");
      setDeleteConfirmation("");
      setIsDeleteDialogOpen(false);
      toast({
        title: "Subscriptions deleted",
        description: `${selectedRows.length} marked test subscription${selectedRows.length === 1 ? "" : "s"} removed and the workspace plan reset to Starter.`,
      });
    } catch (error) {
      toast({
        title: "Deletion blocked",
        description: error instanceof Error ? error.message : "The selected subscriptions could not be deleted.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const exportCsv = () => {
    downloadCsvFile({
      columns: [
        { header: "Business", value: (row) => row.businessName },
        { header: "Owner Email", value: (row) => row.ownerEmail },
        { header: "Plan", value: (row) => row.plan },
        { header: "Status", value: (row) => row.status },
        { header: "Billing Cycle", value: (row) => row.billingCycle },
        { header: "Amount", value: (row) => row.amount },
        { header: "Currency", value: (row) => row.currency },
        { header: "Next Renewal", value: (row) => row.nextRenewalAt ?? "" },
        { header: "Provider", value: (row) => row.provider },
      ],
      filename: `${createExportFileName("admin-subscriptions")}.csv`,
      rows: subscriptionsQuery.data?.rows ?? [],
    });
  };

  const saveSubscription = async () => {
    if (!editingRow || !formState) {
      return;
    }

    setIsSaving(true);
    try {
      await invokeAdminConsole("subscriptions.update", {
        amount: Number(formState.amount || 0),
        billingCycle: formState.billingCycle,
        businessId: formState.businessId,
        cancelAtPeriodEnd: formState.cancelAtPeriodEnd,
        currency: formState.currency.trim() || "NGN",
        nextRenewalAt: formState.nextRenewalAt || null,
        notes: formState.notes.trim() || null,
        plan: formState.plan,
        provider: formState.provider.trim() || "manual",
        providerCustomerId: formState.providerCustomerId.trim() || null,
        providerSubscriptionId: formState.providerSubscriptionId.trim() || null,
        resetTrialEligibility: formState.resetTrialEligibility,
        startedAt: formState.startedAt || editingRow.startedAt.slice(0, 10),
        status: formState.status,
      });
      await subscriptionsQuery.refetch();
      toast({
        title: "Subscription updated",
        description: `${editingRow.businessName} now reflects the latest billing settings.`,
      });
      closeEditor();
    } catch (error) {
      toast({
        title: "Update failed",
        description: error instanceof Error ? error.message : "Unable to update this subscription.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Subscriptions"
        subtitle="Operator-facing billing control for plans, renewal timing, and recurring revenue visibility."
        action={(
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AdminBadge tone="neutral">{subscriptionsQuery.data?.total ?? 0} subscriptions</AdminBadge>
            <AdminGhostButton onClick={exportCsv}>
              <Download size={14} aria-hidden="true" />
              Export CSV
            </AdminGhostButton>
            {deletableRows.length > 0 ? (
              <Button
                variant="destructive"
                disabled={selectedBusinessIds.length === 0}
                onClick={() => setIsDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 size={14} aria-hidden="true" />
                Delete selected ({selectedBusinessIds.length})
              </Button>
            ) : null}
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <AdminSectionCard title="Active Subscriptions">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">{subscriptionsQuery.data?.metrics.activeSubscriptions ?? 0}</p>
        </AdminSectionCard>
        <AdminSectionCard title="Monthly Recurring Revenue">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">
            {formatAdminCurrency(subscriptionsQuery.data?.metrics.monthlyRecurringRevenue ?? 0)}
          </p>
        </AdminSectionCard>
        <AdminSectionCard title="Annualized Revenue">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">
            {formatAdminCurrency(subscriptionsQuery.data?.metrics.annualizedRevenue ?? 0)}
          </p>
        </AdminSectionCard>
        <AdminSectionCard title="Renewals Due Soon">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">{subscriptionsQuery.data?.metrics.renewalsDueSoon ?? 0}</p>
        </AdminSectionCard>
      </div>

      <AdminToolbar className="flex-wrap">
        {deletableRows.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-white/60">
            <Checkbox
              checked={deletableRows.length > 0 && deletableRows.every((row) => selectedBusinessIds.includes(row.businessId))}
              onCheckedChange={(checked) => toggleAllDeletable(checked === true)}
              aria-label="Select all deletable test subscriptions"
            />
            Select all eligible test subscriptions
          </label>
        ) : null}
        <div className="relative w-full flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search business name, owner email, or provider"
            className="h-10 border-white/10 bg-[#0F1621] pl-10 text-sm text-white placeholder:text-white/30 sm:h-11"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-10 w-full border-white/10 bg-[#0F1621] text-sm text-white sm:h-11 sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="past_due">Past due</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={plan} onValueChange={setPlan}>
          <SelectTrigger className="h-10 w-full border-white/10 bg-[#0F1621] text-sm text-white sm:h-11 sm:w-[160px]">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="growth">Growth</SelectItem>
            <SelectItem value="business">Business</SelectItem>
          </SelectContent>
        </Select>
        <Select value={billingCycle} onValueChange={setBillingCycle}>
          <SelectTrigger className="h-10 w-full border-white/10 bg-[#0F1621] text-sm text-white sm:h-11 sm:w-[160px]">
            <SelectValue placeholder="Billing cycle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cycles</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="annual">Annual</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </AdminToolbar>

      {subscriptionsQuery.error ? (
        <AdminSectionCard title="Unable to Load Subscriptions">
          <p className="text-sm text-[#FCA5A5]">{subscriptionsErrorMessage}</p>
          <p className="mt-2 text-sm text-white/45">
            Make sure the `business_subscriptions` migration has been applied and the `admin-console` edge function has been redeployed.
          </p>
        </AdminSectionCard>
      ) : null}

      {!subscriptionsQuery.error && (subscriptionsQuery.data?.rows.length ?? 0) === 0 ? (
        <AdminSectionCard title="No Subscriptions Yet">
          <AdminEmpty
            title="No subscription records available"
            description="Apply the subscription migration so each business gets a managed billing record for the admin console."
            icon={Inbox}
          />
        </AdminSectionCard>
      ) : null}

      {!subscriptionsQuery.error && (subscriptionsQuery.data?.rows.length ?? 0) > 0 && isMobile ? (
        <div className="space-y-2.5">
          {(subscriptionsQuery.data?.rows ?? []).map((row) => (
            <div key={row.businessId} className="rounded-xl border border-white/5 bg-[#161E2E] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Checkbox
                      checked={selectedBusinessIds.includes(row.businessId)}
                      disabled={!isDeletable(row)}
                      onCheckedChange={(checked) => toggleSelection(row.businessId, checked === true)}
                      aria-label={`Select ${row.businessName}`}
                    />
                    <AdminBadge tone={row.isTestData ? "warning" : "neutral"}>{row.isTestData ? "Test data" : "Protected"}</AdminBadge>
                  </div>
                  <p className="text-sm font-semibold text-[#F1F5F9]">{row.businessName}</p>
                  <p className="mt-1 text-xs text-white/35">{row.ownerEmail}</p>
                </div>
                <AdminBadge tone={statusTone[row.status]}>{row.status}</AdminBadge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminBadge tone={planTone[row.plan]}>{row.plan}</AdminBadge>
                <AdminBadge tone="neutral">{billingCycleLabel[row.billingCycle]}</AdminBadge>
                <AdminBadge tone="neutral">{formatAdminCurrency(row.amount, row.currency)}</AdminBadge>
              </div>
              <p className="mt-2 text-xs text-white/40">
                Next renewal {row.nextRenewalAt ? formatAdminDate(row.nextRenewalAt) : "not scheduled"}
              </p>
              <AdminGhostButton className="mt-3 w-full justify-center" onClick={() => openEditor(row)}>
                <PencilLine size={14} aria-hidden="true" />
                Edit subscription
              </AdminGhostButton>
              {!isDeletable(row) ? <p className="mt-2 text-xs text-white/35">Provider-linked or live subscriptions cannot be hard-deleted.</p> : null}
            </div>
          ))}
        </div>
      ) : !subscriptionsQuery.error && (subscriptionsQuery.data?.rows.length ?? 0) > 0 ? (
        <AdminTableWrapper>
          <table className="min-w-full text-left text-sm text-white/70">
            <AdminTableHead>
              <tr>
                <th className="w-10 px-3 py-2.5 sm:px-4">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2.5 sm:px-4">Business</th>
                <th className="px-3 py-2.5 sm:px-4">Plan</th>
                <th className="px-3 py-2.5 sm:px-4">Cycle</th>
                <th className="px-3 py-2.5 sm:px-4">Amount</th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">Next Renewal</th>
                <th className="px-3 py-2.5 sm:px-4">Status</th>
                <th className="px-3 py-2.5 sm:px-4">Data</th>
                <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {(subscriptionsQuery.data?.rows ?? []).map((row) => (
                <tr key={row.businessId} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-3 sm:px-4">
                    <Checkbox
                      checked={selectedBusinessIds.includes(row.businessId)}
                      disabled={!isDeletable(row)}
                      onCheckedChange={(checked) => toggleSelection(row.businessId, checked === true)}
                      aria-label={`Select ${row.businessName}`}
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="space-y-1">
                      <p className="font-medium text-[#F1F5F9]">{row.businessName}</p>
                      <p className="text-xs text-white/40">{row.ownerEmail}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 sm:px-4"><AdminBadge tone={planTone[row.plan]}>{row.plan}</AdminBadge></td>
                  <td className="px-3 py-3 sm:px-4">{billingCycleLabel[row.billingCycle]}</td>
                  <td className="px-3 py-3 sm:px-4">{formatAdminCurrency(row.amount, row.currency)}</td>
                  <td className="hidden px-3 py-3 text-white/45 lg:table-cell sm:px-4">
                    {row.nextRenewalAt ? formatAdminDate(row.nextRenewalAt) : "Not scheduled"}
                  </td>
                  <td className="px-3 py-3 sm:px-4"><AdminBadge tone={statusTone[row.status]}>{row.status}</AdminBadge></td>
                  <td className="px-3 py-3 sm:px-4"><AdminBadge tone={row.isTestData ? "warning" : "neutral"}>{row.isTestData ? "Test data" : "Protected"}</AdminBadge></td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        title="Edit subscription"
                        onClick={() => openEditor(row)}
                      >
                        <PencilLine size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableWrapper>
      ) : null}

      <Dialog open={Boolean(editingRow && formState)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9] sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard size={18} aria-hidden="true" />
              Edit subscription
            </DialogTitle>
            <DialogDescription className="text-white/45">
              {editingRow ? `Update plan, billing, and renewal settings for ${editingRow.businessName}.` : "Manage subscription settings."}
            </DialogDescription>
          </DialogHeader>

          {formState ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Plan</label>
                <Select value={formState.plan} onValueChange={(value) => setFormState((current) => current ? { ...current, plan: value as SubscriptionFormState["plan"] } : current)}>
                  <SelectTrigger className="border-white/10 bg-[#0F1621] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="growth">Growth</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Status</label>
                <Select value={formState.status} onValueChange={(value) => setFormState((current) => current ? { ...current, status: value as SubscriptionFormState["status"] } : current)}>
                  <SelectTrigger className="border-white/10 bg-[#0F1621] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="past_due">Past due</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Billing cycle</label>
                <Select value={formState.billingCycle} onValueChange={(value) => setFormState((current) => current ? { ...current, billingCycle: value as SubscriptionFormState["billingCycle"] } : current)}>
                  <SelectTrigger className="border-white/10 bg-[#0F1621] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Amount</label>
                <Input
                  type="number"
                  min="0"
                  value={formState.amount}
                  onChange={(event) => setFormState((current) => current ? { ...current, amount: event.target.value } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Currency</label>
                <Input
                  value={formState.currency}
                  onChange={(event) => setFormState((current) => current ? { ...current, currency: event.target.value.toUpperCase() } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Next renewal</label>
                <Input
                  type="date"
                  value={formState.nextRenewalAt}
                  onChange={(event) => setFormState((current) => current ? { ...current, nextRenewalAt: event.target.value } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Provider</label>
                <Input
                  value={formState.provider}
                  onChange={(event) => setFormState((current) => current ? { ...current, provider: event.target.value } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Started</label>
                <Input
                  type="date"
                  value={formState.startedAt}
                  onChange={(event) => setFormState((current) => current ? { ...current, startedAt: event.target.value } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Provider customer ID</label>
                <Input
                  value={formState.providerCustomerId}
                  onChange={(event) => setFormState((current) => current ? { ...current, providerCustomerId: event.target.value } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Provider subscription ID</label>
                <Input
                  value={formState.providerSubscriptionId}
                  onChange={(event) => setFormState((current) => current ? { ...current, providerSubscriptionId: event.target.value } : current)}
                  className="border-white/10 bg-[#0F1621] text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0F1621] px-4 py-3 text-sm text-white/75">
                  <input
                    type="checkbox"
                    checked={formState.cancelAtPeriodEnd}
                    onChange={(event) => setFormState((current) => current ? { ...current, cancelAtPeriodEnd: event.target.checked } : current)}
                  />
                  Cancel at period end
                </label>
              </div>

              {formState.plan === "starter" ? (
                <div className="sm:col-span-2">
                  <label className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                    <input
                      type="checkbox"
                      checked={formState.resetTrialEligibility}
                      onChange={(event) => setFormState((current) => current ? { ...current, resetTrialEligibility: event.target.checked } : current)}
                    />
                    <span>
                      <span className="block font-medium">Reset Growth trial eligibility</span>
                      <span className="mt-1 block text-xs text-amber-100/70">Testing-only action. This clears the one-time trial markers so this Starter workspace can start a new configured trial.</span>
                    </span>
                  </label>
                </div>
              ) : null}

              <div className="sm:col-span-2 space-y-2">
                <label className="text-xs uppercase tracking-[0.08em] text-white/40">Internal notes</label>
                <Textarea
                  value={formState.notes}
                  onChange={(event) => setFormState((current) => current ? { ...current, notes: event.target.value } : current)}
                  className="min-h-[100px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
                  placeholder="Record internal billing context, exceptions, or manual follow-up notes."
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="ghost" onClick={closeEditor} className="border border-white/10 bg-white/5 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={() => void saveSubscription()} disabled={isSaving} className="bg-[#3B82F6] text-white hover:bg-[#2563EB]">
              {isSaving ? "Saving..." : "Save subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
        <DialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9] sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-200">
              <Trash2 size={18} aria-hidden="true" />
              Delete marked test subscriptions
            </DialogTitle>
            <DialogDescription className="text-white/55">
              This permanently removes {selectedRows.length} manual test subscription record{selectedRows.length === 1 ? "" : "s"}, resets the related workspace override, and writes an audit entry. Live and provider-linked subscriptions are never eligible.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.08em] text-white/45" htmlFor="subscription-delete-reason">Cleanup reason</label>
              <Textarea id="subscription-delete-reason" value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="Explain why these test subscriptions are being removed." className="min-h-[90px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.08em] text-white/45" htmlFor="subscription-delete-confirmation">Type {confirmationPhrase}</label>
              <Input id="subscription-delete-confirmation" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder={confirmationPhrase} className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting} className="border border-white/10 bg-white/5 text-white hover:bg-white/10">Cancel</Button>
            <Button variant="destructive" onClick={() => void deleteSubscriptions()} disabled={isDeleting || deleteReason.trim().length < 10 || deleteConfirmation.trim() !== confirmationPhrase}>
              {isDeleting ? "Deleting..." : "Delete subscriptions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubscriptionsPage;
