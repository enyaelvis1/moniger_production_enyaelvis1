import { Download, ExternalLink, Eye, Inbox, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { createExportFileName, downloadCsvFile } from "@/lib/export";
import { invokeAdminConsole, useAdminConsoleQuery, type AdminPaymentsResponse, type AdminSettingsResponse, type AdminTestDataDeleteResponse } from "@/admin/lib/admin-console";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AdminBadge,
  AdminEmpty,
  AdminGhostButton,
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableWrapper,
  AdminTableSkeleton,
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/admin/components/AdminUi";

type AdminPaymentRow = AdminPaymentsResponse["rows"][number];
type AdminPaymentReconcileResponse = {
  message: string;
  ok: boolean;
  row: AdminPaymentRow;
};

const formatKoboCurrency = (value: number | null | undefined, currency = "NGN") => {
  if (value === null || value === undefined) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-NG", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value / 100);
};

const getRoutingBadge = (payment: AdminPaymentRow) => {
  const routing = payment.marketplaceRouting;

  if (!routing) {
    return { label: "Standard", tone: "neutral" as const };
  }

  if (routing.enabled === false) {
    return { label: "Routing off", tone: "warning" as const };
  }

  if (routing.settlement?.providerStatus === "success") {
    return { label: routing.mode === "flat" ? "Flat settled" : "Split settled", tone: "success" as const };
  }

  return { label: routing.mode === "flat" ? "Flat pending" : "Split pending", tone: "info" as const };
};

const getPaymentStatusTone = (payment: AdminPaymentRow) => {
  if (payment.status === "completed") {
    return "success" as const;
  }

  if (payment.status === "failed") {
    return "danger" as const;
  }

  if (payment.reconciliation.needsAttention) {
    return "warning" as const;
  }

  return "info" as const;
};

const getReconciliationBadge = (payment: AdminPaymentRow) => {
  if (!payment.reconciliation.needsAttention) {
    return {
      label: payment.reconciliation.lastCheckedAt ? "Checked" : "In sync",
      tone: payment.reconciliation.tone,
    };
  }

  if (payment.reconciliation.expectedStatus) {
    return {
      label: `Needs ${payment.reconciliation.expectedStatus}`,
      tone: "warning" as const,
    };
  }

  return {
    label: "Stale pending",
    tone: payment.reconciliation.tone,
  };
};

const AdminPaymentsPage = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const paymentsQuery = useAdminConsoleQuery<AdminPaymentsResponse>("payments.list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedPayment, setSelectedPayment] = useState<AdminPaymentRow | null>(null);
  const [reconcilingPaymentId, setReconcilingPaymentId] = useState<string | null>(null);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [dataMode, setDataMode] = useState<"all" | "live" | "test">("all");

  const settingsQuery = useAdminConsoleQuery<AdminSettingsResponse>("settings.get");
  const configByKey = useMemo(
    () => new Map((settingsQuery.data?.platformConfig ?? []).map((item) => [item.key, item.value ?? {}])),
    [settingsQuery.data?.platformConfig],
  );

  useEffect(() => {
    const configured = Number(configByKey.get("admin_page_size")?.value ?? 25);
    setPageSize(configured);
  }, [configByKey]);

  const rows = paymentsQuery.data?.rows ?? [];
  const start = (page - 1) * pageSize;
  const filteredRows = useMemo(
    () => dataMode === "all" ? rows : rows.filter((row) => dataMode === "test" ? row.isTestData : !row.isTestData),
    [dataMode, rows],
  );
  const displayedRows = useMemo(() => filteredRows.slice(start, start + pageSize), [filteredRows, start, pageSize]);
  const paymentsErrorMessage = paymentsQuery.error instanceof Error
    ? paymentsQuery.error.message
    : "The admin payments query failed. Check the admin-console edge function and its environment variables.";

  const exportCsv = async () => {
    const payload = await invokeAdminConsole<AdminPaymentsResponse>("payments.export");
    downloadCsvFile({
      columns: [
        { header: "Reference", value: (row) => row.paymentReference },
        { header: "Business", value: (row) => row.businessName },
        { header: "Type", value: (row) => row.paymentType },
        { header: "Amount", value: (row) => row.amount },
        { header: "Status", value: (row) => row.status },
        {
          header: "Routing",
          value: (row) => getRoutingBadge(row).label,
        },
        { header: "Date", value: (row) => row.date },
      ],
      filename: `${createExportFileName("admin-payments")}.csv`,
      rows: payload.rows,
    });
  };

  const reconcilePayment = async (payment: AdminPaymentRow) => {
    setReconcilingPaymentId(payment.paymentId);

    try {
      const result = await invokeAdminConsole<AdminPaymentReconcileResponse>("payments.reconcile", {
        paymentId: payment.paymentId,
      });

      await paymentsQuery.refetch();
      setSelectedPayment(result.row);
      toast({
        title: "Payment reconciled",
        description: result.message,
      });
    } catch (error) {
      toast({
        title: "Unable to reconcile payment",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setReconcilingPaymentId(null);
    }
  };

  const deleteTestPayment = async (payment: AdminPaymentRow) => {
    if (!payment.isTestData) {
      toast({ title: "Payment is protected", description: "Only marked test payments can be deleted.", variant: "destructive" });
      return;
    }

    const reason = window.prompt("Enter a cleanup reason (at least 10 characters):", "Remove test payment after QA")?.trim() ?? "";
    if (reason.length < 10) return;
    if (!window.confirm(`Delete test payment ${payment.paymentReference}? This cannot be undone.`)) return;

    setDeletingPaymentId(payment.paymentId);
    try {
      const result = await invokeAdminConsole<AdminTestDataDeleteResponse>("testData.delete", {
        confirmation: "DELETE TEST DATA",
        reason,
        recordId: payment.paymentId,
        resource: "payments",
      });
      await paymentsQuery.refetch();
      setSelectedPayment(null);
      toast({ title: "Test payment deleted", description: `${result.deleted.payments} payment record removed and audited.` });
    } catch (error) {
      toast({ title: "Unable to delete payment", description: error instanceof Error ? error.message : "Only eligible test payments can be deleted.", variant: "destructive" });
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const deleteSelectedTestPayments = async () => {
    const ids = Array.from(selectedPaymentIds);
    if (ids.length === 0) return;
    const reason = window.prompt("Enter a cleanup reason (at least 10 characters):", "Remove selected test payments after QA")?.trim() ?? "";
    if (reason.length < 10) return;
    if (!window.confirm(`Delete ${ids.length} selected test payment record(s)? This cannot be undone.`)) return;
    setDeletingPaymentId("bulk");
    try {
      const result = await invokeAdminConsole<AdminTestDataDeleteResponse>("testData.delete", {
        bulkConfirmation: `DELETE ${ids.length} RECORDS`,
        confirmation: "DELETE TEST DATA",
        reason,
        recordIds: ids,
        resource: "payments",
      });
      await paymentsQuery.refetch();
      setSelectedPaymentIds(new Set());
      toast({ title: "Test payments deleted", description: `${result.deleted.payments} payment record(s) removed and audited.` });
    } catch (error) {
      toast({ title: "Unable to delete selected payments", description: error instanceof Error ? error.message : "Only eligible test payments can be deleted.", variant: "destructive" });
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const selectablePaymentIds = displayedRows.filter((payment) => payment.isTestData).map((payment) => payment.paymentId);
  const allDisplayedPaymentsSelected = selectablePaymentIds.length > 0 && selectablePaymentIds.every((id) => selectedPaymentIds.has(id));
  const togglePaymentSelection = (paymentId: string) => setSelectedPaymentIds((current) => {
    const next = new Set(current);
    if (next.has(paymentId)) next.delete(paymentId);
    else next.add(paymentId);
    return next;
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payments"
        subtitle="Platform-wide payment activity across all businesses."
        action={(
          <div className="flex items-center gap-3">
            <select
              value={dataMode}
              onChange={(event) => { setDataMode(event.target.value as typeof dataMode); setPage(1); }}
              className="h-8 rounded-md border border-white/10 bg-[#0F1621] px-2 text-white"
              aria-label="Filter payment data mode"
            >
              <option value="all">All data</option>
              <option value="live">Live data</option>
              <option value="test">Test data</option>
            </select>
            <select
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPage(1);
                setPageSize(next);
              }}
              className="h-8 rounded-md border border-white/10 bg-[#0F1621] px-2 text-white"
              aria-label="Items per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            {selectedPaymentIds.size > 0 ? (
              <AdminGhostButton className="text-[#FCA5A5]" onClick={() => void deleteSelectedTestPayments()} disabled={deletingPaymentId === "bulk"}>
                <Trash2 size={14} aria-hidden="true" />
                Delete selected ({selectedPaymentIds.size})
              </AdminGhostButton>
            ) : null}
            <AdminGhostButton onClick={() => void exportCsv()}>
              <Download size={14} aria-hidden="true" />
              Export history CSV
            </AdminGhostButton>
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <AdminSectionCard title="Total Processed All Time">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">{formatAdminCurrency(paymentsQuery.data?.metrics.totalProcessedAllTime ?? 0)}</p>
        </AdminSectionCard>
        <AdminSectionCard title="Processed This Month">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">{formatAdminCurrency(paymentsQuery.data?.metrics.processedThisMonth ?? 0)}</p>
        </AdminSectionCard>
        <AdminSectionCard title="Failed This Month">
          <p className="text-[26px] font-bold tracking-[-0.04em] text-[#F87171] sm:text-[32px]">{paymentsQuery.data?.metrics.failedThisMonth ?? 0}</p>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="How pending works">
        <p className="text-sm text-white/60">
          A payment can stay <span className="font-medium text-[#F1F5F9]">Pending</span> even after its due date when the linked invoice or bill is still open in Moniger.
          Use <span className="font-medium text-[#F1F5F9]">Reconcile</span> to refresh the payment from its linked document and capture when it was last checked.
        </p>
      </AdminSectionCard>

      {paymentsQuery.isLoading ? (
        <AdminSectionCard title="Payments">
          <AdminTableSkeleton columns={6} rows={Math.max(3, Math.min(12, pageSize))} />
        </AdminSectionCard>
      ) : null}

      {paymentsQuery.error ? (
        <AdminSectionCard title="Unable to Load Payments">
          <p className="text-sm text-[#FCA5A5]">{paymentsErrorMessage}</p>
          <p className="mt-2 text-sm text-white/45">
            This usually means the `admin-console` edge function is not deployed, is missing server secrets, or cannot query the payments tables.
          </p>
        </AdminSectionCard>
      ) : null}

      {!paymentsQuery.error && rows.length === 0 ? (
        <AdminSectionCard title="No Payments Yet">
          <AdminEmpty
            title="No payments available"
            description="Seed or create payment records in this environment before using the admin payments view."
            icon={Inbox}
          />
        </AdminSectionCard>
      ) : null}

      {!paymentsQuery.error && rows.length > 0 && filteredRows.length === 0 ? <AdminSectionCard title="No matching payments"><AdminEmpty title="No payments match this data mode" description="Choose All data, Live data, or Test data to change the view." icon={Inbox} /></AdminSectionCard> : null}

      {!paymentsQuery.error && filteredRows.length > 0 && isMobile ? (
        <div className="space-y-2.5">
          {displayedRows.map((payment) => (
            <div key={payment.paymentId} className={`rounded-xl border bg-[#161E2E] p-3.5 ${payment.status === "failed" ? "border-l-4 border-l-[#EF4444] border-white/5" : "border-white/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#F1F5F9]">{payment.paymentReference}</p>
                  <p className="text-xs text-white/35">{payment.businessName}</p>
                </div>
                <AdminBadge tone={payment.status === "completed" ? "success" : payment.status === "failed" ? "danger" : "warning"}>
                  {payment.status}
                </AdminBadge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminBadge tone="neutral">{payment.paymentType}</AdminBadge>
                <AdminBadge tone="neutral">{formatAdminCurrency(payment.amount)}</AdminBadge>
                <AdminBadge tone={getRoutingBadge(payment).tone}>{getRoutingBadge(payment).label}</AdminBadge>
                <AdminBadge tone={getReconciliationBadge(payment).tone}>{getReconciliationBadge(payment).label}</AdminBadge>
              </div>
              <p className="mt-2 text-xs text-white/40">{formatAdminDateTime(payment.date)}</p>
              <p className="mt-2 text-xs text-white/50">{payment.reconciliation.summary}</p>
              <div className="mt-3 flex justify-end">
                {payment.isTestData ? (
                  <AdminGhostButton
                    className="mr-2 h-8 px-2.5 text-xs text-[#FCA5A5]"
                    disabled={deletingPaymentId === payment.paymentId}
                    onClick={() => void deleteTestPayment(payment)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete test
                  </AdminGhostButton>
                ) : (
                  <AdminGhostButton className="mr-2 h-8 px-2.5 text-xs" disabled title="Live/provider-linked payments are protected">
                    <Trash2 size={14} aria-hidden="true" />
                    Protected
                  </AdminGhostButton>
                )}
                {payment.reconciliation.canReconcile ? (
                  <AdminGhostButton
                    className="mr-2 h-8 px-2.5 text-xs"
                    disabled={reconcilingPaymentId === payment.paymentId}
                    onClick={() => void reconcilePayment(payment)}
                  >
                    <RefreshCcw size={14} aria-hidden="true" className={reconcilingPaymentId === payment.paymentId ? "animate-spin" : ""} />
                    Reconcile
                  </AdminGhostButton>
                ) : null}
                <AdminGhostButton className="h-8 px-2.5 text-xs" onClick={() => setSelectedPayment(payment)}>
                  <Eye size={14} aria-hidden="true" />
                  View details
                </AdminGhostButton>
              </div>
            </div>
          ))}
        </div>
      ) : !paymentsQuery.error && filteredRows.length > 0 ? (
        <>
          <AdminTableWrapper>
          <table className="min-w-full text-left text-sm text-white/70">
            <AdminTableHead>
              <tr>
                <th className="px-3 py-2.5 sm:px-4">
                  <input
                    type="checkbox"
                    aria-label="Select displayed test payments"
                    checked={allDisplayedPaymentsSelected}
                    onChange={() => setSelectedPaymentIds((current) => {
                      const next = new Set(current);
                      if (allDisplayedPaymentsSelected) selectablePaymentIds.forEach((id) => next.delete(id));
                      else selectablePaymentIds.forEach((id) => next.add(id));
                      return next;
                    })}
                  />
                </th>
                <th className="px-3 py-2.5 sm:px-4">Payment</th>
                <th className="px-3 py-2.5 sm:px-4">Type</th>
                <th className="px-3 py-2.5 sm:px-4">Amount</th>
                <th className="px-3 py-2.5 sm:px-4">Status</th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">Reconciliation</th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">Routing</th>
                <th className="hidden px-3 py-2.5 xl:table-cell sm:px-4">Date</th>
                <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {displayedRows.map((payment) => (
                <tr key={payment.paymentId} className={`border-b border-white/5 ${payment.status === "failed" ? "border-l-2 border-l-[#EF4444]" : ""}`}>
                  <td className="px-3 py-3 sm:px-4">
                    {payment.isTestData ? <input type="checkbox" aria-label={`Select test payment ${payment.paymentReference}`} checked={selectedPaymentIds.has(payment.paymentId)} onChange={() => togglePaymentSelection(payment.paymentId)} /> : null}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="space-y-1">
                      <p className="font-medium text-[#F1F5F9]">{payment.paymentReference}</p>
                      <p className="text-xs text-white/40">{payment.businessName}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 sm:px-4">{payment.paymentType}</td>
                  <td className="px-3 py-3 sm:px-4">{formatAdminCurrency(payment.amount)}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <AdminBadge tone={payment.status === "completed" ? "success" : payment.status === "failed" ? "danger" : "warning"}>
                      {payment.status}
                    </AdminBadge>
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell sm:px-4">
                    <div className="space-y-2">
                      <AdminBadge tone={getReconciliationBadge(payment).tone}>{getReconciliationBadge(payment).label}</AdminBadge>
                      <p className="max-w-[240px] text-xs text-white/45">{payment.reconciliation.summary}</p>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 lg:table-cell sm:px-4">
                    <AdminBadge tone={getRoutingBadge(payment).tone}>{getRoutingBadge(payment).label}</AdminBadge>
                  </td>
                  <td className="hidden px-3 py-3 text-white/45 xl:table-cell sm:px-4">{formatAdminDateTime(payment.date)}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex items-center justify-end gap-2">
                      {payment.reconciliation.canReconcile ? (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                          title="Reconcile payment"
                          disabled={reconcilingPaymentId === payment.paymentId}
                          onClick={() => void reconcilePayment(payment)}
                        >
                          <RefreshCcw size={14} aria-hidden="true" className={reconcilingPaymentId === payment.paymentId ? "animate-spin" : ""} />
                          Reconcile
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        title="View details"
                        onClick={() => setSelectedPayment(payment)}
                      >
                        <Eye size={14} aria-hidden="true" />
                      </button>
                      {payment.isTestData ? (
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Delete eligible test payment"
                          disabled={deletingPaymentId === payment.paymentId}
                          onClick={() => void deleteTestPayment(payment)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      ) : (
                        <button type="button" disabled title="Live/provider-linked payments are protected" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/30 disabled:cursor-not-allowed">
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                        title="Open payment details"
                        onClick={() => setSelectedPayment(payment)}
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </AdminTableWrapper>
          <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-white/40">{rows.length} payments</div>
          <div className="flex items-center gap-2">
            <AdminGhostButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </AdminGhostButton>
            <div className="text-sm text-white/40">Page {page}</div>
            <AdminGhostButton onClick={() => setPage((p) => p + 1)} disabled={rows.length <= page * pageSize}>
              Next
            </AdminGhostButton>
          </div>
          </div>
        </>
      ) : null}

      <Dialog open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9] sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{selectedPayment?.paymentReference ?? "Payment details"}</DialogTitle>
            <DialogDescription className="text-white/45">
              Review the payment outcome and, when applicable, the marketplace-routing settlement snapshot captured from Paystack verification.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#0F1621] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/35">Business</p>
                  <p className="mt-1 text-sm font-medium text-[#F1F5F9]">{selectedPayment.businessName}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0F1621] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/35">Amount</p>
                  <p className="mt-1 text-sm font-medium text-[#F1F5F9]">{formatAdminCurrency(selectedPayment.amount)}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0F1621] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/35">Status</p>
                  <div className="mt-1">
                    <AdminBadge tone={getPaymentStatusTone(selectedPayment)}>
                      {selectedPayment.status}
                    </AdminBadge>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#0F1621] p-3">
                  <p className="text-xs uppercase tracking-[0.08em] text-white/35">Recorded</p>
                  <p className="mt-1 text-sm font-medium text-[#F1F5F9]">{formatAdminDateTime(selectedPayment.date)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0F1621] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F1F5F9]">Reconciliation</p>
                    <p className="mt-1 text-xs text-white/45">
                      This explains whether the linked invoice or bill still matches the payment row you see in admin.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AdminBadge tone={getReconciliationBadge(selectedPayment).tone}>{getReconciliationBadge(selectedPayment).label}</AdminBadge>
                    {selectedPayment.reconciliation.canReconcile ? (
                      <AdminGhostButton
                        className="h-8 px-2.5 text-xs"
                        disabled={reconcilingPaymentId === selectedPayment.paymentId}
                        onClick={() => void reconcilePayment(selectedPayment)}
                      >
                        <RefreshCcw size={14} aria-hidden="true" className={reconcilingPaymentId === selectedPayment.paymentId ? "animate-spin" : ""} />
                        Reconcile now
                      </AdminGhostButton>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-white/35">Summary</p>
                    <p className="mt-1 text-sm text-[#F1F5F9]">{selectedPayment.reconciliation.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-white/35">Last checked</p>
                    <p className="mt-1 text-sm text-[#F1F5F9]">{formatAdminDateTime(selectedPayment.reconciliation.lastCheckedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-white/35">Linked source</p>
                    <p className="mt-1 text-sm text-[#F1F5F9]">{selectedPayment.reconciliation.sourceType ?? "Not available"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-white/35">Source status</p>
                    <p className="mt-1 text-sm text-[#F1F5F9]">{selectedPayment.reconciliation.sourceStatus ?? "Not available"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-white/35">Linked document</p>
                    <p className="mt-1 text-sm text-[#F1F5F9]">{selectedPayment.reconciliation.linkedDocumentNumber ?? "Not available"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-white/35">Linked due date</p>
                    <p className="mt-1 text-sm text-[#F1F5F9]">{formatAdminDateTime(selectedPayment.reconciliation.linkedDueDate)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0F1621] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#F1F5F9]">Marketplace routing</p>
                    <p className="mt-1 text-xs text-white/45">
                      This is the snapshot Moniger kept for the payment-routing rule and the settlement details Paystack returned after verification.
                    </p>
                  </div>
                  <AdminBadge tone={getRoutingBadge(selectedPayment).tone}>{getRoutingBadge(selectedPayment).label}</AdminBadge>
                </div>

                {selectedPayment.marketplaceRouting ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Mode</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">{selectedPayment.marketplaceRouting.mode ?? "Not set"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Split code</p>
                      <p className="mt-1 break-all text-sm text-[#F1F5F9]">{selectedPayment.marketplaceRouting.providerSplitCode ?? "Not used"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Subaccount code</p>
                      <p className="mt-1 break-all text-sm text-[#F1F5F9]">{selectedPayment.marketplaceRouting.providerSubaccountCode ?? "Not used"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Transaction charge</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {formatKoboCurrency(
                          selectedPayment.marketplaceRouting.transactionChargeKobo,
                          selectedPayment.marketplaceRouting.settlement?.currency ?? "NGN",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Settled amount</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {formatKoboCurrency(
                          selectedPayment.marketplaceRouting.settlement?.amountKobo,
                          selectedPayment.marketplaceRouting.settlement?.currency ?? "NGN",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Provider fees</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {formatKoboCurrency(
                          selectedPayment.marketplaceRouting.settlement?.feesKobo,
                          selectedPayment.marketplaceRouting.settlement?.currency ?? "NGN",
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Verified at</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {formatAdminDateTime(selectedPayment.marketplaceRouting.settlement?.verifiedAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Paystack paid at</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {formatAdminDateTime(selectedPayment.marketplaceRouting.settlement?.paidAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Provider status</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {selectedPayment.marketplaceRouting.settlement?.providerStatus ?? "Not available"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Provider reference</p>
                      <p className="mt-1 break-all text-sm text-[#F1F5F9]">
                        {selectedPayment.marketplaceRouting.settlement?.providerReference ?? selectedPayment.paymentReference}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Paystack transaction date</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {formatAdminDateTime(selectedPayment.marketplaceRouting.settlement?.transactionDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-white/35">Gateway response</p>
                      <p className="mt-1 text-sm text-[#F1F5F9]">
                        {selectedPayment.marketplaceRouting.settlement?.gatewayResponse ?? selectedPayment.gatewayResponse ?? "Not available"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/55">
                    This payment used the standard flow without marketplace-routing metadata.
                  </p>
                )}
              </div>
              {selectedPayment.isTestData ? (
                <div className="flex justify-end">
                  <AdminGhostButton
                    className="text-[#FCA5A5]"
                    disabled={deletingPaymentId === selectedPayment.paymentId}
                    onClick={() => void deleteTestPayment(selectedPayment)}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                    Delete eligible test payment
                  </AdminGhostButton>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentsPage;
