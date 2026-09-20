export type ManagedSubscriptionBillingCycle = "annual" | "free" | "manual" | "monthly";
export type ManagedSubscriptionPlan = "business" | "growth" | "starter";

export type ManagedSubscriptionSwitchKind =
  | "billing_cycle_change"
  | "current"
  | "downgrade"
  | "new_checkout"
  | "upgrade";

const planRank: Record<ManagedSubscriptionPlan, number> = {
  business: 2,
  growth: 1,
  starter: 0,
};

export const getManagedSubscriptionSwitchKind = ({
  currentBillingCycle,
  currentPlan,
  nextBillingCycle,
  nextPlan,
}: {
  currentBillingCycle: ManagedSubscriptionBillingCycle | null;
  currentPlan: ManagedSubscriptionPlan | null;
  nextBillingCycle: ManagedSubscriptionBillingCycle;
  nextPlan: ManagedSubscriptionPlan;
}): ManagedSubscriptionSwitchKind => {
  if (!currentPlan || !currentBillingCycle) {
    return "new_checkout";
  }

  if (currentPlan === nextPlan && currentBillingCycle === nextBillingCycle) {
    return "current";
  }

  if (currentPlan === nextPlan) {
    return "billing_cycle_change";
  }

  return planRank[nextPlan] > planRank[currentPlan] ? "upgrade" : "downgrade";
};
