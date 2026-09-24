export type CheckoutValidationInput = {
  expectedAmountKobo: number | null;
  expectedCurrency: string | null;
  expectedPlanCode: string | null;
  providerAmount: number | null;
  providerCurrency: string | null;
  transactionPlanCode: string | null;
  canonicalPlanCode: string | null;
};

export type CheckoutValidationResult =
  | { ok: true }
  | { code: "CHECKOUT_MISMATCH"; ok: false; reason: string };

export const validatePaystackCheckout = (input: CheckoutValidationInput): CheckoutValidationResult => {
  if (input.expectedAmountKobo !== null && input.providerAmount !== input.expectedAmountKobo) {
    return { code: "CHECKOUT_MISMATCH", ok: false, reason: "amount" };
  }

  if (input.expectedCurrency && input.providerCurrency?.toUpperCase() !== input.expectedCurrency.toUpperCase()) {
    return { code: "CHECKOUT_MISMATCH", ok: false, reason: "currency" };
  }

  if (input.expectedPlanCode) {
    if (input.transactionPlanCode && input.transactionPlanCode !== input.expectedPlanCode) {
      return { code: "CHECKOUT_MISMATCH", ok: false, reason: "transaction plan" };
    }

    if (input.canonicalPlanCode !== input.expectedPlanCode) {
      return { code: "CHECKOUT_MISMATCH", ok: false, reason: "canonical plan" };
    }
  }

  return { ok: true };
};
