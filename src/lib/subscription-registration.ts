import {
  createSubscriptionIntentPath,
  getDefaultSubscriptionBillingCycle,
  type SubscriptionPlan,
} from "@/lib/subscriptions";

export const getEmailConfirmationRedirect = ({
  origin,
  plan,
  redirectTo,
}: {
  origin: string;
  plan: SubscriptionPlan;
  redirectTo: string;
}) => {
  try {
    const redirectUrl = new URL(redirectTo, origin);
    redirectUrl.searchParams.set("email_confirmed", "1");

    if (plan !== "starter") {
      redirectUrl.searchParams.set("signup_plan", plan);
    } else {
      redirectUrl.searchParams.delete("signup_plan");
    }

    return redirectUrl.toString();
  } catch {
    return redirectTo;
  }
};

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
