import { useDeferredValue, useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAdminConsoleQuery, type AdminAuditResponse, type AdminSettingsResponse } from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSectionCard,
  AdminToolbar,
  AdminGhostButton,
  formatAdminDateTime,
} from "@/admin/components/AdminUi";
import { Skeleton } from "@/components/ui/skeleton";

const AdminAuditPage = () => {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const settingsQuery = useAdminConsoleQuery<AdminSettingsResponse>("settings.get");
  const configByKey = useMemo(
    () => new Map((settingsQuery.data?.platformConfig ?? []).map((item) => [item.key, item.value ?? {}])),
    [settingsQuery.data?.platformConfig],
  );

  useEffect(() => {
    const configured = Number(configByKey.get("admin_page_size")?.value ?? 25);
    setPageSize(configured);
  }, [configByKey]);

  const auditQuery = useAdminConsoleQuery<AdminAuditResponse>("audit.list", { page, pageSize, q: deferredSearch }, true);

  const rows = auditQuery.data?.rows ?? [];
  const total = auditQuery.data?.total;
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

  const start = (page - 1) * pageSize;

  const filteredRows = useMemo(() => {
    if (!deferredSearch) return rows;
    const q = deferredSearch.toLowerCase();
    return rows.filter((row) => `${row.summary} ${row.action} ${row.businessName ?? ""} ${row.actorEmail ?? ""}`.toLowerCase().includes(q));
  }, [rows, deferredSearch]);

  const displayedRows = useMemo(() => filteredRows.slice(start, start + pageSize), [filteredRows, start, pageSize]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit Log"
        subtitle="Platform-wide operator and workspace activity, with admin actions highlighted."
      />

      <AdminToolbar>
        <div className="relative rounded-xl border border-white/10 bg-[#161E2E] p-2 w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Filter by business, user, summary, or action..."
            className="h-11 border-white/10 bg-[#0F1621] pl-10 text-white placeholder:text-white/30"
          />
        </div>
        <div className="ml-3">
          <select
            value={pageSize}
            onChange={(event) => {
              const next = Number(event.target.value);
              setPage(1);
              setPageSize(next);
            }}
            className="h-10 rounded-md border border-white/10 bg-[#0F1621] px-2 text-white"
            aria-label="Items per page"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </AdminToolbar>

      <AdminSectionCard title="Audit Timeline">
        {auditQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: Math.max(3, Math.min(12, pageSize)) }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="mt-3">
                  <Skeleton className="h-4 w-full" />
                  <div className="mt-2 flex items-center gap-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRows.map((row) => (
              <div key={`${row.id}`} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {row.isAdminAction ? <AdminBadge tone="info">ADMIN</AdminBadge> : null}
                  <AdminBadge tone="neutral">{row.action}</AdminBadge>
                  {row.businessName ? <AdminBadge tone="neutral">{row.businessName}</AdminBadge> : null}
                </div>
                <p className="mt-3 text-sm font-medium text-[#F1F5F9]">{row.summary}</p>
                <p className="mt-1 text-sm text-white/45">{row.actorEmail ?? "System actor"}</p>
                <p className="mt-2 text-xs text-white/30">{formatAdminDateTime(row.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-white/40">{total ? `${total} events` : `${rows.length} events`}</div>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.target.value);
                setPage(1);
                setPageSize(next);
              }}
              className="h-8 rounded-md border border-white/10 bg-[#0F1621] px-2 text-white"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <AdminGhostButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1 || auditQuery.isFetching}>
              Prev
            </AdminGhostButton>
            <div className="text-sm text-white/40">Page {page}{totalPages ? ` of ${totalPages}` : ""}</div>
            <AdminGhostButton
              onClick={() => setPage((p) => p + 1)}
              disabled={auditQuery.isFetching || (totalPages ? page >= totalPages : rows.length < pageSize)}
            >
              Next
            </AdminGhostButton>
          </div>
        </div>
      </AdminSectionCard>
    </div>
  );
};

export default AdminAuditPage;
