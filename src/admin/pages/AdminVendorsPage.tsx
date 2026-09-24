import { useDeferredValue, useMemo, useState } from "react";
import { Building2, Search, Store, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { invokeAdminConsole, useAdminConsoleQuery, type AdminVendorsResponse } from "@/admin/lib/admin-console";

const maskAccountNumber = (value: string | null) => {
  if (!value) return "Not provided";
  if (value.length <= 4) return value;
  return `•••• ${value.slice(-4)}`;
};

const AdminVendorsPage = () => {
  const [search, setSearch] = useState("");
  const [dataMode, setDataMode] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const deferredSearch = useDeferredValue(search);
  const pageSize = 25;
  const vendorsQuery = useAdminConsoleQuery<AdminVendorsResponse>("vendors.list", {
    dataMode,
    search: deferredSearch,
  });
  const rows = useMemo(() => vendorsQuery.data?.rows ?? [], [vendorsQuery.data?.rows]);
  const pageRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, rows]);
  const selectableRows = pageRows.filter((vendor) => vendor.isTestData && vendor.billCount === 0);
  const allSelectableSelected = selectableRows.length > 0 && selectableRows.every((vendor) => selectedVendorIds.includes(vendor.vendorId));

  const updateSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const updateDataMode = (value: string) => {
    setDataMode(value);
    setPage(1);
  };

  const deleteSelectedTestVendors = async () => {
    if (selectedVendorIds.length === 0) return;
    const reason = window.prompt("Enter a cleanup reason (at least 10 characters):", "Remove selected test vendors after QA")?.trim() ?? "";
    if (reason.length < 10 || !window.confirm(`Delete ${selectedVendorIds.length} selected test vendor record(s)? Linked vendors will be blocked.`)) return;
    try {
      await invokeAdminConsole("testData.delete", {
        bulkConfirmation: `DELETE ${selectedVendorIds.length} RECORDS`,
        confirmation: "DELETE TEST DATA",
        reason,
        recordIds: selectedVendorIds,
        resource: "other",
      });
      await vendorsQuery.refetch();
      setSelectedVendorIds([]);
    } catch (error) {
      // The shared cleanup endpoint returns a useful blocked-record explanation.
      window.alert(error instanceof Error ? error.message : "Only eligible marked test vendors can be deleted.");
    }
  };

  const deleteTestVendor = async (vendorId: string, vendorName: string) => {
    const reason = window.prompt(`Reason for removing ${vendorName} (at least 10 characters):`, "Remove test vendor after QA")?.trim() ?? "";
    if (reason.length < 10 || !window.confirm(`Remove test vendor ${vendorName}? This cannot be undone.`)) return;
    try {
      await invokeAdminConsole("testData.delete", {
        confirmation: "DELETE TEST DATA",
        reason,
        recordId: vendorId,
        resource: "other",
      });
      await vendorsQuery.refetch();
      setSelectedVendorIds((current) => current.filter((id) => id !== vendorId));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Only eligible marked test vendors can be deleted.");
    }
  };

  const markVendorAsTestData = async (vendorId: string, vendorName: string) => {
    const reason = window.prompt(`Reason for marking ${vendorName} as test data (at least 10 characters):`, "Confirm QA vendor for cleanup")?.trim() ?? "";
    const confirmation = "MARK 1 VENDORS AS TEST";
    if (reason.length < 10 || window.prompt(`Type exactly: ${confirmation}`)?.trim() !== confirmation) return;
    try {
      await invokeAdminConsole("testData.mark", { confirmation, reason, vendorIds: [vendorId] });
      await vendorsQuery.refetch();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Unable to mark this vendor as test data.");
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Vendors"
        subtitle="Platform-wide vendor directory and payable context across all workspaces."
        action={<AdminBadge tone="neutral">{vendorsQuery.data?.total ?? 0} vendors</AdminBadge>}
      />

      <AdminToolbar>
        {selectableRows.length > 0 ? <label className="flex items-center gap-2 text-xs text-white/60"><Checkbox checked={allSelectableSelected} onCheckedChange={(checked) => setSelectedVendorIds(checked === true ? selectableRows.map((vendor) => vendor.vendorId) : [])} aria-label="Select all visible test vendors" /> Select test vendors ({selectedVendorIds.length} selected)</label> : null}
        {selectedVendorIds.length > 0 ? <Button variant="destructive" onClick={() => void deleteSelectedTestVendors()}>Delete selected test vendors</Button> : null}
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
                  <th className="w-10 px-4 py-3"><span className="sr-only">Select</span></th>
                  <th className="px-4 py-3 text-left">Vendor</th>
                  <th className="px-4 py-3 text-left">Workspace</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Bank account</th>
                  <th className="px-4 py-3 text-right">Bills</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </AdminTableHead>
              <tbody>
                {pageRows.map((vendor) => (
                  <tr key={vendor.vendorId} className="border-t border-white/5 align-top">
                    <td className="px-4 py-4">{vendor.isTestData ? <Checkbox checked={selectedVendorIds.includes(vendor.vendorId)} onCheckedChange={(checked) => setSelectedVendorIds((current) => checked === true ? [...new Set([...current, vendor.vendorId])] : current.filter((id) => id !== vendor.vendorId))} aria-label={`Select ${vendor.vendorName}`} /> : null}</td>
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
                    <td className="px-4 py-4 text-right">
                      {vendor.isTestData && vendor.billCount === 0 ? (
                        <Button variant="ghost" className="h-8 border border-[#EF4444]/20 bg-[#EF4444]/10 text-xs text-[#FCA5A5] hover:bg-[#EF4444]/20" onClick={() => void deleteTestVendor(vendor.vendorId, vendor.vendorName)}>
                          <Trash2 size={13} aria-hidden="true" /> Remove
                        </Button>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" className="h-8 text-xs text-white/55" onClick={() => void markVendorAsTestData(vendor.vendorId, vendor.vendorName)}>Mark as test</Button>
                          <Button variant="ghost" disabled className="h-8 text-xs text-white/30" title={vendor.billCount > 0 ? "Vendors with linked bills are protected" : "Live or unmarked vendors are protected"}>Protected</Button>
                        </div>
                      )}
                    </td>
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
