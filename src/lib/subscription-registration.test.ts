import { describe, expect, it } from "vitest";
import { getEmailConfirmationRedirect } from "./subscription-registration";

describe("email confirmation signup redirect", () => {
  it("carries a paid signup plan to the dashboard", () => {
    const redirect = getEmailConfirmationRedirect({
      origin: "https://moniger.net",
      plan: "business",
      redirectTo: "https://moniger.net/dashboard?source=signup",
    });

    expect(redirect).toBe("https://moniger.net/dashboard?source=signup&email_confirmed=1&signup_plan=business");
  });

  it("does not carry a paid plan for Starter", () => {
    const redirect = getEmailConfirmationRedirect({
      origin: "https://moniger.net",
      plan: "starter",
      redirectTo: "https://moniger.net/dashboard?signup_plan=growth",
    });

    expect(redirect).toBe("https://moniger.net/dashboard?email_confirmed=1");
  });
});
