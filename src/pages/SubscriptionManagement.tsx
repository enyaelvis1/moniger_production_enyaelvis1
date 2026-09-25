import AppLayout from "@/components/app/AppLayout";
import WorkspaceUpgradePrompt from "@/components/app/WorkspaceUpgradePrompt";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";

const SubscriptionManagementPage = () => {
  const { entitlements, isLoading, subscription } = useWorkspaceSubscription();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-6xl px-4 py-10 text-sm text-[#5F6A88]">Loading subscription options…</div>
      </AppLayout>
    );
  }

  return (
    <WorkspaceUpgradePrompt
      businessId={subscription?.businessId}
      currentPlan={subscription?.plan}
      isCancelled={entitlements.isCancelled}
      isExpired={entitlements.isExpired}
      isGracePeriod={entitlements.isGracePeriod}
      reason="manage-subscription"
    />
  );
};

export default SubscriptionManagementPage;
