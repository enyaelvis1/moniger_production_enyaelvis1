import { describe, expect, it } from "vitest";
import { buildSubscriptionPaymentFailureNotification } from "../../supabase/functions/_shared/paystack-subscriptions.ts";

describe("subscription payment failure notification", () => {
  it("gives finance users an actionable settings link and accurate access state", () => {
    expect(buildSubscriptionPaymentFailureNotification("growth")).toEqual({
      body: "The growth workspace subscription renewal could not be collected. Paid-plan features are paused until billing is updated.",
      link: "/settings?tab=profile",
      title: "Subscription payment failed",
      type: "system",
    });
  });
});
