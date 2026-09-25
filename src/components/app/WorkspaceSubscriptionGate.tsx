import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import WorkspaceUpgradePrompt from "@/components/app/WorkspaceUpgradePrompt";

const WorkspaceSubscriptionGate = ({ children }: { children: ReactNode }) => {
  const { entitlements, isError, refetch, refetchWorkspace, subscription, subscriptionLoading, workspaceError, workspaceLoading } = useWorkspaceSubscription();

  if (workspaceError || isError) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-[#F8C9C9] bg-[#FEF2F2] px-6 text-center shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
        <div className="max-w-md space-y-3">
          <p className="text-base font-semibold text-[#991B1B]">Unable to resolve this workspace&apos;s subscription</p>
          <p className="text-sm leading-6 text-[#991B1B]/80">
            We could not confirm the current plan. Refresh the page or retry the subscription check.
          </p>
          <button
            type="button"
            onClick={() => void Promise.all([refetchWorkspace(), refetch()])}
            className="rounded-full bg-[#991B1B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7F1D1D]"
          >
            Retry subscription check
          </button>
        </div>
      </div>
    );
  }

  if (workspaceLoading || subscriptionLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-[#DCE2F2] bg-white shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-[#5B67F7]" />
          <p className="text-sm font-medium text-[#5F6A88]">Checking workspace subscription…</p>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <WorkspaceUpgradePrompt
        businessId={null}
        currentPlan={null}
        reason="paid-plan-required"
      />
    );
  }

  if (entitlements.isActive && (!entitlements.isPaidPlan || entitlements.canAccessPaidFeatures)) {
    return <>{children}</>;
  }

  return (
    <WorkspaceUpgradePrompt
      businessId={subscription?.businessId ?? null}
      currentPlan={subscription?.plan ?? null}
      isCancelled={entitlements.isCancelled || subscription?.status === "cancelled"}
      isExpired={entitlements.isExpired || subscription?.status === "expired"}
      isGracePeriod={entitlements.isGracePeriod}
      reason={entitlements.isPaidPlan ? "inactive-plan" : "paid-plan-required"}
    />
  );
};

export default WorkspaceSubscriptionGate;
