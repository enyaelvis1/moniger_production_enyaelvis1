import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminSignupAlertsResponse,
} from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminEmpty,
  AdminPageHeader,
  AdminSectionCard,
  formatAdminDateTime,
} from "@/admin/components/AdminUi";

const statusTone = (status: string) => {
  if (status === "sent") return "success" as const;
  if (status === "failed") return "danger" as const;
  return "warning" as const;
};

const AdminSignupAlertsPage = () => {
  const { toast } = useToast();
  const alertsQuery = useAdminConsoleQuery<AdminSignupAlertsResponse>("signupAlerts.list");
  const rows = alertsQuery.data?.rows ?? [];

  const refresh = async () => {
    try {
      await alertsQuery.refetch();
      toast({ title: "Signup alerts refreshed", description: "The latest signup delivery events are now displayed." });
    } catch (error) {
      toast({ title: "Refresh failed", description: error instanceof Error ? error.message : "Unable to refresh signup alerts.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Signup Alerts"
        subtitle="Monitor Starter, Growth, and Business signup notification delivery."
        action={
          <Button onClick={() => void refresh()} variant="ghost" className="border border-white/10 bg-white/5 text-white hover:bg-white/10">
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      <AdminSectionCard title="Recent signup notifications">
        {alertsQuery.error ? (
          <p className="text-sm text-[#FCA5A5]">{alertsQuery.error instanceof Error ? alertsQuery.error.message : "Unable to load signup alerts."}</p>
        ) : rows.length === 0 ? (
          <AdminEmpty title="No signup alerts yet" description="Signup events will appear here after the alert function is deployed and receives a new registration." />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#F1F5F9]">{row.businessName ?? "Business not provided"}</p>
                    <p className="text-sm text-white/45">{row.fullName ?? "Name not provided"} · {row.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <AdminBadge tone="info">{row.plan}</AdminBadge>
                    <AdminBadge tone={statusTone(row.deliveryStatus)}>{row.deliveryStatus}</AdminBadge>
                  </div>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-white/40 sm:grid-cols-2">
                  <p>Signup: {formatAdminDateTime(row.createdAt)}</p>
                  <p>Environment: {row.environment}</p>
                  <p>Account status: {row.signupStatus.replace(/_/g, " ")}</p>
                  <p>Delivered: {row.deliveredAt ? formatAdminDateTime(row.deliveredAt) : "Not delivered"}</p>
                </div>
                {row.failureReason ? <p className="mt-3 rounded-lg border border-[#EF4444]/20 bg-[#7F1D1D]/20 p-3 text-sm text-[#FCA5A5]">Delivery failure: {row.failureReason}</p> : null}
              </div>
            ))}
          </div>
        )}
      </AdminSectionCard>
    </div>
  );
};

export default AdminSignupAlertsPage;
