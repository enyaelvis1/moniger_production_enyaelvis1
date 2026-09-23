import { Loader2 } from "lucide-react";
import { type ReactNode } from "react";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import WorkspaceUpgradePrompt from "@/components/app/WorkspaceUpgradePrompt";

const WorkspaceSubscriptionGate = ({ children }: { children: ReactNode }) => {
  const { entitlements, isLoading, subscription } = useWorkspaceSubscription();

  if (isLoading || !subscription) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-[#DCE2F2] bg-white shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 size={28} className="animate-spin text-[#5B67F7]" />
          <p className="text-sm font-medium text-[#5F6A88]">Checking workspace subscription…</p>
        </div>
      </div>
    );
  }

  if (entitlements.isPaidPlan && entitlements.isActive) {
    return <>{children}</>;
  }

  return (
    <WorkspaceUpgradePrompt
      businessId={subscription?.businessId ?? null}
      currentPlan={subscription?.plan ?? null}
      isCancelled={entitlements.isCancelled || subscription?.status === "cancelled"}
      isGracePeriod={entitlements.isGracePeriod}
      reason={entitlements.isPaidPlan ? "inactive-plan" : "paid-plan-required"}
    />
  );
};

export default WorkspaceSubscriptionGate;
