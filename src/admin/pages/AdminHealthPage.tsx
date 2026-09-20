import { useEffect } from "react";
import {
  Activity,
  RefreshCcw,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useAdminConsoleQuery, type AdminHealthResponse } from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSectionCard,
  AdminTableHead,
  AdminTableWrapper,
  formatAdminDateTime,
} from "@/admin/components/AdminUi";

const AdminHealthPage = () => {
  const healthQuery = useAdminConsoleQuery<AdminHealthResponse>("health.check");

  useEffect(() => {
    const interval = window.setInterval(() => {
      void healthQuery.refetch();
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [healthQuery]);

  const elevatedResponseTimes = (healthQuery.data?.responseTimeSamples ?? []).some((sample) => sample.value > 500);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Health Monitor"
        subtitle="Live service health, webhook monitoring, and recent response times."
        action={(
          <Button
            variant="ghost"
            onClick={() => void healthQuery.refetch()}
            className="h-9 rounded-lg border border-white/10 bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <RefreshCcw size={14} aria-hidden="true" />
            Refresh
          </Button>
        )}
      />

      {elevatedResponseTimes ? (
        <div className="rounded-xl border border-[#F59E0B]/25 bg-[#F59E0B]/12 px-4 py-3 text-sm text-[#FCD34D]">
          Elevated response times detected. Monitor closely.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        {(healthQuery.data?.services ?? []).map((service) => (
          <AdminSectionCard key={service.service} title={service.service}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-[#F1F5F9] capitalize">{service.status}</p>
                <p className="mt-1 text-sm text-white/40">Checked {formatAdminDateTime(service.checkedAt)}</p>
              </div>
              <AdminBadge tone={service.status === "operational" ? "success" : service.status === "degraded" ? "warning" : "danger"}>
                {service.status}
              </AdminBadge>
            </div>
            <p className="mt-4 text-sm text-white/45">{service.responseMs ?? 0}ms response</p>
          </AdminSectionCard>
        ))}
      </div>

      <AdminSectionCard
        title="Response Times"
        titleAction={(
          <div className="inline-flex items-center gap-2 text-xs text-[#10B981]">
            <Activity size={14} aria-hidden="true" />
            Sampled every 60s
          </div>
        )}
      >
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={healthQuery.data?.responseTimeSamples ?? []}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.38)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#0A1020",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  color: "#F1F5F9",
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#3B82F6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </AdminSectionCard>

      <AdminSectionCard title="Webhook Log">
        <AdminTableWrapper>
          <table className="min-w-full text-left text-sm text-white/70">
            <AdminTableHead>
              <tr>
                <th className="px-5 py-3">Event Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Received</th>
                <th className="px-5 py-3">Processing Time</th>
              </tr>
            </AdminTableHead>
            <tbody>
              {(healthQuery.data?.webhookEvents ?? []).map((event) => (
                <tr key={event.id} className={`border-b border-white/5 ${event.status === "failed" ? "bg-[#EF4444]/5" : ""}`}>
                  <td className="px-5 py-4 font-medium text-[#F1F5F9]">{event.eventType}</td>
                  <td className="px-5 py-4">
                    <AdminBadge tone={event.status === "processed" ? "success" : event.status === "failed" ? "danger" : "warning"}>
                      {event.status}
                    </AdminBadge>
                  </td>
                  <td className="px-5 py-4 text-white/45">{formatAdminDateTime(event.receivedAt)}</td>
                  <td className="px-5 py-4">{event.processingTimeMs ?? 0}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminTableWrapper>
      </AdminSectionCard>
    </div>
  );
};

export default AdminHealthPage;
