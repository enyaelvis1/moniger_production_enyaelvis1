import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download, Inbox, MoreVertical, Search, Shield, ShieldCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
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
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminUsersResponse,
  type AdminSettingsResponse,
} from "@/admin/lib/admin-console";
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
  formatAdminRelativeTime,
} from "@/admin/components/AdminUi";

type BulkAnnouncementType = "feature" | "info" | "maintenance" | "warning";
type AdminUserRow = AdminUsersResponse["rows"][number];
type UserFilter = "all" | "test" | "non_test";

const initialBulkAnnouncementState = {
  body: "",
  title: "",
  type: "info" as BulkAnnouncementType,
};

const getWorkspaceSummary = (row: AdminUserRow) => {
  if (row.workspaces.length === 0) {
    return "No workspace";
  }

  if (row.workspaces.length === 1) {
    return row.workspaces[0];
  }

  return `${row.workspaces[0]} +${row.workspaces.length - 1} more`;
};

const AdminUsersPage = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [userFilter, setUserFilter] = useState<UserFilter>("all");
  const [bulkAnnouncementOpen, setBulkAnnouncementOpen] = useState(false);
  const [bulkAnnouncement, setBulkAnnouncement] = useState(initialBulkAnnouncementState);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUserRow | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isPublishingAnnouncement, setIsPublishingAnnouncement] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const usersQuery = useAdminConsoleQuery<AdminUsersResponse>("users.list", { search: deferredSearch });
  const usersErrorMessage = usersQuery.error instanceof Error
    ? usersQuery.error.message
    : "The admin users query failed. Check the admin-console edge function and its environment variables.";
  const filteredRows = useMemo(
    () => (usersQuery.data?.rows ?? []).filter((row) => userFilter === "all" || (userFilter === "test" ? row.isTestUser : !row.isTestUser)),
    [userFilter, usersQuery.data?.rows],
  );
  const allSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.userId)),
    [filteredRows, selectedIds],
  );

  const settingsQuery = useAdminConsoleQuery<AdminSettingsResponse>("settings.get");
  const configByKey = useMemo(
    () => new Map((settingsQuery.data?.platformConfig ?? []).map((item) => [item.key, item.value ?? {}])),
    [settingsQuery.data?.platformConfig],
  );

  useEffect(() => {
    const configured = Number(configByKey.get("admin_page_size")?.value ?? 25);
    setPageSize(configured);
  }, [configByKey]);

  const totalRows = filteredRows.length;
  const start = (page - 1) * pageSize;
  const displayedRows = useMemo(() => filteredRows.slice(start, start + pageSize), [filteredRows, start, pageSize]);

  const toggleSelection = (userId: string) => {
    setSelectedIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };

  const runUserAction = async (userId: string, type: string) => {
    try {
      const result = await invokeAdminConsole<{ message?: string }>("users.action", { type, userId });
      await usersQuery.refetch();
      toast({
        title: "User updated",
        description: result.message ?? `The ${type.replace(/_/g, " ")} action completed.`,
      });
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unable to update this user.",
        variant: "destructive",
      });
    }
  };

  const deletePendingUser = async () => {
    if (!pendingDeleteUser || isDeletingUser) {
      return;
    }

    setIsDeletingUser(true);

    try {
      const result = await invokeAdminConsole<{ message?: string }>("users.action", {
        type: "delete",
        userId: pendingDeleteUser.userId,
      });
      await usersQuery.refetch();
      setSelectedIds((current) => current.filter((id) => id !== pendingDeleteUser.userId));
      setPendingDeleteUser(null);
      toast({
        title: "User deleted",
        description: result.message ?? "The user was deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Unable to delete this user.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const exportSelected = () => {
    const rows = (usersQuery.data?.rows ?? []).filter((row) => selectedIds.includes(row.userId));
    downloadCsvFile({
      columns: [
        { header: "Email", value: (row) => row.email },
        { header: "Name", value: (row) => row.fullName ?? "" },
        { header: "Workspace", value: (row) => row.workspaces.join(", ") },
        { header: "Role", value: (row) => row.role },
        { header: "Last Active", value: (row) => row.lastActive ?? "" },
        { header: "MFA", value: (row) => row.mfaEnabled ? "Enabled" : "Disabled" },
        { header: "Status", value: (row) => row.status },
      ],
      filename: `${createExportFileName("admin-users-selected")}.csv`,
      rows,
    });
  };

  const publishAnnouncementToSelectedUsers = async () => {
    setIsPublishingAnnouncement(true);

    try {
      await invokeAdminConsole("announcements.save", {
        body: bulkAnnouncement.body,
        publishNow: true,
        target: "all",
        targetFilters: {
          userIds: selectedIds,
        },
        title: bulkAnnouncement.title,
        type: bulkAnnouncement.type,
      });

      toast({
        title: "Announcement published",
        description: `Notifications were queued for ${selectedIds.length} selected user${selectedIds.length === 1 ? "" : "s"}.`,
      });
      setBulkAnnouncement(initialBulkAnnouncementState);
      setBulkAnnouncementOpen(false);
      setSelectedIds([]);
    } catch (error) {
      toast({
        title: "Unable to publish announcement",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPublishingAnnouncement(false);
    }
  };

  const renderUserActionMenu = (row: AdminUserRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={`Actions for ${row.fullName ?? row.email}`}
        >
          <MoreVertical size={14} aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => void runUserAction(row.userId, "reset_password")}>Reset password</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void runUserAction(row.userId, "revoke_sessions")}>Revoke all sessions</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void runUserAction(row.userId, row.status === "suspended" ? "unsuspend" : "suspend")}>
          {row.status === "suspended" ? "Restore user" : "Suspend user"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-red-400 focus:text-red-300" onClick={() => setPendingDeleteUser(row)}>
          Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        subtitle="People across all workspaces, including security posture and recent activity."
      />

      <AdminToolbar>
        <div className="relative w-full flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
            placeholder="Search by email, name, or workspace"
            className="h-10 border-white/10 bg-[#0F1621] pl-10 text-sm text-white placeholder:text-white/30 sm:h-11"
          />
        </div>
        <select
          value={userFilter}
          onChange={(event) => {
            setPage(1);
            setSelectedIds([]);
            setUserFilter(event.target.value as UserFilter);
          }}
          className="h-10 rounded-md border border-white/10 bg-[#0F1621] px-3 text-white sm:h-11"
          aria-label="User type filter"
        >
          <option value="all">All users</option>
          <option value="test">Test users</option>
          <option value="non_test">Production users</option>
        </select>
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

      {usersQuery.isLoading ? (
        <AdminSectionCard title="Users">
          <AdminTableSkeleton columns={7} rows={Math.max(3, Math.min(12, pageSize))} />
        </AdminSectionCard>
      ) : null}

      {usersQuery.error ? (
        <AdminSectionCard title="Unable to Load Users">
          <p className="text-sm text-[#FCA5A5]">{usersErrorMessage}</p>
          <p className="mt-2 text-sm text-white/45">
            Because the admin users page reads from the auth admin API, a blank page here usually points to an `admin-console` edge function problem rather than missing seed data.
          </p>
        </AdminSectionCard>
      ) : null}

      {!usersQuery.error && totalRows === 0 ? (
          <AdminSectionCard title="No Users Found">
            <AdminEmpty
            title={userFilter === "test" ? "No test users available" : userFilter === "non_test" ? "No production users available" : "No users available"}
            description={userFilter === "test" ? "Test users are identified by explicit test or QA metadata. Create future QA accounts with the test-user script." : "Create or sign in with at least one account in this environment before using the admin users view."}
            icon={Inbox}
          />
        </AdminSectionCard>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="sticky bottom-3 z-20 flex flex-col gap-2 rounded-xl border border-[#3B82F6]/20 bg-[#111927] px-3 py-3 sm:bottom-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-4">
          <AdminBadge tone="info">{selectedIds.length} selected</AdminBadge>
          <AdminGhostButton className="justify-start sm:justify-center" onClick={() => setBulkAnnouncementOpen(true)}>
            Send announcement to selected
          </AdminGhostButton>
          <AdminGhostButton
            className="justify-start sm:justify-center"
            onClick={() => {
              void Promise.all(selectedIds.map((userId) => runUserAction(userId, "suspend"))).then(() => setSelectedIds([]));
            }}
          >
            Suspend selected
          </AdminGhostButton>
          <AdminGhostButton className="justify-start sm:justify-center" onClick={exportSelected}>
            <Download size={14} aria-hidden="true" />
            Export selected
          </AdminGhostButton>
        </div>
      ) : null}

      {!usersQuery.error && totalRows > 0 && isMobile ? (
        <div className="space-y-2.5">
          {displayedRows.map((row) => (
            <div key={row.userId} className="rounded-xl border border-white/5 bg-[#161E2E] p-3.5">
              <div className="flex items-start gap-3">
                <Checkbox checked={selectedIds.includes(row.userId)} onCheckedChange={() => toggleSelection(row.userId)} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#F1F5F9]">{row.fullName ?? row.email}</p>
                    <p className="text-xs text-white/35">{row.email}</p>
                      {row.isTestUser ? <AdminBadge tone="warning">Test user</AdminBadge> : null}
                    </div>
                    {renderUserActionMenu(row)}
                  </div>

                  <div className="mt-2 grid gap-1.5 text-xs text-white/40">
                    <p>Workspace: {getWorkspaceSummary(row)}</p>
                    <p>Last active: {formatAdminRelativeTime(row.lastActive)}</p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminBadge tone={row.status === "suspended" ? "danger" : row.status === "inactive" ? "warning" : "success"}>
                      {row.status}
                    </AdminBadge>
                    <AdminBadge tone="neutral">{row.role}</AdminBadge>
                    <AdminBadge tone={row.mfaEnabled ? "success" : "neutral"}>{row.mfaEnabled ? "MFA enabled" : "MFA disabled"}</AdminBadge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !usersQuery.error && totalRows > 0 ? (
        <>
          <AdminTableWrapper>
          <table className="min-w-full text-left text-sm text-white/70">
            <AdminTableHead>
              <tr>
                <th className="px-3 py-2.5 sm:px-4">
                  <Checkbox checked={allSelected} onCheckedChange={() => setSelectedIds(allSelected ? [] : filteredRows.map((row) => row.userId))} />
                </th>
                <th className="px-3 py-2.5 sm:px-4">User</th>
                <th className="px-3 py-2.5 sm:px-4">Workspace</th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">Last Active</th>
                <th className="hidden px-3 py-2.5 xl:table-cell sm:px-4">Role</th>
                <th className="px-3 py-2.5 sm:px-4">Status</th>
                <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {displayedRows.map((row) => (
                <tr key={row.userId} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-3 align-top sm:px-4">
                    <Checkbox checked={selectedIds.includes(row.userId)} onCheckedChange={() => toggleSelection(row.userId)} />
                  </td>
                  <td className="px-3 py-3 align-top sm:px-4">
                    <div className="space-y-1">
                      <p className="font-medium text-[#F1F5F9]">{row.fullName ?? row.email}</p>
                      <p className="text-xs text-white/40">{row.email}</p>
                      {row.isTestUser ? <AdminBadge tone="warning">Test user</AdminBadge> : null}
                      <div className="inline-flex items-center gap-2 text-xs text-white/45">
                        {row.mfaEnabled ? <ShieldCheck size={14} className="text-[#10B981]" aria-hidden="true" /> : <Shield size={14} className="text-white/35" aria-hidden="true" />}
                        <span>{row.mfaEnabled ? "MFA enabled" : "MFA disabled"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top sm:px-4">
                    <div className="space-y-1">
                      <p>{getWorkspaceSummary(row)}</p>
                      <p className="text-xs text-white/35">{row.workspaces.length} workspace{row.workspaces.length === 1 ? "" : "s"}</p>
                    </div>
                  </td>
                  <td className="hidden px-3 py-3 align-top text-white/45 lg:table-cell sm:px-4">{formatAdminRelativeTime(row.lastActive)}</td>
                  <td className="hidden px-3 py-3 align-top xl:table-cell sm:px-4">{row.role}</td>
                  <td className="px-3 py-3 align-top sm:px-4">
                    <AdminBadge tone={row.status === "suspended" ? "danger" : row.status === "inactive" ? "warning" : "success"}>
                      {row.status}
                    </AdminBadge>
                  </td>
                  <td className="px-3 py-3 text-right align-top sm:px-4">
                    <div className="flex justify-end">
                      {renderUserActionMenu(row)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableWrapper>
          <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-white/40">{totalRows} users</div>
          <div className="flex items-center gap-2">
            <AdminGhostButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </AdminGhostButton>
            <div className="text-sm text-white/40">Page {page}</div>
            <AdminGhostButton onClick={() => setPage((p) => p + 1)} disabled={totalRows <= page * pageSize}>
              Next
            </AdminGhostButton>
          </div>
          </div>
        </>
      ) : null}

      <Dialog open={bulkAnnouncementOpen} onOpenChange={setBulkAnnouncementOpen}>
        <DialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle>Send announcement to selected users</DialogTitle>
            <DialogDescription className="text-white/45">
              This will publish a platform notification to the {selectedIds.length} selected user{selectedIds.length === 1 ? "" : "s"} across their active workspaces.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={bulkAnnouncement.title}
              onChange={(event) => setBulkAnnouncement((current) => ({ ...current, title: event.target.value }))}
              placeholder="Announcement title"
              className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
            />
            <Textarea
              value={bulkAnnouncement.body}
              onChange={(event) => setBulkAnnouncement((current) => ({ ...current, body: event.target.value }))}
              placeholder="Write the message that selected users should receive..."
              className="min-h-[140px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
            />
            <Select
              value={bulkAnnouncement.type}
              onValueChange={(value) =>
                setBulkAnnouncement((current) => ({
                  ...current,
                  type: value as BulkAnnouncementType,
                }))}
            >
              <SelectTrigger className="border-white/10 bg-[#0F1621] text-white">
                <SelectValue placeholder="Announcement type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="feature">Feature</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setBulkAnnouncementOpen(false)}
              className="border border-white/10 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void publishAnnouncementToSelectedUsers()}
              disabled={!bulkAnnouncement.title.trim() || !bulkAnnouncement.body.trim() || isPublishingAnnouncement}
              className="bg-[#3B82F6] text-white hover:bg-[#2563EB]"
            >
              Publish now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(pendingDeleteUser)} onOpenChange={(open) => !open && !isDeletingUser && setPendingDeleteUser(null)}>
        <AlertDialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this user?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/45">
              {pendingDeleteUser
                ? `You are about to permanently delete ${pendingDeleteUser.fullName ?? pendingDeleteUser.email}. This should only be used for confirmed removals.`
                : "This action permanently removes the selected user."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingDeleteUser ? (
            <div className="rounded-xl border border-white/10 bg-[#0F1621] p-3 text-sm text-white/70">
              <p className="font-medium text-[#F1F5F9]">{pendingDeleteUser.fullName ?? pendingDeleteUser.email}</p>
              <p className="mt-1 text-xs text-white/40">{pendingDeleteUser.email}</p>
              <p className="mt-3 text-xs text-white/45">Workspace: {getWorkspaceSummary(pendingDeleteUser)}</p>
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void deletePendingUser();
              }}
              className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
            >
              {isDeletingUser ? "Deleting..." : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPage;
