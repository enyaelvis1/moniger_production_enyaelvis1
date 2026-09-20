import { Activity } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAdminConsoleQuery, type AdminOverviewResponse } from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSectionCard,
  formatAdminDateTime,
} from "@/admin/components/AdminUi";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const AdminPlatformMetricsPage = () => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const overviewQuery = useAdminConsoleQuery<AdminOverviewResponse>("overview");
  const overview = overviewQuery.data;
  const surfaceClassName = isDark ? "rounded-xl border border-white/5 bg-[#0F1621]" : "rounded-xl border border-[#DCE2F2] bg-white";
  const mutedTextClassName = isDark ? "text-white/35" : "text-[#6B7693]";
  const secondaryTextClassName = isDark ? "text-white/50" : "text-[#53627F]";
  const headingClassName = isDark ? "text-[#F1F5F9]" : "text-[#10203F]";
  const chartTickClassName = isDark ? "rgba(255,255,255,0.38)" : "rgba(16,32,63,0.42)";
  const chartGridClassName = isDark ? "rgba(255,255,255,0.06)" : "rgba(108,126,163,0.16)";
  const tooltipStyle = isDark
    ? {
        background: "#0A1020",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        color: "#F1F5F9",
      }
    : {
        background: "#FFFFFF",
        border: "1px solid #DCE2F2",
        borderRadius: 12,
        color: "#10203F",
        boxShadow: "0 12px 30px rgba(16, 32, 63, 0.08)",
      };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Metrics"
        subtitle="Cross-platform growth, response-time, and health telemetry for the operator console."
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <AdminSectionCard title="Registration Trend">
          {overviewQuery.isLoading ? (
            <div className="h-[280px]"><Skeleton className="h-full w-full" /></div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={overview?.recentRegistrations ?? []}>
                  <defs>
                    <linearGradient id="adminMetricsArea" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartGridClassName} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: chartTickClassName, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: chartTickClassName, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="url(#adminMetricsArea)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </AdminSectionCard>

        <AdminSectionCard title="Current Service Status">
          {overviewQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={cn(surfaceClassName, "p-4")}>
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24 mt-2" />
                  <Skeleton className="h-3 w-full mt-3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {(overview?.health.services ?? []).map((service) => (
                <div key={service.service} className={cn(surfaceClassName, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={cn("text-sm font-medium", headingClassName)}>{service.service}</p>
                      <p className={cn("mt-1 text-xs", mutedTextClassName)}>Checked {formatAdminDateTime(service.checkedAt)}</p>
                    </div>
                    <AdminBadge tone={service.status === "operational" ? "success" : service.status === "degraded" ? "warning" : "danger"}>
                      {service.status}
                    </AdminBadge>
                  </div>
                  <p className={cn("mt-3 text-sm", secondaryTextClassName)}>
                    Response time: <span className={headingClassName}>{service.responseMs ?? 0}ms</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </AdminSectionCard>
      </div>

      <AdminSectionCard
        title="Average Database Response Times"
        titleAction={(
          <div className="inline-flex items-center gap-2 text-xs text-[#10B981]">
            <Activity size={14} aria-hidden="true" />
            Live sampling
          </div>
        )}
      >
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={overview?.health.responseTimeSamples ?? []}>
              <CartesianGrid stroke={chartGridClassName} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: chartTickClassName, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartTickClassName, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdminSectionCard>
    </div>
  );
};

export default AdminPlatformMetricsPage;
