import { describe, expect, it } from "vitest";
import { getWorkspaceSubscriptionEntitlements, type WorkspaceSubscription } from "@/hooks/use-workspace-subscription";

const subscription = (plan: WorkspaceSubscription["plan"], status: WorkspaceSubscription["status"]): WorkspaceSubscription => ({
  amount: plan === "business" ? 89000 : plan === "growth" ? 29000 : 0,
  billingCycle: plan === "starter" ? "free" : "monthly",
  businessId: `${plan}-workspace`,
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  currency: "NGN",
  lastPaymentReference: plan === "starter" ? null : "PSK-TEST-REFERENCE",
  nextRenewalAt: null,
  plan,
  provider: plan === "starter" ? "manual" : "paystack",
  providerSubscriptionId: plan === "starter" ? null : "SUB-TEST-REFERENCE",
  status,
  updatedAt: "2026-09-23T00:00:00.000Z",
});

describe("workspace subscription entitlements", () => {
  it("keeps Starter, Growth, and Business plans distinct", () => {
    expect(getWorkspaceSubscriptionEntitlements(subscription("starter", "active")).canAccessPaidFeatures).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("starter", "active")).hasConfirmedPaidSubscription).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("growth", "active")).canAccessPaidFeatures).toBe(true);
    expect(getWorkspaceSubscriptionEntitlements(subscription("growth", "active")).hasConfirmedPaidSubscription).toBe(true);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "active")).canAccessPaidFeatures).toBe(true);
  });

  it("does not grant paid access for pending or failed-like inactive states", () => {
    expect(getWorkspaceSubscriptionEntitlements(subscription("growth", "past_due")).canAccessPaidFeatures).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "cancelled")).canAccessPaidFeatures).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "expired")).isExpired).toBe(true);
    expect(getWorkspaceSubscriptionEntitlements(subscription("business", "expired")).canAccessPaidFeatures).toBe(false);
  });

  it("does not grant paid access to an unpaid manual paid-plan row", () => {
    const unpaidGrowth = {
      ...subscription("growth", "active"),
      lastPaymentReference: null,
      provider: "manual",
      providerSubscriptionId: null,
    };

    expect(getWorkspaceSubscriptionEntitlements(unpaidGrowth).isActive).toBe(false);
    expect(getWorkspaceSubscriptionEntitlements(unpaidGrowth).canAccessPaidFeatures).toBe(false);
  });

  it("does not treat a missing subscription as Starter while it is unresolved", () => {
    const entitlements = getWorkspaceSubscriptionEntitlements(null);

    expect(entitlements.isPaidPlan).toBe(false);
    expect(entitlements.canAccessPaidFeatures).toBe(false);
  });

  it("removes paid access immediately when the renewal timestamp has passed", () => {
    const expiredTrial = {
      ...subscription("growth", "trial"),
      nextRenewalAt: "2026-09-25T00:00:00.000Z",
    };
    const entitlements = getWorkspaceSubscriptionEntitlements(expiredTrial, new Date("2026-09-25T00:01:00.000Z").getTime());

    expect(entitlements.isExpired).toBe(true);
    expect(entitlements.isActive).toBe(false);
    expect(entitlements.canAccessPaidFeatures).toBe(false);
  });

  it("does not let an old paid renewal date block a reset Starter workspace", () => {
    const resetStarter = {
      ...subscription("starter", "active"),
      nextRenewalAt: "2026-01-01T00:00:00.000Z",
    };
    const entitlements = getWorkspaceSubscriptionEntitlements(resetStarter, new Date("2026-09-25T00:01:00.000Z").getTime());

    expect(entitlements.isActive).toBe(true);
    expect(entitlements.isExpired).toBe(false);
    expect(entitlements.canAccessPaidFeatures).toBe(false);
  });
});
