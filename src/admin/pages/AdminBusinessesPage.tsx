import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Inbox,
  Download,
  Eye,
  MoreVertical,
  Search,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { createExportFileName, downloadCsvFile, downloadJsonFile } from "@/lib/export";
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
  formatAdminCurrency,
  formatAdminDate,
  formatAdminRelativeTime,
} from "@/admin/components/AdminUi";
import { Skeleton } from "@/components/ui/skeleton";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminBusinessDetail,
  type AdminBusinessesResponse,
} from "@/admin/lib/admin-console";
import { validateWorkspaceSplitConfigInput } from "@/lib/workspace-payout-routing-validation";
import {
  useAdminWorkspacePayoutRoutingConfig,
  useAdminWorkspacePayoutRoutingMutations,
} from "@/hooks/use-workspace-payout-routing";

const toneByPlan = {
  business: "info",
  growth: "info",
  starter: "neutral",
} as const;

const toneByStatus = {
  active: "success",
  pending: "warning",
  suspended: "danger",
} as const;

type PendingAction =
  | { businessId: string; businessName: string; type: "delete" }
  | { businessId: string; businessName: string; type: "impersonate" };

type AdminSplitFormState = {
  currency: string;
  flatFeeAmount: string;
  percentageFee: string;
  splitMode: "flat" | "percentage";
};

const formatSplitPercentage = (basisPoints: number | null) =>
  basisPoints === null ? "Not set" : `${(basisPoints / 100).toFixed(Number.isInteger(basisPoints / 100) ? 0 : 2)}%`;

const payoutStatusTone = (status: string | null | undefined): "danger" | "info" | "neutral" | "success" | "warning" => {
  switch (status) {
    case "verified":
    case "ready":
      return "success";
    case "pending_verification":
    case "pending_provider_sync":
      return "warning";
    case "errored":
      return "danger";
    default:
      return "neutral";
  }
};

const payoutStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending_verification":
      return "Pending verification";
    case "pending_provider_sync":
      return "Needs re-sync";
    case "ready":
      return "Ready";
    case "draft":
      return "Draft";
    case "errored":
      return "Needs attention";
    default:
      return "Not configured";
  }
};

const IconButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
  >
    {children}
  </button>
);

const AdminBusinessesPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [plan, setPlan] = useState("all");
  const [joined, setJoined] = useState("all");
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [selectedBusinessIds, setSelectedBusinessIds] = useState<string[]>([]);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const deferredSearch = useDeferredValue(search);
  const [payoutApprovalThreshold, setPayoutApprovalThreshold] = useState("");
  const [payoutLimitPerTransaction, setPayoutLimitPerTransaction] = useState("");
  const [payoutLimitDaily, setPayoutLimitDaily] = useState("");
  const [payoutLimitWeekly, setPayoutLimitWeekly] = useState("");
  const queryPayload = useMemo(
    () => ({
      joined,
      plan,
      search: deferredSearch,
      status,
    }),
    [deferredSearch, joined, plan, status],
  );
  const businessesQuery = useAdminConsoleQuery<AdminBusinessesResponse>("businesses.list", queryPayload);
  const detailQuery = useAdminConsoleQuery<AdminBusinessDetail>(
    "businesses.detail",
    { businessId: selectedBusinessId },
    Boolean(selectedBusinessId),
  );
  const adminPayoutRoutingQuery = useAdminWorkspacePayoutRoutingConfig(selectedBusinessId ?? undefined);
  const adminPayoutRoutingMutations = useAdminWorkspacePayoutRoutingMutations(selectedBusinessId ?? undefined);
  const businessesErrorMessage = businessesQuery.error instanceof Error
    ? businessesQuery.error.message
    : "The admin businesses query failed. Check the admin-console edge function and its environment variables.";
  const businessRows = businessesQuery.data?.rows ?? [];
  const allBusinessesSelected = businessRows.length > 0 && businessRows.every((business) => selectedBusinessIds.includes(business.businessId));
  const [adminSplitForm, setAdminSplitForm] = useState<AdminSplitFormState>({
    currency: "NGN",
    flatFeeAmount: "",
    percentageFee: "",
    splitMode: "percentage",
  });

  useEffect(() => {
    const splitConfig = adminPayoutRoutingQuery.data?.splitConfig;

    setAdminSplitForm({
      currency: splitConfig?.currency ?? adminPayoutRoutingQuery.data?.payoutAccount?.currency ?? "NGN",
      flatFeeAmount: splitConfig?.splitMode === "flat" ? String(splitConfig.monigerFeeFlatAmount ?? "") : "",
      percentageFee: splitConfig?.splitMode === "percentage" && splitConfig.monigerFeePercentageBasisPoints !== null
        ? String(splitConfig.monigerFeePercentageBasisPoints / 100)
        : "",
      splitMode: splitConfig?.splitMode ?? "percentage",
    });
  }, [
    adminPayoutRoutingQuery.data?.payoutAccount?.currency,
    adminPayoutRoutingQuery.data?.splitConfig,
  ]);

  useEffect(() => {
    if (!detailQuery.data?.business) {
      return;
    }

    setPayoutApprovalThreshold(
      detailQuery.data.business.payoutApprovalThresholdAmount > 0
        ? String(detailQuery.data.business.payoutApprovalThresholdAmount)
        : "",
    );
    setPayoutLimitPerTransaction(
      detailQuery.data.business.payoutLimitPerTransactionAmount > 0
        ? String(detailQuery.data.business.payoutLimitPerTransactionAmount)
        : "",
    );
    setPayoutLimitDaily(
      detailQuery.data.business.payoutLimitDailyAmount > 0
        ? String(detailQuery.data.business.payoutLimitDailyAmount)
        : "",
    );
    setPayoutLimitWeekly(
      detailQuery.data.business.payoutLimitWeeklyAmount > 0
        ? String(detailQuery.data.business.payoutLimitWeeklyAmount)
        : "",
    );
  }, [detailQuery.data?.business]);

  const handleBusinessAction = async (businessId: string, type: string, message?: string, payload?: Record<string, unknown>) => {
    try {
      const result = await invokeAdminConsole<{ launchUrl?: string; ok?: boolean }>("businesses.action", {
        businessId,
        message,
        ...payload,
        type,
      });
      await businessesQuery.refetch();
      await detailQuery.refetch();

      if (type === "impersonate" && result.launchUrl) {
        window.open(result.launchUrl, "_blank", "noopener,noreferrer");
      }

      toast({
        title: "Business updated",
        description: `The ${type.replace(/_/g, " ")} action completed.`,
      });
    } catch (error) {
      toast({
        title: "Action failed",
        description: error instanceof Error ? error.message : "Unable to complete this business action.",
        variant: "destructive",
      });
    } finally {
      setPendingAction(null);
    }
  };

  const runBulkBusinessAction = async (type: "suspend" | "unsuspend") => {
    if (selectedBusinessIds.length === 0) return;
    try {
      await Promise.all(selectedBusinessIds.map((businessId) => invokeAdminConsole("businesses.action", { businessId, type })));
      await businessesQuery.refetch();
      setSelectedBusinessIds([]);
      toast({ title: "Businesses updated", description: `${selectedBusinessIds.length} workspaces were ${type === "suspend" ? "suspended" : "restored"}.` });
    } catch (error) {
      toast({ title: "Bulk action failed", description: error instanceof Error ? error.message : "Unable to update the selected businesses.", variant: "destructive" });
    }
  };

  const markSelectedAsTestData = async () => {
    if (selectedBusinessIds.length === 0) return;
    const reason = window.prompt("Reason for marking these QA workspaces as test data (at least 10 characters):", "Prepare QA workspace cleanup")?.trim() ?? "";
    const confirmation = `MARK ${selectedBusinessIds.length} BUSINESSES AS TEST`;
    if (reason.length < 10 || window.prompt(`Type exactly: ${confirmation}`)?.trim() !== confirmation) return;
    try {
      await invokeAdminConsole("testData.mark", { businessIds: selectedBusinessIds, confirmation, reason });
      await businessesQuery.refetch();
      setSelectedBusinessIds([]);
      toast({ title: "QA data marked", description: "The eligible QA workspaces and linked records are now marked as test data." });
    } catch (error) {
      toast({ title: "Marking blocked", description: error instanceof Error ? error.message : "Only clearly identified QA/test workspaces can be marked.", variant: "destructive" });
    }
  };

  const handleSplitRuleSave = async (syncProvider: boolean) => {
    if (!selectedBusinessId) {
      return;
    }

    const normalizedCurrency = adminSplitForm.currency.trim().toUpperCase() || "NGN";

    if (adminSplitForm.splitMode === "percentage") {
      const validation = validateWorkspaceSplitConfigInput({
        currency: normalizedCurrency,
        percentageFee: Number(adminSplitForm.percentageFee),
        splitMode: "percentage",
        syncProvider,
      });

      if (!validation.ok) {
        toast({
          title: validation.error.title,
          description: validation.error.description,
          variant: "destructive",
        });
        return;
      }

      try {
        const result = await adminPayoutRoutingMutations.upsertSplitConfig.mutateAsync({
          currency: validation.normalized.currency,
          monigerFeePercentageBasisPoints: validation.normalized.basisPoints,
          splitMode: "percentage",
          syncProvider,
        });

        toast({
          title: result.sync?.status === "failed" ? "Fee rule saved with sync issue" : "Fee rule updated",
          description:
            result.sync?.message ??
            (syncProvider ? "The Moniger fee rule was synced with Paystack." : "The Moniger fee rule draft was saved."),
          variant: result.sync?.status === "failed" ? "destructive" : "default",
        });
      } catch (error) {
        toast({
          title: "Unable to save fee rule",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      }

      return;
    }

    const validation = validateWorkspaceSplitConfigInput({
      currency: normalizedCurrency,
      flatFeeAmount: Number(adminSplitForm.flatFeeAmount),
      splitMode: "flat",
      syncProvider,
    });

    if (!validation.ok) {
      toast({
        title: validation.error.title,
        description: validation.error.description,
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await adminPayoutRoutingMutations.upsertSplitConfig.mutateAsync({
        currency: validation.normalized.currency,
        monigerFeeFlatAmount: validation.normalized.flatFeeAmount,
        splitMode: "flat",
        syncProvider,
      });

      toast({
        title: result.sync?.status === "failed" ? "Fee rule saved with sync issue" : "Fee rule updated",
        description:
          result.sync?.message ??
          (syncProvider ? "The Moniger fee rule was saved." : "The Moniger fee rule draft was saved."),
        variant: result.sync?.status === "failed" ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "Unable to save fee rule",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportCsv = () => {
    downloadCsvFile({
      columns: [
        { header: "Business", value: (row) => row.businessName },
        { header: "Owner Email", value: (row) => row.ownerEmail },
        { header: "Plan", value: (row) => row.plan },
        { header: "Users", value: (row) => row.memberCount },
        { header: "Invoices", value: (row) => row.invoiceCount },
        { header: "Joined", value: (row) => row.createdAt },
        { header: "Status", value: (row) => row.status },
      ],
      filename: `${createExportFileName("admin-businesses")}.csv`,
      rows: businessesQuery.data?.rows ?? [],
    });
  };

  const exportBusinessData = async (businessId: string, businessName: string) => {
    const payload = await invokeAdminConsole<Record<string, unknown>>("businesses.export", { businessId });
    downloadJsonFile({
      data: payload,
      filename: `${createExportFileName(`${businessName}-export`)}.json`,
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Businesses"
        subtitle="Platform-wide workspace management with cross-business visibility."
        action={(
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <AdminBadge tone="neutral">{businessesQuery.data?.total ?? 0} businesses</AdminBadge>
            <AdminGhostButton onClick={handleExportCsv}>
              <Download size={14} aria-hidden="true" />
              Export CSV
            </AdminGhostButton>
            {selectedBusinessIds.length > 0 ? (
              <>
                <AdminGhostButton onClick={() => void runBulkBusinessAction("suspend")}>
                  <ShieldAlert size={14} aria-hidden="true" /> Suspend selected
                </AdminGhostButton>
                <AdminGhostButton onClick={() => void runBulkBusinessAction("unsuspend")}>Restore selected</AdminGhostButton>
                <AdminGhostButton onClick={() => void markSelectedAsTestData()}>Mark selected as test</AdminGhostButton>
              </>
            ) : null}
          </div>
        )}
      />

      <AdminToolbar className="flex-wrap">
        <label className="flex items-center gap-2 text-xs text-white/60">
          <Checkbox
            checked={allBusinessesSelected}
            onCheckedChange={(checked) => setSelectedBusinessIds(checked === true ? businessRows.map((business) => business.businessId) : [])}
            aria-label="Select all visible businesses"
          />
          Select all visible ({selectedBusinessIds.length} selected)
        </label>
        <div className="relative w-full flex-1 sm:min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search business name, owner email, or ID"
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
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
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
        <Select value={joined} onValueChange={setJoined}>
          <SelectTrigger className="h-10 w-full border-white/10 bg-[#0F1621] text-sm text-white sm:h-11 sm:w-[160px]">
            <SelectValue placeholder="Joined" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="this month">This month</SelectItem>
            <SelectItem value="last month">Last month</SelectItem>
          </SelectContent>
        </Select>
      </AdminToolbar>

      {businessesQuery.error ? (
        <AdminSectionCard title="Unable to Load Businesses">
          <p className="text-sm text-[#FCA5A5]">{businessesErrorMessage}</p>
          <p className="mt-2 text-sm text-white/45">
            This usually means the `admin-console` edge function is not deployed, is missing server secrets, or cannot read the required tables.
          </p>
        </AdminSectionCard>
      ) : null}

      {!businessesQuery.error && (businessesQuery.data?.rows?.length ?? 0) === 0 ? (
        <AdminSectionCard title="No Businesses Yet">
          <AdminEmpty
            title="No businesses available"
            description="Create a business workspace or use an isolated QA workspace with clearly marked sample records before testing admin workflows."
            icon={Inbox}
          />
        </AdminSectionCard>
      ) : null}

      {businessesQuery.isLoading ? (
        isMobile ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-[#161E2E] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32 mt-1" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-28 mt-3" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Skeleton className="h-6 w-20" />
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="mt-3">
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <AdminTableSkeleton columns={7} rows={8} />
        )
      ) : !businessesQuery.error && (businessesQuery.data?.rows?.length ?? 0) > 0 && isMobile ? (
        <div className="space-y-2.5">
          {(businessesQuery.data?.rows ?? []).map((business) => (
            <div key={business.businessId} className="rounded-xl border border-white/5 bg-[#161E2E] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Checkbox
                    checked={selectedBusinessIds.includes(business.businessId)}
                    onCheckedChange={(checked) => setSelectedBusinessIds((current) => checked === true ? [...new Set([...current, business.businessId])] : current.filter((id) => id !== business.businessId))}
                    aria-label={`Select ${business.businessName}`}
                    className="mb-2"
                  />
                  <p className="text-sm font-semibold text-[#F1F5F9]">{business.businessName}</p>
                  <p className="mt-1 text-xs text-white/35">{business.ownerEmail}</p>
                </div>
                <AdminBadge tone={toneByStatus[business.status]}>{business.status}</AdminBadge>
              </div>
              <p className="mt-2 text-xs text-white/40">Joined {formatAdminDate(business.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <AdminBadge tone={toneByPlan[business.plan]}>{business.plan}</AdminBadge>
                <AdminBadge tone="neutral">{business.memberCount} users</AdminBadge>
                <AdminBadge tone="neutral">{business.invoiceCount} invoices</AdminBadge>
              </div>
              <div className="mt-3">
                <AdminGhostButton className="w-full justify-center" onClick={() => setSelectedBusinessId(business.businessId)}>
                  View details
                </AdminGhostButton>
              </div>
            </div>
          ))}
        </div>
      ) : !businessesQuery.error && (businessesQuery.data?.rows?.length ?? 0) > 0 ? (
        <AdminTableWrapper>
          <table className="min-w-full text-left text-sm text-white/70">
            <AdminTableHead>
              <tr>
                <th className="w-10 px-3 py-2.5 sm:px-4"><span className="sr-only">Select</span></th>
                <th className="px-3 py-2.5 sm:px-4">Business</th>
                <th className="px-3 py-2.5 sm:px-4">Plan</th>
                <th className="px-3 py-2.5 sm:px-4">Users</th>
                <th className="hidden px-3 py-2.5 lg:table-cell sm:px-4">Invoices</th>
                <th className="hidden px-3 py-2.5 xl:table-cell sm:px-4">Joined</th>
                <th className="px-3 py-2.5 sm:px-4">Status</th>
                <th className="px-3 py-2.5 text-right sm:px-4">Actions</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {(businessesQuery.data?.rows ?? []).map((business) => (
                <tr key={business.businessId} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-3 py-3 sm:px-4">
                    <Checkbox
                      checked={selectedBusinessIds.includes(business.businessId)}
                      onCheckedChange={(checked) => setSelectedBusinessIds((current) => checked === true ? [...new Set([...current, business.businessId])] : current.filter((id) => id !== business.businessId))}
                      aria-label={`Select ${business.businessName}`}
                    />
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <button type="button" onClick={() => setSelectedBusinessId(business.businessId)} className="flex items-center gap-3 text-left">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3B82F6,#8B5CF6)] text-[10px] font-semibold text-white sm:h-9 sm:w-9 sm:text-xs">
                        {business.businessName.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-[#F1F5F9]">{business.businessName}</p>
                        <p className="text-xs text-white/40">{business.ownerEmail}</p>
                        <p className="font-mono text-[10px] text-white/30">{business.businessId}</p>
                      </div>
                    </button>
                  </td>
                  <td className="px-3 py-3 sm:px-4"><AdminBadge tone={toneByPlan[business.plan]}>{business.plan}</AdminBadge></td>
                  <td className="px-3 py-3 sm:px-4">{business.memberCount}</td>
                  <td className="hidden px-3 py-3 lg:table-cell sm:px-4">{business.invoiceCount}</td>
                  <td className="hidden px-3 py-3 text-white/45 xl:table-cell sm:px-4">{formatAdminDate(business.createdAt)}</td>
                  <td className="px-3 py-3 sm:px-4"><AdminBadge tone={toneByStatus[business.status]}>{business.status}</AdminBadge></td>
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex items-center gap-2">
                      <IconButton onClick={() => setSelectedBusinessId(business.businessId)}>
                        <Eye size={14} aria-hidden="true" />
                      </IconButton>
                      <IconButton onClick={() => setPendingAction({ businessId: business.businessId, businessName: business.businessName, type: "impersonate" })}>
                        <UserCheck size={14} aria-hidden="true" />
                      </IconButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${business.businessName}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                          >
                            <MoreVertical size={14} aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => void handleBusinessAction(business.businessId, business.status === "suspended" ? "unsuspend" : "suspend")}>
                            {business.status === "suspended" ? "Unsuspend account" : "Suspend account"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const message = window.prompt(`Send a notice to ${business.businessName}:`, "We are reviewing your workspace.");
                              if (message) {
                                void handleBusinessAction(business.businessId, "send_notice", message);
                              }
                            }}
                          >
                            Send notice
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => void exportBusinessData(business.businessId, business.businessName)}>
                            Export business data
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-400" onClick={() => setPendingAction({ businessId: business.businessId, businessName: business.businessName, type: "delete" })}>
                            Delete account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableWrapper>
      ) : null}

      <Sheet open={Boolean(selectedBusinessId)} onOpenChange={(open) => !open && setSelectedBusinessId(null)}>
        <SheetContent className="w-full overflow-y-auto border-white/10 bg-[#161E2E] text-[#F1F5F9] sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle className="text-[#F1F5F9]">{detailQuery.data?.business.businessName ?? "Business"}</SheetTitle>
            <SheetDescription className="text-white/40">
              {detailQuery.data?.business.businessId ?? "Loading business details..."}
            </SheetDescription>
          </SheetHeader>

          {detailQuery.isLoading ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <AdminSectionCard title="Invoices" className="p-4">
                  <Skeleton className="h-6 w-20" />
                </AdminSectionCard>
                <AdminSectionCard title="Bills" className="p-4">
                  <Skeleton className="h-6 w-20" />
                </AdminSectionCard>
                <AdminSectionCard title="Payments" className="p-4">
                  <Skeleton className="h-6 w-32" />
                </AdminSectionCard>
              </div>

              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32 mt-2" />
                    <Skeleton className="h-3 w-full mt-3" />
                  </div>
                ))}
              </div>
            </div>
          ) : detailQuery.data ? (
            <div className="mt-6 space-y-5">
              <div className="flex flex-wrap gap-2">
                <AdminBadge tone={toneByStatus[detailQuery.data.business.status]}>{detailQuery.data.business.status}</AdminBadge>
                <AdminBadge tone={toneByPlan[detailQuery.data.business.plan]}>{detailQuery.data.business.plan}</AdminBadge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <AdminSectionCard title="Invoices" className="p-4">
                  <p className="text-xl font-semibold">{detailQuery.data.stats.totalInvoices}</p>
                </AdminSectionCard>
                <AdminSectionCard title="Bills" className="p-4">
                  <p className="text-xl font-semibold">{detailQuery.data.stats.totalBills}</p>
                </AdminSectionCard>
                <AdminSectionCard title="Payments" className="p-4">
                  <p className="text-xl font-semibold">{formatAdminCurrency(detailQuery.data.stats.totalPaymentsProcessed)}</p>
                </AdminSectionCard>
              </div>

              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-[#0F1621] p-1 sm:grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="payout">Payout</TabsTrigger>
                  <TabsTrigger value="invoices">Invoices</TabsTrigger>
                  <TabsTrigger value="users">Users</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-4 space-y-3 text-sm text-white/70">
                  <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <p><span className="text-white/35">Email:</span> {detailQuery.data.business.email ?? "Not provided"}</p>
                    <p className="mt-2"><span className="text-white/35">Phone:</span> {detailQuery.data.business.phone ?? "Not provided"}</p>
                    <p className="mt-2"><span className="text-white/35">Address:</span> {detailQuery.data.business.address ?? "Not provided"}</p>
                    <p className="mt-2"><span className="text-white/35">Owner:</span> {detailQuery.data.business.ownerName ?? "Unknown"} · {detailQuery.data.business.ownerEmail}</p>
                  </div>
                </TabsContent>

                <TabsContent value="payout" className="mt-4 space-y-4 text-sm text-white/70">
                  <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="flex items-center gap-2 font-medium text-[#F1F5F9]">
                          <UserCheck size={14} aria-hidden="true" />
                          Payout controls
                        </p>
                        <p className="mt-1 text-white/40">
                          Freeze outgoing payouts when a workspace needs a temporary hold. Funding can still continue, but `Pay now`
                          and scheduled payouts are blocked until the hold is lifted.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminBadge tone={detailQuery.data.business.payoutsFrozen ? "danger" : "success"}>
                          {detailQuery.data.business.payoutsFrozen ? "Payouts frozen" : "Payouts active"}
                        </AdminBadge>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          onClick={() =>
                            void handleBusinessAction(
                              detailQuery.data.business.businessId,
                              detailQuery.data.business.payoutsFrozen ? "unfreeze_payouts" : "freeze_payouts",
                            )
                          }
                        >
                          {detailQuery.data.business.payoutsFrozen ? "Unfreeze payouts" : "Freeze payouts"}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-[#F1F5F9]">Payout approval threshold</p>
                        <p className="text-white/40">
                          Payouts above this amount require approval before they submit to the provider. Set it to `0` or leave it blank to disable the rule.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="space-y-1">
                          <Label htmlFor="payout-approval-threshold" className="text-white/60">
                            Threshold amount
                          </Label>
                          <Input
                            id="payout-approval-threshold"
                            type="number"
                            min="0"
                            step="0.01"
                            value={payoutApprovalThreshold}
                            onChange={(event) => setPayoutApprovalThreshold(event.target.value)}
                            placeholder="200000"
                            className="border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                          onClick={() =>
                            void handleBusinessAction(
                              detailQuery.data.business.businessId,
                              "set_payout_threshold",
                              undefined,
                              {
                                thresholdAmount: payoutApprovalThreshold.trim() ? Number(payoutApprovalThreshold) : 0,
                              },
                            )
                          }
                        >
                          Save threshold
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-white/35">
                      Current threshold:{" "}
                      {detailQuery.data.business.payoutApprovalThresholdAmount > 0
                        ? formatAdminCurrency(detailQuery.data.business.payoutApprovalThresholdAmount)
                        : "Disabled"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <div className="space-y-1">
                      <p className="font-medium text-[#F1F5F9]">Workspace payout limits</p>
                      <p className="text-white/40">
                        These limits cap how much can be initiated per payout, per day, and per week.
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-3">
                      <div className="space-y-1">
                        <Label htmlFor="payout-limit-per-transaction" className="text-white/60">
                          Per transaction
                        </Label>
                        <Input
                          id="payout-limit-per-transaction"
                          type="number"
                          min="0"
                          step="0.01"
                          value={payoutLimitPerTransaction}
                          onChange={(event) => setPayoutLimitPerTransaction(event.target.value)}
                          placeholder="500000"
                          className="border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="payout-limit-daily" className="text-white/60">
                          Daily total
                        </Label>
                        <Input
                          id="payout-limit-daily"
                          type="number"
                          min="0"
                          step="0.01"
                          value={payoutLimitDaily}
                          onChange={(event) => setPayoutLimitDaily(event.target.value)}
                          placeholder="1000000"
                          className="border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="payout-limit-weekly" className="text-white/60">
                          Weekly total
                        </Label>
                        <Input
                          id="payout-limit-weekly"
                          type="number"
                          min="0"
                          step="0.01"
                          value={payoutLimitWeekly}
                          onChange={(event) => setPayoutLimitWeekly(event.target.value)}
                          placeholder="5000000"
                          className="border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-white/35">
                        Current limits:{" "}
                        {detailQuery.data.business.payoutLimitPerTransactionAmount > 0
                          ? `Per txn ${formatAdminCurrency(detailQuery.data.business.payoutLimitPerTransactionAmount)}`
                          : "Per txn disabled"}
                        {" · "}
                        {detailQuery.data.business.payoutLimitDailyAmount > 0
                          ? `Daily ${formatAdminCurrency(detailQuery.data.business.payoutLimitDailyAmount)}`
                          : "Daily disabled"}
                        {" · "}
                        {detailQuery.data.business.payoutLimitWeeklyAmount > 0
                          ? `Weekly ${formatAdminCurrency(detailQuery.data.business.payoutLimitWeeklyAmount)}`
                          : "Weekly disabled"}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() =>
                          void handleBusinessAction(
                            detailQuery.data.business.businessId,
                            "set_payout_limits",
                            undefined,
                            {
                              dailyAmount: payoutLimitDaily.trim() ? Number(payoutLimitDaily) : 0,
                              perTransactionAmount: payoutLimitPerTransaction.trim() ? Number(payoutLimitPerTransaction) : 0,
                              weeklyAmount: payoutLimitWeekly.trim() ? Number(payoutLimitWeekly) : 0,
                            },
                          )
                        }
                      >
                        Save limits
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-medium text-[#F1F5F9]">
                          <ArrowRightLeft size={14} aria-hidden="true" />
                          Moniger fee rule
                        </p>
                        <p className="mt-1 text-white/40">
                          Platform admins control how much Moniger keeps before the subscriber share routes to the workspace payout account.
                        </p>
                      </div>
                      <AdminBadge tone={payoutStatusTone(adminPayoutRoutingQuery.data?.splitConfig?.status)}>
                        {payoutStatusLabel(adminPayoutRoutingQuery.data?.splitConfig?.status)}
                      </AdminBadge>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                      <p className="text-xs uppercase tracking-wide text-white/35">Workspace payout bank</p>
                      <p className="mt-2 font-medium text-[#F1F5F9]">
                        {adminPayoutRoutingQuery.data?.payoutAccount?.bankName ?? "Not configured by workspace"}
                      </p>
                      <p className="mt-1 text-white/40">
                        {adminPayoutRoutingQuery.data?.payoutAccount?.providerSubaccountCode ?? "No Paystack subaccount yet"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                      <p className="text-xs uppercase tracking-wide text-white/35">Current fee rule</p>
                      <p className="mt-2 font-medium text-[#F1F5F9]">
                        {adminPayoutRoutingQuery.data?.splitConfig?.splitMode === "percentage"
                          ? formatSplitPercentage(adminPayoutRoutingQuery.data.splitConfig.monigerFeePercentageBasisPoints)
                          : adminPayoutRoutingQuery.data?.splitConfig?.splitMode === "flat"
                            ? `${adminPayoutRoutingQuery.data.splitConfig.currency} ${adminPayoutRoutingQuery.data.splitConfig.monigerFeeFlatAmount.toFixed(2)}`
                            : "Not configured"}
                      </p>
                      <p className="mt-1 text-white/40">
                        {adminPayoutRoutingQuery.data?.splitConfig?.splitMode === "flat"
                          ? "Flat fee retained by Moniger"
                          : adminPayoutRoutingQuery.data?.splitConfig?.splitMode === "percentage"
                            ? "Percentage retained by Moniger"
                            : "Choose a fee mode below"}
                      </p>
                    </div>
                  </div>

                  {adminPayoutRoutingQuery.data?.payoutAccount?.lastSyncError ? (
                    <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 p-4 text-[#FCA5A5]">
                      {adminPayoutRoutingQuery.data.payoutAccount.lastSyncError}
                    </div>
                  ) : null}

                  {adminPayoutRoutingQuery.data?.splitConfig?.status === "pending_provider_sync" ? (
                    <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-4 text-[#FCD34D]">
                      The workspace payout destination changed after this fee rule was configured. Re-save the fee rule below to re-sync Paystack routing before new invoice checkout uses the updated bank account.
                    </div>
                  ) : null}

                  {adminPayoutRoutingQuery.data?.splitConfig?.lastSyncError ? (
                    <div className="rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 p-4 text-[#FCA5A5]">
                      {adminPayoutRoutingQuery.data.splitConfig.lastSyncError}
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label className="text-white/80">Fee Mode</Label>
                        <Select
                          value={adminSplitForm.splitMode}
                          onValueChange={(value) =>
                            setAdminSplitForm((current) => ({
                              ...current,
                              splitMode: value as "flat" | "percentage",
                            }))
                          }
                          disabled={adminPayoutRoutingMutations.upsertSplitConfig.isPending}
                        >
                          <SelectTrigger className="mt-2 border-white/10 bg-[#111927] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="flat">Flat fee</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="admin-routing-currency" className="text-white/80">Routing Currency</Label>
                        <Input
                          id="admin-routing-currency"
                          value={adminSplitForm.currency}
                          onChange={(event) =>
                            setAdminSplitForm((current) => ({
                              ...current,
                              currency: event.target.value.toUpperCase(),
                            }))
                          }
                          maxLength={3}
                          className="mt-2 border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                          disabled={adminPayoutRoutingMutations.upsertSplitConfig.isPending}
                        />
                      </div>
                    </div>

                    {adminSplitForm.splitMode === "percentage" ? (
                      <div className="mt-4">
                        <Label htmlFor="admin-split-percentage" className="text-white/80">Moniger Fee Percentage</Label>
                        <Input
                          id="admin-split-percentage"
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={adminSplitForm.percentageFee}
                          onChange={(event) =>
                            setAdminSplitForm((current) => ({
                              ...current,
                              percentageFee: event.target.value,
                            }))
                          }
                          placeholder="15"
                          className="mt-2 border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                          disabled={adminPayoutRoutingMutations.upsertSplitConfig.isPending}
                        />
                        <p className="mt-2 text-xs text-white/40">
                          Use whole percentages like 5, 10, or 15 when syncing directly to Paystack.
                        </p>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <Label htmlFor="admin-split-flat" className="text-white/80">Moniger Flat Fee</Label>
                        <Input
                          id="admin-split-flat"
                          type="number"
                          min={0}
                          step={0.01}
                          value={adminSplitForm.flatFeeAmount}
                          onChange={(event) =>
                            setAdminSplitForm((current) => ({
                              ...current,
                              flatFeeAmount: event.target.value,
                            }))
                          }
                          placeholder="500"
                          className="mt-2 border-white/10 bg-[#111927] text-white placeholder:text-white/30"
                          disabled={adminPayoutRoutingMutations.upsertSplitConfig.isPending}
                        />
                        <p className="mt-2 text-xs text-white/40">
                          Flat mode uses Paystack&apos;s transaction charge override during checkout initialization.
                        </p>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap justify-end gap-2">
                      <Button
                        variant="ghost"
                        className="border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={() => void handleSplitRuleSave(false)}
                        disabled={adminPayoutRoutingMutations.upsertSplitConfig.isPending}
                      >
                        Save Draft
                      </Button>
                      <Button
                        className="bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                        onClick={() => void handleSplitRuleSave(true)}
                        disabled={adminPayoutRoutingMutations.upsertSplitConfig.isPending}
                      >
                        Save & Sync Paystack
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="invoices" className="mt-4 space-y-2">
                  {detailQuery.data.invoices.map((invoice) => (
                    <div key={invoice.invoiceId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-[#F1F5F9]">{invoice.invoiceNumber}</p>
                          <p className="text-white/35">{invoice.customerName}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-[#F1F5F9]">{formatAdminCurrency(invoice.amount)}</p>
                          <p className="text-white/35 capitalize">{invoice.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    className="w-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    onClick={() => detailQuery.data && navigate(`/admin/businesses/${detailQuery.data.business.businessId}/invoices`)}
                  >
                    View all invoices
                  </Button>
                </TabsContent>

                <TabsContent value="users" className="mt-4 space-y-2">
                  {detailQuery.data.members.map((member) => (
                    <div key={member.membershipId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4 text-sm">
                      <p className="font-medium text-[#F1F5F9]">{member.fullName ?? member.email}</p>
                      <p className="text-white/35">{member.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <AdminBadge tone="neutral">{member.role}</AdminBadge>
                        <AdminBadge tone={member.status === "active" ? "success" : "warning"}>{member.status}</AdminBadge>
                        <AdminBadge tone="neutral">Last active {formatAdminRelativeTime(member.lastActive)}</AdminBadge>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="activity" className="mt-4 space-y-2">
                  {detailQuery.data.activity.map((entry) => (
                    <div key={`${entry.id}`} className="rounded-xl border border-white/5 bg-[#0F1621] p-4 text-sm">
                      <p className="font-medium text-[#F1F5F9]">{entry.summary}</p>
                      <p className="mt-1 text-white/35">{entry.action}</p>
                      <p className="mt-2 text-xs text-white/30">{formatAdminRelativeTime(entry.createdAt)}</p>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(pendingAction)} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent className="border-white/10 bg-[#161E2E] text-[#F1F5F9]">
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "impersonate" ? "Impersonate this workspace?" : "Delete business account?"}
            </DialogTitle>
            <DialogDescription className="text-white/45">
              {pendingAction?.type === "impersonate"
                ? `You will be signed in as ${pendingAction.businessName} in a new tab. All actions you take will be logged under your admin account. This session expires in 30 minutes.`
                : `This will permanently delete ${pendingAction?.businessName}. This action is destructive and should only be used for confirmed removals.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingAction(null)} className="border border-white/10 bg-white/5 text-white hover:bg-white/10">
              Cancel
            </Button>
            {pendingAction ? (
              <Button
                onClick={() => void handleBusinessAction(pendingAction.businessId, pendingAction.type)}
                className={pendingAction.type === "delete" ? "bg-[#EF4444] hover:bg-[#DC2626]" : "bg-[#3B82F6] hover:bg-[#2563EB]"}
              >
                {pendingAction.type === "impersonate" ? "Open as this workspace" : "Delete account"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBusinessesPage;
