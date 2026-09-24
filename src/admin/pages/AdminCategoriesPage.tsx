import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
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
import { useCategoriesList, useCategoryMutations } from "@/hooks/use-finance-data";
import { useAdminConsoleQuery, type AdminSettingsResponse } from "@/admin/lib/admin-console";

const AdminCategoriesPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const categoriesQuery = useCategoriesList();
  const { createCategory, modifyCategory } = useCategoryMutations();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [addOpen, setAddOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const list = categoriesQuery.data ?? [];
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [categoriesQuery.data, deferredSearch]);

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
  const allDisplayedSelected = displayed.length > 0 && displayed.every((category) => selectedCategoryIds.includes(category.id));

  const handleAdd = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await createCategory.mutateAsync({ name, userId: user?.id });
      setNewCategoryName("");
      setAddOpen(false);
      toast({ title: "Category added", description: `${name} has been added.` });
    } catch (err) {
      toast({ title: "Unable to add category", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await modifyCategory.mutateAsync({ id, values: { is_active: !isActive } });
      toast({ title: "Category updated", description: "Category status updated." });
    } catch (err) {
      toast({ title: "Unable to update category", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  const bulkToggleCategories = async (isActive: boolean) => {
    try {
      await Promise.all(selectedCategoryIds.map((id) => modifyCategory.mutateAsync({ id, values: { is_active: isActive } })));
      await categoriesQuery.refetch();
      setSelectedCategoryIds([]);
      toast({ title: "Categories updated", description: `${selectedCategoryIds.length} categories were ${isActive ? "enabled" : "archived"}.` });
    } catch (err) {
      toast({ title: "Unable to update categories", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bill categories"
        subtitle="Manage platform-wide bill categories used when creating bills."
        action={(
          <div className="flex items-center gap-2">
            <AdminBadge tone="neutral">{categoriesQuery.data?.length ?? 0} categories</AdminBadge>
            <Button onClick={() => setAddOpen(true)} className="hidden sm:inline-flex" title="Add category">
              <Plus size={14} />
              <span className="ml-2">Add category</span>
            </Button>
            {selectedCategoryIds.length > 0 ? <AdminGhostButton onClick={() => void bulkToggleCategories(false)}>Archive selected</AdminGhostButton> : null}
          </div>
        )}
      />

      <AdminToolbar>
        <label className="flex items-center gap-2 text-xs text-white/60">
          <Checkbox checked={allDisplayedSelected} onCheckedChange={(checked) => setSelectedCategoryIds(checked === true ? displayed.map((category) => category.id) : [])} aria-label="Select all visible categories" />
          Select all visible ({selectedCategoryIds.length} selected)
        </label>
        <div className="relative w-full flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search categories"
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

      <AdminSectionCard title="Categories">
        {categoriesQuery.isLoading ? (
          <AdminTableSkeleton columns={4} rows={Math.max(3, Math.min(12, pageSize))} />
        ) : (
          <AdminTableWrapper>
            {(filtered ?? []).length === 0 ? (
              <AdminEmpty icon={() => <Plus />} title="No categories" description="Add a category to get started." />
            ) : (
              <table className="w-full table-auto">
                <AdminTableHead>
                  <tr>
                    <th className="w-10 px-4 py-3"><span className="sr-only">Select</span></th>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Created</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </AdminTableHead>
                <tbody>
                  {displayed.map((c) => (
                    <tr key={c.id} className="border-t border-white/5">
                      <td className="px-4 py-3"><Checkbox checked={selectedCategoryIds.includes(c.id)} onCheckedChange={(checked) => setSelectedCategoryIds((current) => checked === true ? [...new Set([...current, c.id])] : current.filter((id) => id !== c.id))} aria-label={`Select ${c.name}`} /></td>
                      <td className="px-4 py-3">{c.name}</td>
                      <td className="px-4 py-3">{formatAdminDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.is_active ? <AdminBadge tone="success">Active</AdminBadge> : <AdminBadge tone="danger">Disabled</AdminBadge>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AdminGhostButton onClick={() => void handleToggleActive(c.id, c.is_active)}>
                            {c.is_active ? "Disable" : "Enable"}
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
          <div className="text-sm text-white/40">{(filtered ?? []).length} categories</div>
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
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>Enter the category name to add to the platform list.</DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <Input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="Category name" />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleAdd()} className="ml-2">Add category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCategoriesPage;
