import { describe, expect, it } from "vitest";
import {
  createSubscriptionConfirmationPath,
  createSubscriptionIntentPath,
  getDefaultSubscriptionBillingCycle,
  isPaidSubscriptionSelection,
  isSubscriptionBillingCycle,
  isSubscriptionPlan,
  mergeSubscriptionCatalog,
  subscriptionCatalog,
} from "@/lib/subscriptions";

describe("subscription helpers", () => {
  it("returns the expected default billing cycle for each plan", () => {
    expect(getDefaultSubscriptionBillingCycle("starter")).toBe("free");
    expect(getDefaultSubscriptionBillingCycle("growth")).toBe("monthly");
    expect(getDefaultSubscriptionBillingCycle("business")).toBe("monthly");
  });

  it("builds a pricing intent path with preserved plan and billing cycle", () => {
    expect(
      createSubscriptionIntentPath({
        billingCycle: "monthly",
        plan: "growth",
      }),
    ).toBe("/pricing?billingCycle=monthly&subscribe=growth");
  });

  it("builds a confirmation path when a reference is present", () => {
    expect(createSubscriptionConfirmationPath({ reference: "SUB-GRO-123" })).toBe(
      "/pricing/confirmed?reference=SUB-GRO-123",
    );
    expect(createSubscriptionConfirmationPath()).toBe("/pricing/confirmed");
  });

  it("identifies valid plans, billing cycles, and paid selections", () => {
    expect(isSubscriptionPlan("growth")).toBe(true);
    expect(isSubscriptionPlan("enterprise")).toBe(false);
    expect(isSubscriptionBillingCycle("annual")).toBe(true);
    expect(isSubscriptionBillingCycle("weekly")).toBe(false);
    expect(isPaidSubscriptionSelection({ billingCycle: "monthly", plan: "growth" })).toBe(true);
    expect(isPaidSubscriptionSelection({ billingCycle: "free", plan: "starter" })).toBe(false);
  });

  it("merges catalog overrides while preserving default plan structure", () => {
    const catalog = mergeSubscriptionCatalog({
      growth: {
        description: "Updated growth description",
        features: ["Feature one", "", "Feature two"],
        priceLabel: "NGN 31,000/mo",
      },
    });

    expect(catalog.growth.description).toBe("Updated growth description");
    expect(catalog.growth.features).toEqual(["Feature one", "Feature two"]);
    expect(catalog.growth.priceLabel).toBe("NGN 31,000/mo");
    expect(catalog.starter.priceLabel).toBe(subscriptionCatalog.starter.priceLabel);
    expect(catalog.business.priceLabel).toBe(subscriptionCatalog.business.priceLabel);
  });
});
