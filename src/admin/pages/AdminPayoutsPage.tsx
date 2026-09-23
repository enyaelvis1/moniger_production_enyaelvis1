import { Download, Inbox, RefreshCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { createExportFileName, downloadCsvFile } from "@/lib/export";
import { invokeAdminConsole, useAdminConsoleQuery, type AdminPayoutsResponse, type AdminSettingsResponse, type AdminTestDataDeleteResponse } from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminEmpty,
  AdminGhostButton,
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableSkeleton,
  AdminTableWrapper,
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/admin/components/AdminUi";
import { useIsMobile } from "@/hooks/use-mobile";

type AdminPayoutRow = AdminPayoutsResponse["rows"][number];

const getPayoutTone = (status: string) => {
  switch (status) {
    case "completed":
      return "success" as const;
    case "reserved":
    case "submitted":
    case "processing":
      return "warning" as const;
    case "failed":
    case "reversed":
    case "cancelled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
};

const formatStatusLabel = (status: string) => {
  switch (status) {
    case "reserved":
      return "Reserved";
    case "submitted":
      return "Submitted";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "reversed":
      return "Reversed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
};

const safeDeleteStatuses = new Set(["failed", "reversed", "cancelled"]);

const AdminPayoutsPage = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const payoutsQuery = useAdminConsoleQuery<AdminPayoutsResponse>("payouts.list");
  const settingsQuery = useAdminConsoleQuery<AdminSettingsResponse>("settings.get");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [dataMode, setDataMode] = useState<"all" | "live" | "test">("all");
  const [deletingPayoutId, setDeletingPayoutId] = useState<string | null>(null);
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<Set<string>>(new Set());

  const rows = payoutsQuery.data?.rows ?? [];
  const safePageSize = useMemo(() => {
    const configured = Number(settingsQuery.data?.platformConfig?.find((item) => item.key === "admin_page_size")?.value ?? 25);
    if (!Number.isFinite(configured) || configured < 1) {
      return 25;
    }
    return Math.max(1, Math.round(configured));
  }, [settingsQuery.data?.platformConfig]);
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const start = (safePage - 1) * safePageSize;
  const filteredRows = useMemo(
    () => dataMode === "all" ? rows : rows.filter((row) => dataMode === "test" ? row.isTestData : !row.isTestData),
    [dataMode, rows],
  );
  const displayedRows = useMemo(() => filteredRows.slice(start, start + safePageSize), [filteredRows, start, safePageSize]);

  useEffect(() => {
    setPageSize(safePageSize);
    if (page < 1) {
      setPage(1);
    }
  }, [page, safePageSize]);

  const exportCsv = async () => {
    try {
      const payload = await invokeAdminConsole<AdminPayoutsResponse>("payouts.export");
      downloadCsvFile({
        columns: [
          { header: "Business", value: (row) => row.businessName },
          { header: "Vendor", value: (row) => row.vendorName ?? "" },
          { header: "Bill", value: (row) => row.billNumber ?? "" },
          { header: "Amount", value: (row) => row.amount },
          { header: "Currency", value: (row) => row.currency },
          { header: "Status", value: (row) => row.status },
          { header: "Bank", value: (row) => row.bankName ?? "" },
          { header: "Provider Reference", value: (row) => row.providerReference ?? "" },
          { header: "Transfer Code", value: (row) => row.providerTransferCode ?? "" },
          { header: "Scheduled For", value: (row) => row.scheduledFor ?? "" },
          { header: "Created At", value: (row) => row.createdAt },
          { header: "Completed At", value: (row) => row.completedAt ?? "" },
          { header: "Failure Reason", value: (row) => row.failureReason ?? "" },
        ],
        filename: `${createExportFileName("admin-payouts")}.csv`,
        rows: payload.rows,
      });

      toast({
        title: "Payout history exported",
        description: "The admin payout CSV is ready for download.",
      });
    } catch (error) {
      toast({
        title: "Unable to export payout history",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteTestPayout = async (payout: AdminPayoutRow) => {
    if (!payout.isTestData || !safeDeleteStatuses.has(payout.status)) {
      toast({ title: "Payout is protected", description: "Only marked test payouts in failed, reversed, or cancelled status can be deleted.", variant: "destructive" });
      return;
    }

    const reason = window.prompt("Enter a cleanup reason (at least 10 characters):", "Remove test payout after QA")?.trim() ?? "";
    if (reason.length < 10) return;
    if (!window.confirm(`Delete test payout for ${payout.vendorName ?? "this vendor"}? This cannot be undone.`)) return;

    setDeletingPayoutId(payout.payoutId);
    try {
      const result = await invokeAdminConsole<AdminTestDataDeleteResponse>("testData.delete", {
        confirmation: "DELETE TEST DATA",
        reason,
        recordId: payout.payoutId,
        resource: "payouts",
      });
      await payoutsQuery.refetch();
      toast({ title: "Test payout deleted", description: `${result.deleted.payouts} payout record removed and audited.` });
    } catch (error) {
      toast({ title: "Unable to delete payout", description: error instanceof Error ? error.message : "Only eligible test payouts can be deleted.", variant: "destructive" });
    } finally {
      setDeletingPayoutId(null);
    }
  };

  const deleteSelectedTestPayouts = async () => {
    const ids = Array.from(selectedPayoutIds);
    if (ids.length === 0) return;
    const reason = window.prompt("Enter a cleanup reason (at least 10 characters):", "Remove selected test payouts after QA")?.trim() ?? "";
    if (reason.length < 10) return;
    if (!window.confirm(`Delete ${ids.length} selected test payout record(s)? This cannot be undone.`)) return;
    setDeletingPayoutId("bulk");
    try {
      const result = await invokeAdminConsole<AdminTestDataDeleteResponse>("testData.delete", {
        bulkConfirmation: `DELETE ${ids.length} RECORDS`,
        confirmation: "DELETE TEST DATA",
        reason,
        recordIds: ids,
        resource: "payouts",
      });
      await payoutsQuery.refetch();
      setSelectedPayoutIds(new Set());
      toast({ title: "Test payouts deleted", description: `${result.deleted.payouts} payout record(s) removed and audited.` });
    } catch (error) {
      toast({ title: "Unable to delete selected payouts", description: error instanceof Error ? error.message : "Only eligible test payouts can be deleted.", variant: "destructive" });
    } finally {
      setDeletingPayoutId(null);
    }
  };

  const selectablePayoutIds = displayedRows.filter((payout) => payout.isTestData && safeDeleteStatuses.has(payout.status)).map((payout) => payout.payoutId);
  const allDisplayedPayoutsSelected = selectablePayoutIds.length > 0 && selectablePayoutIds.every((id) => selectedPayoutIds.has(id));
  const togglePayoutSelection = (payoutId: string) => setSelectedPayoutIds((current) => {
    const next = new Set(current);
    if (next.has(payoutId)) next.delete(payoutId);
    else next.add(payoutId);
    return next;
  });

  const metrics = payoutsQuery.data?.metrics;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Payouts"
        subtitle="Workspace outgoing payout reporting across the platform."
        action={(
          <div className="flex items-center gap-3">
            <select
              value={dataMode}
              onChange={(event) => { setDataMode(event.target.value as typeof dataMode); setPage(1); }}
              className="h-8 rounded-md border border-[#DCE2F2] bg-white px-2 text-[#10203F] dark:border-white/10 dark:bg-[#0F1621] dark:text-white"
              aria-label="Filter payout data mode"
            >
              <option value="all">All data</option>
              <option value="live">Live data</option>
              <option value="test">Test data</option>
            </select>
            <select
              value={safePageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPage(1);
                setPageSize(Number.isFinite(next) && next > 0 ? next : 25);
              }}
              className="h-8 rounded-md border border-[#DCE2F2] bg-white px-2 text-[#10203F] dark:border-white/10 dark:bg-[#0F1621] dark:text-white"
              aria-label="Items per page"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <AdminGhostButton onClick={() => void payoutsQuery.refetch()}>
              <RefreshCcw size={14} aria-hidden="true" />
              Refresh
            </AdminGhostButton>
            {selectedPayoutIds.size > 0 ? (
              <AdminGhostButton className="text-[#FCA5A5]" onClick={() => void deleteSelectedTestPayouts()} disabled={deletingPayoutId === "bulk"}>
                <Trash2 size={14} aria-hidden="true" />
                Delete selected ({selectedPayoutIds.size})
              </AdminGhostButton>
            ) : null}
            <AdminGhostButton onClick={() => void exportCsv()}>
              <Download size={14} aria-hidden="true" />
              Export history CSV
            </AdminGhostButton>
          </div>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <AdminSectionCard title="Total Payouts">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">{metrics?.totalCount ?? 0}</p>
        </AdminSectionCard>
        <AdminSectionCard title="Total Value">
          <p className="text-[26px] font-bold tracking-[-0.04em] sm:text-[32px]">{formatAdminCurrency(metrics?.totalValue ?? 0)}</p>
        </AdminSectionCard>
        <AdminSectionCard title="Completed This Month">
          <p className="text-[26px] font-bold tracking-[-0.04em] text-[#34D399] sm:text-[32px]">{metrics?.completedThisMonth ?? 0}</p>
        </AdminSectionCard>
        <AdminSectionCard title="Reserved Balance">
          <p className="text-[26px] font-bold tracking-[-0.04em] text-[#FBBF24] sm:text-[32px]">{formatAdminCurrency(metrics?.reservedTotal ?? 0)}</p>
        </AdminSectionCard>
      </div>

      <AdminSectionCard title="Payout status guide">
        <p className="text-sm text-white/60">
          Reserved payouts have funds locked in the workspace wallet. Submitted and processing payouts are already in flight with the provider.
          Completed, failed, reversed, and cancelled items are settled outcomes that are kept for reconciliation and audit.
        </p>
      </AdminSectionCard>

      {payoutsQuery.isLoading ? (
        <AdminSectionCard title="Payouts">
          <AdminTableSkeleton columns={8} rows={Math.max(3, Math.min(12, pageSize))} />
        </AdminSectionCard>
      ) : null}

      {payoutsQuery.error ? (
        <AdminSectionCard title="Unable to Load Payouts">
          <p className="text-sm text-[#FCA5A5]">
            The admin payouts query failed. Check the `admin-console` edge function and its environment variables.
          </p>
        </AdminSectionCard>
      ) : null}

      {!payoutsQuery.error && rows.length === 0 ? (
        <AdminSectionCard title="No Payouts Yet">
          <AdminEmpty
            title="No payout records available"
            description="Create or sync outgoing payouts in this environment before using the admin payouts view."
            icon={Inbox}
          />
        </AdminSectionCard>
      ) : null}

      {!payoutsQuery.error && rows.length > 0 && filteredRows.length === 0 ? <AdminSectionCard title="No matching payouts"><AdminEmpty title="No payouts match this data mode" description="Choose All data, Live data, or Test data to change the view." icon={Inbox} /></AdminSectionCard> : null}

      {!payoutsQuery.error && filteredRows.length > 0 && isMobile ? (
        <div className="space-y-2.5">
          {displayedRows.map((payout) => (
            <div key={payout.payoutId} className={`rounded-xl border bg-[#161E2E] p-3.5 ${payout.status === "failed" ? "border-l-4 border-l-[#EF4444] border-white/5" : "border-white/5"}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {payout.isTestData && safeDeleteStatuses.has(payout.status) ? <input type="checkbox" aria-label={`Select test payout for ${payout.vendorName ?? "vendor"}`} checked={selectedPayoutIds.has(payout.payoutId)} onChange={() => togglePayoutSelection(payout.payoutId)} className="mr-2" /> : null}
                  <p className="text-sm font-semibold text-[#F1F5F9]">{payout.businessName}</p>
                  <p className="text-xs text-white/35">{payout.vendorName || "Unknown vendor"}</p>
                </div>
                <AdminBadge tone={getPayoutTone(payout.status)}>{formatStatusLabel(payout.status)}</AdminBadge>
              </div>
              <div className="mt-3 space-y-1 text-xs text-white/55">
                <p>{formatAdminCurrency(payout.amount, payout.currency)} · {payout.billNumber ? `Bill ${payout.billNumber}` : "Bill payout"}</p>
                <p>{payout.bankName || "Unknown bank"}{payout.recipientBankCode ? ` (${payout.recipientBankCode})` : ""}</p>
                <p>Created {formatAdminDateTime(payout.createdAt)}</p>
                {payout.scheduledFor ? <p>Scheduled {formatAdminDateTime(payout.scheduledFor)}</p> : null}
                {payout.completedAt ? <p>Completed {formatAdminDateTime(payout.completedAt)}</p> : null}
                {payout.failureReason ? <p className="text-[#FCA5A5]">{payout.failureReason}</p> : null}
              </div>
              {payout.isTestData && safeDeleteStatuses.has(payout.status) ? (
                <div className="mt-3 flex justify-end">
                  <AdminGhostButton className="h-8 px-2.5 text-xs text-[#FCA5A5]" disabled={deletingPayoutId === payout.payoutId} onClick={() => void deleteTestPayout(payout)}>
                    <Trash2 size={14} aria-hidden="true" />
                    Delete test
                  </AdminGhostButton>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!payoutsQuery.error && filteredRows.length > 0 && !isMobile ? (
        <AdminTableWrapper>
          <table className="w-full text-sm">
            <AdminTableHead>
              <tr>
                <th className="table-header px-4 py-3 text-left">
                  <input type="checkbox" aria-label="Select displayed test payouts" checked={allDisplayedPayoutsSelected} onChange={() => setSelectedPayoutIds((current) => { const next = new Set(current); if (allDisplayedPayoutsSelected) selectablePayoutIds.forEach((id) => next.delete(id)); else selectablePayoutIds.forEach((id) => next.add(id)); return next; })} />
                </th>
                <th className="table-header px-4 py-3 text-left">Business</th>
                <th className="table-header px-4 py-3 text-left">Vendor</th>
                <th className="table-header px-4 py-3 text-left">Bill</th>
                <th className="table-header px-4 py-3 text-left">Amount</th>
                <th className="table-header px-4 py-3 text-left">Status</th>
                <th className="table-header px-4 py-3 text-left">Bank</th>
                <th className="table-header px-4 py-3 text-left">Reference</th>
                <th className="table-header px-4 py-3 text-left">Dates</th>
                <th className="table-header px-4 py-3 text-right">Actions</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {displayedRows.map((payout: AdminPayoutRow) => (
                <tr key={payout.payoutId} className="border-t border-white/5">
                  <td className="px-4 py-3">
                    {payout.isTestData && safeDeleteStatuses.has(payout.status) ? <input type="checkbox" aria-label={`Select test payout for ${payout.vendorName ?? "vendor"}`} checked={selectedPayoutIds.has(payout.payoutId)} onChange={() => togglePayoutSelection(payout.payoutId)} /> : null}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#F1F5F9]">{payout.businessName}</p>
                    <p className="text-xs text-white/40">{payout.businessId}</p>
                  </td>
                  <td className="px-4 py-3 text-[#F1F5F9]">{payout.vendorName || "Unknown vendor"}</td>
                  <td className="px-4 py-3 text-[#F1F5F9]">{payout.billNumber || "Bill payout"}</td>
                  <td className="px-4 py-3 font-medium text-[#F1F5F9]">{formatAdminCurrency(payout.amount, payout.currency)}</td>
                  <td className="px-4 py-3">
                    <AdminBadge tone={getPayoutTone(payout.status)}>{formatStatusLabel(payout.status)}</AdminBadge>
                  </td>
                  <td className="px-4 py-3 text-[#F1F5F9]">
                    {payout.bankName || "Unknown bank"}
                    {payout.recipientBankCode ? <span className="text-white/40"> ({payout.recipientBankCode})</span> : null}
                  </td>
                  <td className="px-4 py-3 text-[#F1F5F9]">
                    <p>{payout.providerReference || "Pending"}</p>
                    {payout.providerTransferCode ? <p className="text-xs text-white/40">{payout.providerTransferCode}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-white/55">
                    <p>Created {formatAdminDateTime(payout.createdAt)}</p>
                    {payout.scheduledFor ? <p>Scheduled {formatAdminDateTime(payout.scheduledFor)}</p> : null}
                    {payout.submittedAt ? <p>Submitted {formatAdminDateTime(payout.submittedAt)}</p> : null}
                    {payout.completedAt ? <p>Completed {formatAdminDateTime(payout.completedAt)}</p> : null}
                    {payout.failureReason ? <p className="text-[#FCA5A5]">{payout.failureReason}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payout.isTestData && safeDeleteStatuses.has(payout.status) ? (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20 disabled:cursor-not-allowed disabled:opacity-60"
                        title="Delete eligible test payout"
                        disabled={deletingPayoutId === payout.payoutId}
                        onClick={() => void deleteTestPayout(payout)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    ) : <span className="text-xs text-white/30">Protected</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableWrapper>
      ) : null}

      {rows.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-sm text-white/45">
          <p>
            Showing {rows.length === 0 ? 0 : start + 1}-{Math.min(start + safePageSize, rows.length)} of {rows.length}
          </p>
          <div className="flex items-center gap-2">
            <AdminGhostButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1 || payoutsQuery.isFetching}>
              Previous
            </AdminGhostButton>
            <AdminGhostButton onClick={() => setPage((current) => current + 1)} disabled={rows.length <= safePage * safePageSize}>
              Next
            </AdminGhostButton>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminPayoutsPage;
