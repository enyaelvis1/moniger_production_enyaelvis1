import { Download, Inbox, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { createExportFileName, downloadCsvFile } from "@/lib/export";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminReceivablesDeleteResponse,
  type AdminReceivablesResponse,
} from "@/admin/lib/admin-console";
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
  formatAdminDate,
} from "@/admin/components/AdminUi";

type ReceivableRow = AdminReceivablesResponse["rows"][number];

const statusTone = (status: string) => {
  if (status === "paid") return "success" as const;
  if (status === "overdue" || status === "cancelled") return "danger" as const;
  if (status === "sent") return "info" as const;
  return "warning" as const;
};

const AdminReceivablesPage = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [status, setStatus] = useState("all");
  const [dataMode, setDataMode] = useState<"all" | "live" | "test">("all");
  const [selectedReceivableIds, setSelectedReceivableIds] = useState<Set<string>>(new Set());
  const queryPayload = useMemo(() => ({ dataMode, status }), [dataMode, status]);
  const receivablesQuery = useAdminConsoleQuery<AdminReceivablesResponse>("receivables.list", queryPayload);
  const rows = receivablesQuery.data?.rows ?? [];

  const deleteSelectedTestReceivables = async () => {
    const ids = Array.from(selectedReceivableIds);
    if (ids.length === 0) return;
    const reason = window.prompt("Enter a cleanup reason (at least 10 characters):", "Remove selected test receivables after QA")?.trim() ?? "";
    if (reason.length < 10) return;
    if (!window.confirm(`Delete ${ids.length} selected test receivable record(s) and linked test payments? This cannot be undone.`)) return;
    try {
      const result = await invokeAdminConsole<AdminReceivablesDeleteResponse>("testData.receivables.delete", {
        bulkConfirmation: `DELETE ${ids.length} RECORDS`,
        reason,
        recordIds: ids,
      });
      await receivablesQuery.refetch();
      setSelectedReceivableIds(new Set());
      toast({ title: "Test receivables deleted", description: `${result.deleted.invoices} receivable(s) and ${result.deleted.payments} linked payment(s) removed and audited.` });
    } catch (error) {
      toast({ title: "Unable to delete selected receivables", description: error instanceof Error ? error.message : "Only receivables linked exclusively to test payments can be deleted.", variant: "destructive" });
    }
  };

  const selectableReceivableIds = rows.filter((row) => row.isTestData && row.paymentReference).map((row) => row.invoiceId);
  const allReceivablesSelected = selectableReceivableIds.length > 0 && selectableReceivableIds.every((id) => selectedReceivableIds.has(id));
  const toggleReceivableSelection = (invoiceId: string) => setSelectedReceivableIds((current) => {
    const next = new Set(current);
    if (next.has(invoiceId)) next.delete(invoiceId);
    else next.add(invoiceId);
    return next;
  });

  const exportCsv = async () => {
    try {
      const payload = await invokeAdminConsole<AdminReceivablesResponse>("receivables.export", queryPayload);
      downloadCsvFile({
        columns: [
          { header: "Business", value: (row) => row.businessName },
          { header: "Customer", value: (row) => row.customerName },
          { header: "Invoice", value: (row) => row.invoiceNumber },
          { header: "Total", value: (row) => row.totalAmount },
          { header: "Paid", value: (row) => row.amountPaid },
          { header: "Balance", value: (row) => row.balanceDue },
          { header: "Status", value: (row) => row.status },
          { header: "Due date", value: (row) => row.dueDate ?? "" },
          { header: "Payment reference", value: (row) => row.paymentReference ?? "" },
        ],
        filename: `${createExportFileName("admin-receivables")}.csv`,
        rows: payload.rows,
      });
      toast({ title: "Receivables exported", description: "The admin receivables CSV is ready for download." });
    } catch (error) {
      toast({ title: "Unable to export receivables", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Receivables"
        subtitle="Platform-wide incoming invoice balances and payment settlement visibility."
        action={(
          <div className="flex flex-wrap items-center gap-2">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 rounded-md border border-[#DCE2F2] bg-white px-2 text-[#10203F] dark:border-white/10 dark:bg-[#0F1621] dark:text-white" aria-label="Filter receivable status">
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="overdue">Overdue</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={dataMode} onChange={(event) => setDataMode(event.target.value as typeof dataMode)} className="h-8 rounded-md border border-[#DCE2F2] bg-white px-2 text-[#10203F] dark:border-white/10 dark:bg-[#0F1621] dark:text-white" aria-label="Filter receivable data mode">
              <option value="all">All data</option>
              <option value="live">Live data</option>
              <option value="test">Test data</option>
            </select>
            {selectedReceivableIds.size > 0 ? (
              <AdminGhostButton className="text-[#FCA5A5]" onClick={() => void deleteSelectedTestReceivables()}>
                <Trash2 size={14} aria-hidden="true" />
                Delete selected ({selectedReceivableIds.size})
              </AdminGhostButton>
            ) : null}
            <AdminGhostButton onClick={() => void exportCsv()}>
              <Download size={14} aria-hidden="true" />
              Export CSV
            </AdminGhostButton>
          </div>
        )}
      />

      <AdminSectionCard title="Receivable records">
        {receivablesQuery.isLoading ? <AdminTableSkeleton columns={8} rows={5} /> : null}
        {receivablesQuery.error ? <p className="text-sm text-[#FCA5A5]">Unable to load receivables. Check the admin-console function and database access.</p> : null}
        {!receivablesQuery.isLoading && !receivablesQuery.error && rows.length === 0 ? <AdminEmpty title="No receivables found" description="Create or filter invoice records to see incoming balances here." icon={Inbox} /> : null}

        {!receivablesQuery.isLoading && !receivablesQuery.error && rows.length > 0 && isMobile ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.invoiceId} className="rounded-xl border border-white/10 bg-[#0F1621] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {row.isTestData && row.paymentReference ? <input type="checkbox" aria-label={`Select test receivable ${row.invoiceNumber}`} checked={selectedReceivableIds.has(row.invoiceId)} onChange={() => toggleReceivableSelection(row.invoiceId)} className="mr-2" /> : null}
                    <p className="font-medium text-[#F1F5F9]">{row.invoiceNumber}</p>
                    <p className="text-xs text-white/45">{row.businessName} · {row.customerName}</p>
                  </div>
                  <AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-white/55">
                  <p>Total {formatAdminCurrency(row.totalAmount, row.currency)} · Balance {formatAdminCurrency(row.balanceDue, row.currency)}</p>
                  <p>Due {formatAdminDate(row.dueDate)}</p>
                  <p>{row.paymentReference ? `Payment ${row.paymentReference}` : "No payment reference"}</p>
                </div>
                <button type="button" disabled={!row.isTestData || !row.paymentReference} title={row.isTestData && row.paymentReference ? "Select this marked test receivable for deletion" : "Live or unmarked receivables are protected"} className="mt-3 inline-flex h-8 items-center gap-1 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 px-2.5 text-xs text-[#FCA5A5] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30" onClick={() => toggleReceivableSelection(row.invoiceId)}>
                  <Trash2 size={13} aria-hidden="true" /> {row.isTestData && row.paymentReference ? "Select for deletion" : "Protected"}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {!receivablesQuery.isLoading && !receivablesQuery.error && rows.length > 0 && !isMobile ? (
          <AdminTableWrapper>
            <table className="w-full text-sm">
              <AdminTableHead>
                <tr>
                  <th className="table-header px-4 py-3 text-left"><input type="checkbox" aria-label="Select displayed test receivables" checked={allReceivablesSelected} onChange={() => setSelectedReceivableIds((current) => { const next = new Set(current); if (allReceivablesSelected) selectableReceivableIds.forEach((id) => next.delete(id)); else selectableReceivableIds.forEach((id) => next.add(id)); return next; })} /></th>
                  <th className="table-header px-4 py-3 text-left">Business / Customer</th>
                  <th className="table-header px-4 py-3 text-left">Invoice</th>
                  <th className="table-header px-4 py-3 text-left">Total</th>
                  <th className="table-header px-4 py-3 text-left">Balance</th>
                  <th className="table-header px-4 py-3 text-left">Status</th>
                  <th className="table-header px-4 py-3 text-left">Due</th>
                  <th className="table-header px-4 py-3 text-left">Settlement</th>
                  <th className="table-header px-4 py-3 text-right">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody>
                {rows.map((row: ReceivableRow) => (
                  <tr key={row.invoiceId} className="border-t border-white/5">
                    <td className="px-4 py-3">{row.isTestData && row.paymentReference ? <input type="checkbox" aria-label={`Select test receivable ${row.invoiceNumber}`} checked={selectedReceivableIds.has(row.invoiceId)} onChange={() => toggleReceivableSelection(row.invoiceId)} /> : null}</td>
                    <td className="px-4 py-3"><p className="font-medium text-[#F1F5F9]">{row.businessName}</p><p className="text-xs text-white/45">{row.customerName}</p></td>
                    <td className="px-4 py-3 text-[#F1F5F9]">{row.invoiceNumber}</td>
                    <td className="px-4 py-3 text-[#F1F5F9]">{formatAdminCurrency(row.totalAmount, row.currency)}</td>
                    <td className="px-4 py-3 text-[#F1F5F9]">{formatAdminCurrency(row.balanceDue, row.currency)}</td>
                    <td className="px-4 py-3"><AdminBadge tone={statusTone(row.status)}>{row.status}</AdminBadge></td>
                    <td className="px-4 py-3 text-white/55">{formatAdminDate(row.dueDate)}</td>
                    <td className="px-4 py-3 text-xs text-white/55">{row.paymentReference ?? "No payment"}{row.paymentStatus ? ` · ${row.paymentStatus}` : ""}</td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" disabled={!row.isTestData || !row.paymentReference} title={row.isTestData && row.paymentReference ? "Select this marked test receivable for deletion" : "Live or unmarked receivables are protected"} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 px-2.5 text-xs text-[#FCA5A5] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30" onClick={() => toggleReceivableSelection(row.invoiceId)}>
                        <Trash2 size={13} aria-hidden="true" /> {row.isTestData && row.paymentReference ? "Select delete" : "Protected"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrapper>
        ) : null}
      </AdminSectionCard>
    </div>
  );
};

export default AdminReceivablesPage;
