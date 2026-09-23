import { useDeferredValue, useMemo, useState } from "react";
import { Building2, Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AdminBadge,
  AdminEmpty,
  AdminGhostButton,
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableSkeleton,
  AdminTableWrapper,
  AdminToolbar,
  formatAdminCurrency,
  formatAdminDate,
} from "@/admin/components/AdminUi";
import { useAdminConsoleQuery, type AdminVendorsResponse } from "@/admin/lib/admin-console";

const maskAccountNumber = (value: string | null) => {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `•••• ${value.slice(-4)}`;
};

const AdminVendorsPage = () => {
  const [search, setSearch] = useState("");
  const [dataMode, setDataMode] = useState("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search);
  const pageSize = 25;
  const vendorsQuery = useAdminConsoleQuery<AdminVendorsResponse>("vendors.list", {
    dataMode,
    search: deferredSearch,
  });
  const rows = useMemo(() => vendorsQuery.data?.rows ?? [], [vendorsQuery.data?.rows]);
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, rows]);

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateDataMode = (value: string) => {
    setDataMode(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vendors"
        subtitle="Platform-wide vendor directory and payable context across all workspaces."
        action={<AdminBadge tone="neutral">{vendorsQuery.data?.total ?? 0} vendors</AdminBadge>}
      />

      <AdminToolbar>
        <div className="relative w-full flex-1 sm:min-w-[280px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Search vendors, businesses, contacts, or banks"
            className="h-10 border-white/10 bg-[#0F1621] pl-10 text-sm text-white placeholder:text-white/30 sm:h-11"
          />
        </div>
        <select
          value={dataMode}
          onChange={(event) => updateDataMode(event.target.value)}
          className="h-10 rounded-md border border-white/10 bg-[#0F1621] px-3 text-sm text-white sm:h-11"
          aria-label="Vendor data scope"
        >
          <option value="all">All data</option>
          <option value="live">Live data</option>
          <option value="test">Test data</option>
        </select>
      </AdminToolbar>

      <AdminSectionCard title="Vendor directory">
        {vendorsQuery.isLoading ? (
          <AdminTableSkeleton columns={7} rows={8} />
        ) : vendorsQuery.error ? (
          <AdminEmpty icon={Store} title="Vendors could not be loaded" description={vendorsQuery.error instanceof Error ? vendorsQuery.error.message : "Try refreshing the page."} />
        ) : rows.length === 0 ? (
          <AdminEmpty icon={Store} title="No vendors found" description="Try a different search or data scope." />
        ) : (
          <AdminTableWrapper>
            <table className="w-full min-w-[980px] text-sm">
              <AdminTableHead>
                <tr>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Workspace</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Bank account</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-left">Created</th>
                </tr>
              </AdminTableHead>
              <tbody>
                {pageRows.map((vendor) => (
                  <tr key={vendor.vendorId} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50">
                          <Building2 size={16} aria-hidden="true" />
                        </div>
                        <div>
                          <p className="font-medium text-[#F1F5F9]">{vendor.vendorName}</p>
                          {vendor.contactName ? <p className="mt-1 text-xs text-white/40">{vendor.contactName}</p> : null}
                          {vendor.isTestData ? <AdminBadge tone="warning">Test</AdminBadge> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-white/70">{vendor.businessName}</td>
                    <td className="px-4 py-4">
                      <p className="text-white/75">{vendor.email ?? "No email"}</p>
                      {vendor.phone ? <p className="mt-1 text-xs text-white/40">{vendor.phone}</p> : null}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-white/75">{vendor.bankName ?? "Bank not assigned"}</p>
                      <p className="mt-1 text-xs text-white/40">{maskAccountNumber(vendor.accountNumber)}{vendor.accountName ? ` · ${vendor.accountName}` : ""}</p>
                    </td>
                    <td className="px-4 py-4 text-right text-white/70">{vendor.billCount}</td>
                    <td className="px-4 py-4 text-right font-medium text-white/85">{formatAdminCurrency(vendor.totalPaid)}</td>
                    <td className="px-4 py-4 text-white/50">{formatAdminDate(vendor.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableWrapper>
        )}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-white/40">{rows.length} vendor{rows.length === 1 ? "" : "s"}</p>
          <div className="flex items-center gap-2">
            <AdminGhostButton onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>Prev</AdminGhostButton>
            <span className="text-sm text-white/40">Page {page}</span>
            <AdminGhostButton onClick={() => setPage((current) => current + 1)} disabled={rows.length <= page * pageSize}>Next</AdminGhostButton>
          </div>
        </div>
      </AdminSectionCard>
    </div>
  );
};

export default AdminVendorsPage;
