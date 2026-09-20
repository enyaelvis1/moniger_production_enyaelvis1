import { useMemo } from "react";
import { format } from "date-fns";
import {
  Activity,
  ArrowLeftRight,
  Building2,
  FileText,
  RefreshCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useAdminConsoleQuery, type AdminOverviewResponse } from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminMetricCard,
  AdminPageHeader,
  AdminSectionCard,
  formatAdminCurrency,
  formatAdminNumber,
  formatAdminRelativeTime,
} from "@/admin/components/AdminUi";
import { Skeleton } from "@/components/ui/skeleton";

const metricIconClassName = "flex h-9 w-9 items-center justify-center rounded-lg";

const AdminDashboardPage = () => {
  const overviewQuery = useAdminConsoleQuery<AdminOverviewResponse>("overview");
  const overview = overviewQuery.data;
  const pageSubtitle = useMemo(() => {
    const today = format(new Date(), "EEEE, MMMM d");
    return `${today} · Last updated just now`;
  }, []);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Overview"
        subtitle={pageSubtitle}
        action={(
          <Button
            variant="ghost"
            onClick={() => void overviewQuery.refetch()}
            className="h-9 rounded-lg border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <RefreshCcw size={14} aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      {overviewQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <AdminSectionCard key={i} title=" ">
              <div className="space-y-3">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-10 w-36" />
              </div>
            </AdminSectionCard>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <AdminMetricCard
            accent={<AdminBadge tone="success">+{overview?.metrics.totalBusinesses.monthlyDelta ?? 0} this month</AdminBadge>}
            icon={(
              <div className={`${metricIconClassName} bg-[#3B82F6]/12 text-[#3B82F6]`}>
                <Building2 size={16} aria-hidden="true" />
              </div>
            )}
            label="Total Businesses"
            sublabel="Platform workspaces"
            value={formatAdminNumber(overview?.metrics.totalBusinesses.value ?? 0)}
          />
          <AdminMetricCard
            accent={<AdminBadge tone="success">{overview?.metrics.activeUsers.changePct ?? 0}% vs previous 30d</AdminBadge>}
            icon={(
              <div className={`${metricIconClassName} bg-[#10B981]/12 text-[#10B981]`}>
                <Users size={16} aria-hidden="true" />
              </div>
            )}
            label="Active Users"
            sublabel="Accounts created in the last 30 days"
            value={formatAdminNumber(overview?.metrics.activeUsers.value ?? 0)}
          />
          <AdminMetricCard
            accent={<AdminBadge tone="info">Across all workspaces</AdminBadge>}
            icon={(
              <div className={`${metricIconClassName} bg-[#3B82F6]/12 text-[#3B82F6]`}>
                <FileText size={16} aria-hidden="true" />
              </div>
            )}
            label="Total Invoices"
            sublabel="Across all workspaces"
            value={formatAdminNumber(overview?.metrics.totalInvoices ?? 0)}
          />
          <AdminMetricCard
            accent={<AdminBadge tone="success">All time</AdminBadge>}
            icon={(
              <div className={`${metricIconClassName} bg-[#10B981]/12 text-[#10B981]`}>
                <ArrowLeftRight size={16} aria-hidden="true" />
              </div>
            )}
            label="Payments Processed"
            sublabel="Confirmed platform-wide volume"
            value={formatAdminCurrency(overview?.metrics.totalPaymentsProcessed ?? 0)}
          />
          <AdminMetricCard
            accent={<AdminBadge tone="info">Recurring revenue</AdminBadge>}
            icon={(
              <div className={`${metricIconClassName} bg-[#F59E0B]/12 text-[#F59E0B]`}>
                <TrendingUp size={16} aria-hidden="true" />
              </div>
            )}
            label="Monthly Revenue"
            sublabel="Current managed subscription run-rate"
            value={formatAdminCurrency(overview?.metrics.platformRevenueThisMonth ?? 0)}
          />
          <AdminMetricCard
            accent={<AdminBadge tone={overview?.health.allSystemsOperational ? "success" : "warning"}>All systems operational</AdminBadge>}
            icon={(
              <div className={`${metricIconClassName} bg-[#10B981]/12 text-[#10B981]`}>
                <Activity size={16} aria-hidden="true" />
              </div>
            )}
            label="Platform Uptime"
            sublabel="Last 30 days"
            value={overview?.metrics.platformUptime ?? "100.0%"}
          />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <AdminSectionCard title="New Registrations">
          {overviewQuery.isLoading ? (
            <div className="h-[220px]"><Skeleton className="h-full w-full" /></div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overview?.recentRegistrations ?? []}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "#0A1020",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      color: "#F1F5F9",
                    }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminSectionCard>

        <AdminSectionCard title="Latest Businesses">
          {overviewQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-32 mt-1" />
                  </div>
                  <div className="text-right">
                    <Skeleton className="h-4 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(overview?.latestBusinesses ?? []).map((business) => (
                <div key={business.businessId} className="flex items-center gap-3 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3B82F6,#8B5CF6)] text-sm font-semibold">
                    {business.businessName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#F1F5F9]">{business.businessName}</p>
                    <p className="truncate text-[11px] text-white/40">{business.ownerEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-white/35">{formatAdminRelativeTime(business.createdAt)}</p>
                    <div className="mt-1">
                      <AdminBadge tone={business.status === "active" ? "success" : business.status === "pending" ? "warning" : "danger"}>
                        {business.status}
                      </AdminBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminSectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <AdminSectionCard title="Invoice Volume Today">
          <p className="text-[32px] font-bold tracking-[-0.04em] [font-variant-numeric:tabular-nums]">
            {formatAdminNumber(overview?.health.invoiceVolumeToday ?? 0)}
          </p>
          <div className="mt-4 h-16">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={overview?.recentRegistrations ?? []}>
                <Line type="monotone" dataKey="count" stroke="#3B82F6" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminSectionCard>

        <AdminSectionCard title="Payments Confirmed Today">
          <p className="text-[32px] font-bold tracking-[-0.04em] [font-variant-numeric:tabular-nums]">
            {formatAdminNumber(overview?.health.paymentsConfirmedToday ?? 0)}
          </p>
          <p className="mt-2 text-sm text-white/40">Confirmed platform-wide today</p>
        </AdminSectionCard>

        <AdminSectionCard title="Failed Webhook Events">
          <p className="text-[32px] font-bold tracking-[-0.04em] text-[#F1F5F9] [font-variant-numeric:tabular-nums]">
            {formatAdminNumber(overview?.health.failedWebhookEvents24h ?? 0)}
          </p>
          <p className="mt-2 text-sm text-white/40">
            {(overview?.health.failedWebhookEvents24h ?? 0) > 0 ? "Requires attention" : "All webhooks healthy"}
          </p>
        </AdminSectionCard>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
