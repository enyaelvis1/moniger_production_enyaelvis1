import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Building2, Download, Plus, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  AdminBadge,
  AdminEmpty,
  AdminGhostButton,
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableWrapper,
  AdminTableSkeleton,
  AdminToolbar,
  formatAdminDate,
} from "@/admin/components/AdminUi";
import { useAuth } from "@/contexts/AuthContext";
import { useBanksList, useBankMutations } from "@/hooks/use-directory-data";
import { invokeAdminConsole, useAdminConsoleQuery, type AdminSettingsResponse } from "@/admin/lib/admin-console";
import { getBankLogoUrl } from "@/lib/bank-logos";

const BankLogo = ({ name }: { name: string }) => {
  const [hasError, setHasError] = useState(false);
  const logoUrl = getBankLogoUrl(name);

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white p-1">
      {logoUrl && !hasError ? (
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <Building2 className="h-4 w-4 text-slate-500" aria-hidden="true" />
      )}
    </div>
  );
};

const AdminBanksPage = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const banksQuery = useBanksList();
  const { createBank, updateBank } = useBankMutations(undefined, user?.id);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [addOpen, setAddOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newBankCode, setNewBankCode] = useState("");
  const [newBankCountryCode, setNewBankCountryCode] = useState("NG");
  const [pendingDeleteBank, setPendingDeleteBank] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingBank, setIsDeletingBank] = useState(false);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = banksQuery.data ?? [];
    return q ? list.filter((b) => b.name.toLowerCase().includes(q)) : list;
  }, [banksQuery.data, deferredSearch]);

  const settingsQuery = useAdminConsoleQuery<AdminSettingsResponse>("settings.get");
  const configByKey = useMemo(
    () => new Map((settingsQuery.data?.platformConfig ?? []).map((item) => [item.key, item.value ?? {}])),
    [settingsQuery.data?.platformConfig],
  );

  useEffect(() => {
    const configured = Number(configByKey.get("admin_page_size")?.value ?? 25);
    setPageSize(configured);
  }, [configByKey]);

  const start = (page - 1) * pageSize;
  const displayed = useMemo(() => (filtered ?? []).slice(start, start + pageSize), [filtered, start, pageSize]);

  const handleAdd = async () => {
    const name = newBankName.trim();
    if (!name) return;
    try {
      await createBank.mutateAsync({
        bankCode: newBankCode.trim() || null,
        countryCode: newBankCountryCode.trim() || "NG",
        name,
      });
      setNewBankName("");
      setNewBankCode("");
      setNewBankCountryCode("NG");
      setAddOpen(false);
      toast({ title: "Bank added", description: `${name} has been added.` });
    } catch (err) {
      toast({ title: "Unable to add bank", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateBank.mutateAsync({ id, values: { is_active: !isActive } });
      toast({ title: "Bank updated", description: "Bank status updated." });
    } catch (err) {
      toast({ title: "Unable to update bank", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleDeleteBank = async () => {
    if (!pendingDeleteBank || isDeletingBank) return;
    setIsDeletingBank(true);
    try {
      const result = await invokeAdminConsole<{ bankName: string; clearedReferenceCount: number }>("banks.delete", { bankId: pendingDeleteBank.id });
      await banksQuery.refetch();
      setPendingDeleteBank(null);
      toast({ title: "Bank removed", description: `${result.bankName} was removed. ${result.clearedReferenceCount} existing reference(s) were unassigned.` });
    } catch (err) {
      toast({ title: "Unable to remove bank", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setIsDeletingBank(false);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Banks"
        subtitle="Manage platform-wide bank list used for vendor payouts and integrations."
        action={(
          <div className="flex items-center gap-2">
            <AdminBadge tone="neutral">{banksQuery.data?.length ?? 0} banks</AdminBadge>
            <Button onClick={() => setAddOpen(true)} className="hidden sm:inline-flex" title="Add bank">
              <Plus size={14} />
              <span className="ml-2">Add Bank</span>
            </Button>
          </div>
        )}
      />

      <AdminToolbar>
        <div className="relative w-full flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search banks"
            className="h-10 border-white/10 bg-[#0F1621] pl-10 text-sm text-white placeholder:text-white/30 sm:h-11"
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

      <AdminSectionCard title="Bank list">
        {banksQuery.isLoading ? (
          <AdminTableSkeleton columns={4} rows={Math.max(3, Math.min(12, pageSize))} />
        ) : (
          <AdminTableWrapper>
            {(filtered ?? []).length === 0 ? (
              <AdminEmpty icon={() => <Plus />} title="No banks" description="Add a bank to get started." />
            ) : (
              <table className="w-full table-auto">
                <AdminTableHead>
                  <tr>
                    <th className="px-4 py-3 text-left">Bank</th>
                    <th className="px-4 py-3 text-left">Code</th>
                    <th className="px-4 py-3 text-left">Country</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </AdminTableHead>
                <tbody>
                  {displayed.map((b) => (
                    <tr key={b.id} className="border-t border-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <BankLogo name={b.name} />
                          <span>{b.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{b.bank_code ?? "—"}</td>
                      <td className="px-4 py-3">{b.country_code ?? "—"}</td>
                      <td className="px-4 py-3">{formatAdminDate(b.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        {b.is_active ? <AdminBadge tone="success">Active</AdminBadge> : <AdminBadge tone="danger">Disabled</AdminBadge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AdminGhostButton onClick={() => void handleToggleActive(b.id, b.is_active)}>
                            {b.is_active ? "Disable" : "Enable"}
                          </AdminGhostButton>
                          <AdminGhostButton
                            onClick={() => setPendingDeleteBank(b)}
                            className="border-[#EF4444]/20 text-[#FCA5A5] hover:border-[#EF4444]/40 hover:bg-[#EF4444]/10"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Remove
                          </AdminGhostButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </AdminTableWrapper>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-white/40">{(filtered ?? []).length} banks</div>
          <div className="flex items-center gap-2">
            <AdminGhostButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </AdminGhostButton>
            <div className="text-sm text-white/40">Page {page}</div>
            <AdminGhostButton onClick={() => setPage((p) => p + 1)} disabled={(filtered ?? []).length <= page * pageSize}>
              Next
            </AdminGhostButton>
          </div>
        </div>
      </AdminSectionCard>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add bank</DialogTitle>
            <DialogDescription>Enter the bank name to add to the platform list.</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <Input value={newBankName} onChange={(e) => setNewBankName(e.target.value)} placeholder="Bank name" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Input
              value={newBankCode}
              onChange={(e) => setNewBankCode(e.target.value)}
              placeholder="Bank code"
              aria-label="Bank code"
            />
            <Input
              value={newBankCountryCode}
              onChange={(e) => setNewBankCountryCode(e.target.value)}
              placeholder="Country code"
              aria-label="Country code"
              maxLength={2}
            />
          </div>
          <p className="mt-2 text-xs text-white/40">
            Bank code is required for outgoing payout transfers. Country code defaults to `NG`.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleAdd()} className="ml-2">Add Bank</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteBank)} onOpenChange={(open) => !open && !isDeletingBank && setPendingDeleteBank(null)}>
        <AlertDialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9]">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this bank?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {pendingDeleteBank
                ? `${pendingDeleteBank.name} will be removed from the platform bank list. Existing vendor and payout-account references will be unassigned, not deleted.`
                : "This action removes the bank from the platform list."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void handleDeleteBank(); }} className="bg-[#EF4444] text-white hover:bg-[#DC2626]">
              {isDeletingBank ? "Removing..." : "Remove bank"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminBanksPage;
