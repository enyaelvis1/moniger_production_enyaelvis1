import { describe, expect, it } from "vitest";
import { getManagedSubscriptionSwitchKind } from "../../supabase/functions/_shared/paystack-subscription-switching.ts";

describe("paystack subscription switching", () => {
  it("treats a first paid checkout as a new checkout", () => {
    expect(
      getManagedSubscriptionSwitchKind({
        currentBillingCycle: null,
        currentPlan: null,
        nextBillingCycle: "monthly",
        nextPlan: "growth",
      }),
    ).toBe("new_checkout");
  });

  it("treats the same paid plan and cycle as current", () => {
    expect(
      getManagedSubscriptionSwitchKind({
        currentBillingCycle: "monthly",
        currentPlan: "growth",
        nextBillingCycle: "monthly",
        nextPlan: "growth",
      }),
    ).toBe("current");
  });

  it("classifies growth to business as an upgrade", () => {
    expect(
      getManagedSubscriptionSwitchKind({
        currentBillingCycle: "monthly",
        currentPlan: "growth",
        nextBillingCycle: "monthly",
        nextPlan: "business",
      }),
    ).toBe("upgrade");
  });

  it("classifies business to growth as a downgrade", () => {
    expect(
      getManagedSubscriptionSwitchKind({
        currentBillingCycle: "monthly",
        currentPlan: "business",
        nextBillingCycle: "monthly",
        nextPlan: "growth",
      }),
    ).toBe("downgrade");
  });

  it("classifies annual and monthly moves on the same plan as billing cycle changes", () => {
    expect(
      getManagedSubscriptionSwitchKind({
        currentBillingCycle: "monthly",
        currentPlan: "growth",
        nextBillingCycle: "annual",
        nextPlan: "growth",
      }),
    ).toBe("billing_cycle_change");
  });
});
