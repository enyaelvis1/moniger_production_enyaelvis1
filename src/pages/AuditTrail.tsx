import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CreditCard,
  FileText,
  History,
  Settings,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import AppLayout from "@/components/app/AppLayout";
import { EmptyState } from "@/components/app/EmptyState";
import { FilterControlsSkeleton, TimelineEntriesSkeleton } from "@/components/app/StandalonePageSkeletons";
import { useAuth } from "@/contexts/AuthContext";
import { useOperationsData, type ActivityModule } from "@/hooks/use-operations-data";
import { useSettingsData } from "@/hooks/use-settings-data";
import { getFriendlyErrorMessage } from "@/lib/error-handling";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const moduleConfig: Record<ActivityModule, { bg: string; color: string; icon: LucideIcon }> = {
  Bills: { bg: "bg-[#FEF3F2]", color: "text-[#F97066]", icon: CreditCard },
  Customers: { bg: "bg-[#ECFDF3]", color: "text-[#16A34A]", icon: UserRound },
  Invoices: { bg: "bg-[#EEEDF8]", color: "text-[#5B67F7]", icon: FileText },
  Payments: { bg: "bg-[#F0FDF4]", color: "text-[#16A34A]", icon: TrendingUp },
  System: { bg: "bg-muted", color: "text-muted-foreground", icon: Settings },
  Vendors: { bg: "bg-[#EDE9FE]", color: "text-[#7C3AED]", icon: Building2 },
  Workspace: { bg: "bg-[#FEF9EE]", color: "text-[#F59E0B]", icon: Settings },
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const AuditTrailPage = () => {
  const entriesPerPage = 10;
  const { user } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const operationsQuery = useOperationsData(businessId);

  const [moduleFilter, setModuleFilter] = useState<"All" | ActivityModule>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const hasActiveFilters = moduleFilter !== "All" || Boolean(dateFrom) || Boolean(dateTo);
  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isOperationsLoading = operationsQuery.isLoading && !operationsQuery.data;

  const filteredEntries = useMemo(() => {
    const entries = operationsQuery.data?.auditEntries ?? [];

    return entries.filter((entry) => {
      if (moduleFilter !== "All" && entry.module !== moduleFilter) {
        return false;
      }

      const entryDate = entry.createdAt.slice(0, 10);

      if (dateFrom && entryDate < dateFrom) {
        return false;
      }

      if (dateTo && entryDate > dateTo) {
        return false;
      }

      return true;
    });
  }, [dateFrom, dateTo, moduleFilter, operationsQuery.data?.auditEntries]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, moduleFilter, operationsQuery.data?.auditEntries]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / entriesPerPage));
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * entriesPerPage;
    return filteredEntries.slice(startIndex, startIndex + entriesPerPage);
  }, [currentPage, filteredEntries]);

  const rangeStart = filteredEntries.length === 0 ? 0 : (currentPage - 1) * entriesPerPage + 1;
  const rangeEnd = Math.min(currentPage * entriesPerPage, filteredEntries.length);

  const clearFilters = () => {
    setModuleFilter("All");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <AppLayout>
      <div className="page-enter space-y-6">
        <h2 className="text-2xl font-bold text-primary">Audit Trail</h2>

        {settingsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(settingsQuery.error, "We could not load your workspace.")}
          </div>
        ) : null}

        {operationsQuery.error ? (
          <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(operationsQuery.error, "We could not load your audit trail right now.")}
          </div>
        ) : null}

        {!businessId && !isSettingsLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Your workspace is still being prepared. Audit activity will appear here once the business record is available.
          </div>
        ) : null}

        {isSettingsLoading || isOperationsLoading ? (
          <>
            <FilterControlsSkeleton />
            <TimelineEntriesSkeleton />
          </>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex flex-wrap items-end gap-3 bg-background py-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 w-40 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 w-40 rounded-lg" />
              </div>
              <Select value={moduleFilter} onValueChange={(value) => setModuleFilter(value as "All" | ActivityModule)}>
                <SelectTrigger className="h-9 w-40 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["All", "Invoices", "Bills", "Payments", "Vendors", "Customers", "Workspace", "System"].map((module) => (
                    <SelectItem key={module} value={module}>
                      {module}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              {paginatedEntries.map((entry) => {
                const config = moduleConfig[entry.module];
                const Icon = config.icon;

                return (
                  <div key={entry.id} className="flex items-start gap-4 rounded-xl p-4 transition-colors hover:bg-muted/30">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon size={16} className={config.color} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{entry.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail || entry.module}</p>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0 cursor-default whitespace-nowrap text-xs text-muted-foreground">
                          {entry.relativeTime}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{entry.absoluteTime}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}

              {!isOperationsLoading && filteredEntries.length === 0 ? (
                <EmptyState
                  title={hasActiveFilters ? "No audit activity matches these filters" : "No audit activity yet"}
                  description={
                    hasActiveFilters
                      ? "Try widening the date range or switching back to all modules."
                      : "Invoice, payment, and workspace changes will appear here once your team starts working in the workspace."
                  }
                  icon={History}
                  size="compact"
                  className="bg-muted/20"
                  actions={hasActiveFilters ? [{ label: "Clear filters", onClick: clearFilters, variant: "outline" }] : []}
                />
              ) : null}
            </div>

            {filteredEntries.length > 0 ? (
              <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-medium text-foreground">{rangeStart}</span> to{" "}
                  <span className="font-medium text-foreground">{rangeEnd}</span> of{" "}
                  <span className="font-medium text-foreground">{filteredEntries.length}</span> audit entries
                </p>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="min-w-[88px] text-center text-sm font-medium text-foreground">
                    Page {currentPage} of {totalPages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage === totalPages}
                    className="gap-2"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default AuditTrailPage;
