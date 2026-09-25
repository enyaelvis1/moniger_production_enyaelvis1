import { describe, expect, it } from "vitest";
import { getWorkspaceSubscriptionEntitlements, type WorkspaceSubscription } from "@/hooks/use-workspace-subscription";

const subscription = (plan: WorkspaceSubscription["plan"], status: WorkspaceSubscription["status"]): WorkspaceSubscription => ({
  amount: plan === "business" ? 89000 : plan === "growth" ? 29000 : 0,
  billingCycle: plan === "starter" ? "free" : "monthly",
  businessId: `${plan}-workspace`,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  currency: "NGN",
  nextRenewalAt: null,
  plan,
  provider: plan === "starter" ? "manual" : "paystack",
  status,
  updatedAt: "2026-09-23T00:00:00.000Z",
});

describe("workspace subscription entitlements", () => {
  it("keeps Starter, Growth, and Business plans distinct", () => {
    expect(getWorkspaceSubscriptionEntitlements(subscription("starter", "active")).canAccessPaidFeatures).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("growth", "active")).canAccessPaidFeatures).toBe(true);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "active")).canAccessPaidFeatures).toBe(true);
  });

  it("does not grant paid access for pending or failed-like inactive states", () => {
    expect(getWorkspaceSubscriptionEntitlements(subscription("growth", "past_due")).canAccessPaidFeatures).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "cancelled")).canAccessPaidFeatures).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "expired")).isExpired).toBe(true);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "expired")).canAccessPaidFeatures).toBe(false);
  });

  it("does not treat a missing subscription as Starter while it is unresolved", () => {
    const entitlements = getWorkspaceSubscriptionEntitlements(null);

    expect(entitlements.isPaidPlan).toBe(false);
    expect(entitlements.canAccessPaidFeatures).toBe(false);
  });
});
