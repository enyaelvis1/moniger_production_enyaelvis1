import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getCanonicalSummaryFromPaystackSubscription,
  getPlanFromCheckoutSession,
  getSubscriptionCodeFromWebhookPayload,
} from "../../supabase/functions/_shared/paystack-subscriptions.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("paystack subscription helpers", () => {
  it("extracts subscription codes from direct and nested webhook payloads", () => {
    expect(getSubscriptionCodeFromWebhookPayload({ subscription_code: "SUB_DIRECT" })).toBe("SUB_DIRECT");
    expect(
      getSubscriptionCodeFromWebhookPayload({
        subscription: { subscription_code: "SUB_NESTED" },
      }),
    ).toBe("SUB_NESTED");
    expect(
      getSubscriptionCodeFromWebhookPayload({
        subscription: { code: "SUB_CODE" },
      }),
    ).toBe("SUB_CODE");
    expect(getSubscriptionCodeFromWebhookPayload({})).toBeNull();
  });

  it("builds a canonical active summary for non-renewing subscriptions", () => {
    const summary = getCanonicalSummaryFromPaystackSubscription({
      checkoutSession: {
        amount: 29000,
        billing_cycle: "monthly",
        business_id: "biz-1",
        currency: "NGN",
        payer_email: "billing@example.com",
        payer_name: "Billing Owner",
        plan: "growth",
        provider_plan_code: "PLAN_GROWTH",
      },
      existingSubscription: {
        amount: 29000,
        billing_cycle: "monthly",
        currency: "NGN",
        provider_customer_id: null,
        provider_email_token: null,
        provider_plan_code: "PLAN_GROWTH",
        provider_subscription_id: "SUB_EXISTING",
        started_at: "2026-05-01T00:00:00.000Z",
        status: "active",
      },
      subscription: {
        amount: 2900000,
        createdAt: "2026-05-21T09:00:00.000Z",
        customer: {
          customer_code: "CUS_123",
        },
        email_token: "email-token-123",
        next_payment_date: "2026-06-21T09:00:00.000Z",
        plan: {
          currency: "NGN",
          interval: "monthly",
          plan_code: "PLAN_GROWTH",
        },
        status: "non-renewing",
        subscription_code: "SUB_NEW",
      },
    });

    expect(summary).toEqual({
      amount: 29000,
      billingCycle: "monthly",
      cancelAtPeriodEnd: true,
      cancelledAt: null,
      currency: "NGN",
      nextRenewalAt: "2026-06-21T09:00:00.000Z",
      paystackCustomerId: "CUS_123",
      paystackEmailToken: "email-token-123",
      paystackPlanCode: "PLAN_GROWTH",
      paystackSubscriptionId: "SUB_NEW",
      startedAt: "2026-05-21T09:00:00.000Z",
      status: "active",
    });
  });

  it("maps attention status to past due and falls back to computed renewal dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T10:30:00.000Z"));

    const summary = getCanonicalSummaryFromPaystackSubscription({
      checkoutSession: {
        amount: 89000,
        billing_cycle: "annual",
        business_id: "biz-2",
        currency: "NGN",
        payer_email: "finance@example.com",
        payer_name: "Finance Team",
        plan: "business",
        provider_plan_code: "PLAN_BUSINESS",
      },
      existingSubscription: null,
      subscription: {
        amount: 106800000,
        customer: {
          id: 77,
        },
        plan: {
          interval: "annually",
          plan_code: "PLAN_BUSINESS",
        },
        status: "attention",
        subscription_code: "SUB_ATTENTION",
      },
    });

    expect(summary.status).toBe("past_due");
    expect(summary.cancelAtPeriodEnd).toBe(false);
    expect(summary.billingCycle).toBe("annual");
    expect(summary.amount).toBe(1068000);
    expect(summary.paystackCustomerId).toBe("77");
    expect(summary.nextRenewalAt).toBe("2027-05-21T10:30:00.000Z");
  });

  it("maps disabled subscriptions to cancelled and keeps the best available fallback values", () => {
    const summary = getCanonicalSummaryFromPaystackSubscription({
      checkoutSession: {
        amount: 29000,
        billing_cycle: "monthly",
        business_id: "biz-3",
        currency: "GHS",
        payer_email: "ops@example.com",
        payer_name: "Ops Lead",
        plan: "growth",
        provider_plan_code: "PLAN_GHS",
      },
      existingSubscription: {
        amount: 30000,
        billing_cycle: "monthly",
        cancelled_at: "2026-05-22T08:00:00.000Z",
        currency: "GHS",
        provider_customer_id: "CUS_EXISTING",
        provider_email_token: "legacy-token",
        provider_plan_code: "PLAN_GHS",
        provider_subscription_id: "SUB_OLD",
        started_at: "2026-02-01T12:00:00.000Z",
        status: "active",
      },
      subscription: {
        amount: "3000000",
        customer: {},
        plan: {},
        status: "disabled",
        updatedAt: "2026-05-23T15:45:00.000Z",
      },
    });

    expect(summary.status).toBe("cancelled");
    expect(summary.cancelledAt).toBe("2026-05-23T15:45:00.000Z");
    expect(summary.currency).toBe("GHS");
    expect(summary.paystackCustomerId).toBe("CUS_EXISTING");
    expect(summary.paystackEmailToken).toBe("legacy-token");
    expect(summary.paystackSubscriptionId).toBe("SUB_OLD");
    expect(summary.startedAt).toBe("2026-02-01T12:00:00.000Z");
  });

  it("resolves the plan from checkout sessions and falls back to starter", () => {
    expect(getPlanFromCheckoutSession({ plan: "business" })).toBe("business");
    expect(getPlanFromCheckoutSession({ plan: "enterprise" })).toBe("starter");
    expect(getPlanFromCheckoutSession(null)).toBe("starter");
  });
});
