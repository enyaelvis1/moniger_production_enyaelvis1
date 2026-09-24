import { describe, expect, it } from "vitest";
import { validatePaystackCheckout } from "@/lib/paystack-checkout-validation";

const valid = {
  expectedAmountKobo: 2_900_000,
  expectedCurrency: "NGN",
  expectedPlanCode: "PLN_GROWTH",
  providerAmount: 2_900_000,
  providerCurrency: "NGN",
  transactionPlanCode: "PLN_GROWTH",
  canonicalPlanCode: "PLN_GROWTH",
};

describe("Paystack checkout integrity validation", () => {
  it.each([
    ["valid matching payment", {}, true],
    ["wrong currency", { providerCurrency: "USD" }, false],
    ["missing currency", { providerCurrency: null }, false],
    ["wrong transaction plan", { transactionPlanCode: "PLN_BUSINESS" }, false],
    ["missing plan everywhere", { transactionPlanCode: null, canonicalPlanCode: null }, false],
    ["wrong amount", { providerAmount: 2_900_001 }, false],
    ["wrong plan with correct amount and currency", { transactionPlanCode: "PLN_BUSINESS", canonicalPlanCode: "PLN_BUSINESS" }, false],
  ])("handles %s", (_label, override, expected) => {
    expect(validatePaystackCheckout({ ...valid, ...override })).toEqual(expected ? { ok: true } : expect.objectContaining({ code: "CHECKOUT_MISMATCH", ok: false }));
  });

  it("accepts a missing transaction plan when the canonical subscription proves the plan", () => {
    expect(validatePaystackCheckout({ ...valid, transactionPlanCode: null })).toEqual({ ok: true });
  });
});
