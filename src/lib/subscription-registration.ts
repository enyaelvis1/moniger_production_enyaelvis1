import {
  createSubscriptionIntentPath,
  getDefaultSubscriptionBillingCycle,
  type SubscriptionPlan,
} from "@/lib/subscriptions";

export const getRegistrationDestination = (nextPath: string | null, plan: SubscriptionPlan) => {
  if (plan !== "starter") {
    if (nextPath?.startsWith("/pricing")) {
      return nextPath;
    }

    return createSubscriptionIntentPath({
      billingCycle: getDefaultSubscriptionBillingCycle(plan),
      plan,
    });
  }

  return nextPath?.startsWith("/") ? nextPath : "/dashboard";
};
