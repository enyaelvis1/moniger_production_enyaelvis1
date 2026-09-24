import { useQuery } from "@tanstack/react-query";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
import { useSettingsData } from "@/hooks/use-settings-data";
import { financeQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

export type WorkspaceSubscription = {
  amount: number;
  billingCycle: "annual" | "free" | "manual" | "monthly";
  businessId: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  currency: string;
  nextRenewalAt: string | null;
  plan: "business" | "growth" | "starter";
  provider: string;
  status: "active" | "cancelled" | "past_due" | "paused" | "trial";
  updatedAt: string;
};

export type WorkspaceSubscriptionEntitlements = {
  canAccessStarterFeatures: boolean;
  canAccessPaidFeatures: boolean;
  isActive: boolean;
  isCancelled: boolean;
  isGracePeriod: boolean;
  isPaidPlan: boolean;
};

const fetchWorkspaceSubscription = async (businessId: string): Promise<WorkspaceSubscription | null> => {
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("amount, billing_cycle, business_id, cancel_at_period_end, cancelled_at, currency, next_renewal_at, plan, provider, status, updated_at")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    amount: Number(data.amount ?? 0),
    billingCycle: data.billing_cycle as WorkspaceSubscription["billingCycle"],
    businessId: data.business_id,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    cancelledAt: data.cancelled_at,
    currency: data.currency ?? "NGN",
    nextRenewalAt: data.next_renewal_at,
    plan: data.plan as WorkspaceSubscription["plan"],
    provider: data.provider ?? "manual",
    status: data.status as WorkspaceSubscription["status"],
    updatedAt: data.updated_at,
  };
};

export const getWorkspaceSubscriptionEntitlements = (subscription: WorkspaceSubscription | null): WorkspaceSubscriptionEntitlements => {
  const isPaidPlan = Boolean(subscription && subscription.plan !== "starter");
  const isActive = Boolean(subscription && ["active", "trial"].includes(subscription.status));
  const isGracePeriod = Boolean(subscription && subscription.status === "past_due");
  const isCancelled = Boolean(subscription && subscription.status === "cancelled");

  return {
    canAccessPaidFeatures: isActive && isPaidPlan && !isCancelled,
    canAccessStarterFeatures: true,
    isActive,
    isCancelled,
    isGracePeriod,
    isPaidPlan,
  };
};

export const useWorkspaceSubscription = () => {
  const { session } = useSupabaseSession();
  const settingsQuery = useSettingsData(session?.user.id);
  const { data: settings } = settingsQuery;
  const businessId = settings?.business?.id ?? null;

  const query = useQuery({
    ...financeQueryOptions,
    enabled: Boolean(businessId) && !settingsQuery.isPending && !settingsQuery.isError,
    queryFn: () => fetchWorkspaceSubscription(businessId as string),
    queryKey: ["workspace-subscription", businessId],
    staleTime: 60_000,
  });

  const entitlements = getWorkspaceSubscriptionEntitlements(query.data);

  return {
    ...query,
    entitlements,
    workspaceLoading: settingsQuery.isPending,
    workspaceError: settingsQuery.error,
    subscriptionLoading: Boolean(businessId) && query.isPending,
    subscriptionError: query.error,
    isResolved: Boolean(businessId) && !query.isPending && !query.isError,
    isLoading: settingsQuery.isPending || (Boolean(businessId) && query.isPending),
    subscription: query.data,
    refetchWorkspace: settingsQuery.refetch,
  };
};
