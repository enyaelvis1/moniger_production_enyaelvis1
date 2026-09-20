import { describe, expect, it } from "vitest";
import {
  buildSignupAlertContext,
  buildSignupDeliveryUpdate,
  isDuplicateSignupAlertError,
} from "../../supabase/functions/_shared/signup-alert";

describe("signup alert context", () => {
  it.each([
    ["starter", "active"],
    ["growth", "email_confirmation_pending"],
    ["business", "active"],
  ])("records the %s plan and confirmation status", (plan, signupStatus) => {
    expect(buildSignupAlertContext({
      email: " OWNER@Example.com ",
      emailConfirmedAt: signupStatus === "active" ? "2026-09-19T00:00:00.000Z" : null,
      environment: "qa",
      plan,
      userId: "user-1",
      userMetadata: { business_name: "Acme", name: "Ada Lovelace", signup_plan: plan },
    })).toMatchObject({ email: "owner@example.com", plan, signupStatus });
  });

  it("rejects a mismatched recorded plan", () => {
    expect(() => buildSignupAlertContext({
      email: "owner@example.com",
      environment: "production",
      plan: "business",
      userId: "user-1",
      userMetadata: { signup_plan: "growth" },
    })).toThrow("Signup plan verification failed");
  });

  it("recognizes the database duplicate constraint", () => {
    expect(isDuplicateSignupAlertError("23505")).toBe(true);
    expect(isDuplicateSignupAlertError("23503")).toBe(false);
  });

  it("builds sent and failed delivery updates", () => {
    expect(buildSignupDeliveryUpdate({ deliveredAt: "2026-09-19T00:00:00.000Z", providerMessageId: "msg-1" })).toEqual({
      delivered_at: "2026-09-19T00:00:00.000Z",
      delivery_status: "sent",
      provider_message_id: "msg-1",
    });
    expect(buildSignupDeliveryUpdate({ failureReason: "Provider unavailable" })).toEqual({
      delivery_status: "failed",
      failure_reason: "Provider unavailable",
    });
  });
});
