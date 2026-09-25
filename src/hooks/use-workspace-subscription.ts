import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  status: "active" | "cancelled" | "expired" | "past_due" | "paused" | "trial";
  trialEndsAt: string | null;
  trialStartedAt: string | null;
  updatedAt: string;
};

export type WorkspaceSubscriptionEntitlements = {
  canAccessStarterFeatures: boolean;
  canAccessPaidFeatures: boolean;
  isActive: boolean;
  isCancelled: boolean;
  isExpired: boolean;
  isGracePeriod: boolean;
  isPaidPlan: boolean;
};

const fetchWorkspaceSubscription = async (businessId: string): Promise<WorkspaceSubscription | null> => {
  const { data, error } = await supabase
    .from("business_subscriptions")
    .select("amount, billing_cycle, business_id, cancel_at_period_end, cancelled_at, currency, next_renewal_at, plan, provider, status, trial_ends_at, trial_started_at, updated_at")
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
    trialEndsAt: data.trial_ends_at,
    trialStartedAt: data.trial_started_at,
    updatedAt: data.updated_at,
  };
};

export const getWorkspaceSubscriptionEntitlements = (subscription: WorkspaceSubscription | null, now = Date.now()): WorkspaceSubscriptionEntitlements => {
  const isPaidPlan = Boolean(subscription && subscription.plan !== "starter");
  const renewalHasPassed = Boolean(
    isPaidPlan &&
    subscription?.nextRenewalAt &&
    ["active", "trial"].includes(subscription.status) &&
    new Date(subscription.nextRenewalAt).getTime() <= now,
  );
  const isActive = Boolean(subscription && ["active", "trial"].includes(subscription.status) && !renewalHasPassed);
  const isGracePeriod = Boolean(subscription && subscription.status === "past_due");
  const isCancelled = Boolean(subscription && subscription.status === "cancelled");
  const isExpired = Boolean(subscription && (subscription.status === "expired" || renewalHasPassed));

  return {
    canAccessPaidFeatures: isActive && isPaidPlan && !isCancelled,
    canAccessStarterFeatures: true,
    isActive,
    isCancelled,
    isExpired,
    isGracePeriod,
    isPaidPlan,
  };
};

export const useWorkspaceSubscription = () => {
  const [now, setNow] = useState(() => Date.now());
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
  const refetchSubscription = query.refetch;

  useEffect(() => {
    const renewalAt = query.data?.nextRenewalAt;
    if (!renewalAt) return;

    const remainingMs = new Date(renewalAt).getTime() - Date.now();
    if (remainingMs <= 0) {
      setNow(Date.now());
      void refetchSubscription();
      return;
    }

    const timer = window.setTimeout(() => {
      setNow(Date.now());
      void refetchSubscription();
    }, remainingMs + 100);
    return () => window.clearTimeout(timer);
  }, [query.data?.nextRenewalAt, refetchSubscription]);

  const entitlements = getWorkspaceSubscriptionEntitlements(query.data, now);

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
