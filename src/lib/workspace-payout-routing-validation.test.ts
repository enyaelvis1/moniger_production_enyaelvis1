import { describe, expect, it } from "vitest";
import {
  paystackLiveSyncCountryCodes,
  validateWorkspacePayoutAccountInput,
  validateWorkspaceSplitConfigInput,
} from "@/lib/workspace-payout-routing-validation";

describe("workspace payout routing validation", () => {
  it("exposes the supported live-sync countries", () => {
    expect(paystackLiveSyncCountryCodes).toEqual(["GH", "NG"]);
  });

  it("rejects missing bank selection before payout save", () => {
    expect(
      validateWorkspacePayoutAccountInput({
        accountNumber: "0123456789",
        bankId: "",
        syncProvider: true,
      }),
    ).toEqual({
      error: {
        description: "Select the bank account that should receive subscriber payouts.",
        title: "Choose a bank",
      },
      ok: false,
    });
  });

  it("requires a 10-digit account number for NG and GH live sync", () => {
    expect(
      validateWorkspacePayoutAccountInput({
        accountNumber: "123456789",
        bankId: "bank-1",
        countryCode: "NG",
        currency: "NGN",
        syncProvider: true,
      }),
    ).toEqual({
      error: {
        description: "Paystack account resolution expects a 10-digit account number for NG payouts.",
        title: "10-digit account number required",
      },
      ok: false,
    });
  });

  it("blocks live sync for unsupported countries but still allows draft saves", () => {
    expect(
      validateWorkspacePayoutAccountInput({
        accountNumber: "0123456789",
        bankId: "bank-1",
        countryCode: "US",
        currency: "USD",
        syncProvider: true,
      }),
    ).toEqual({
      error: {
        description: "Live Paystack payout sync is currently supported for NG and GH account resolution only. Save as draft first if needed.",
        title: "Draft only for this country",
      },
      ok: false,
    });

    expect(
      validateWorkspacePayoutAccountInput({
        accountName: "Test Workspace",
        accountNumber: "0123456789",
        bankId: "bank-1",
        countryCode: "US",
        currency: "USD",
        syncProvider: false,
      }),
    ).toEqual({
      normalized: {
        accountName: "Test Workspace",
        accountNumber: "0123456789",
        bankId: "bank-1",
        countryCode: "US",
        currency: "USD",
      },
      ok: true,
    });
  });

  it("requires an account name for draft saves without provider sync", () => {
    expect(
      validateWorkspacePayoutAccountInput({
        accountName: "   ",
        accountNumber: "0123456789",
        bankId: "bank-1",
        syncProvider: false,
      }),
    ).toEqual({
      error: {
        description: "Add the account name when saving a draft without Paystack sync.",
        title: "Account name required",
      },
      ok: false,
    });
  });

  it("normalizes valid live-sync payout input", () => {
    expect(
      validateWorkspacePayoutAccountInput({
        accountName: "  Test Workspace  ",
        accountNumber: "0123-456-789",
        bankId: " bank-1 ",
        countryCode: "ng",
        currency: "ngn",
        syncProvider: true,
      }),
    ).toEqual({
      normalized: {
        accountName: "Test Workspace",
        accountNumber: "0123456789",
        bankId: "bank-1",
        countryCode: "NG",
        currency: "NGN",
      },
      ok: true,
    });
  });

  it("rejects synced percentage split values that are not whole percentages", () => {
    expect(
      validateWorkspaceSplitConfigInput({
        currency: "NGN",
        percentageFee: 12.5,
        splitMode: "percentage",
        syncProvider: true,
      }),
    ).toEqual({
      error: {
        description: "Use values like 5, 10, or 15 when syncing a percentage split to Paystack.",
        title: "Whole percentages required for Paystack sync",
      },
      ok: false,
    });
  });

  it("accepts draft percentage split values with finer precision", () => {
    expect(
      validateWorkspaceSplitConfigInput({
        currency: "NGN",
        percentageFee: 12.5,
        splitMode: "percentage",
        syncProvider: false,
      }),
    ).toEqual({
      normalized: {
        basisPoints: 1250,
        currency: "NGN",
        flatFeeAmount: null,
      },
      ok: true,
    });
  });

  it("rejects invalid flat fees and invalid currencies", () => {
    expect(
      validateWorkspaceSplitConfigInput({
        currency: "N",
        flatFeeAmount: 500,
        splitMode: "flat",
        syncProvider: true,
      }),
    ).toEqual({
      error: {
        description: "Use a valid 3-letter routing currency like NGN before saving the fee rule.",
        title: "Invalid routing currency",
      },
      ok: false,
    });

    expect(
      validateWorkspaceSplitConfigInput({
        currency: "NGN",
        flatFeeAmount: -10,
        splitMode: "flat",
        syncProvider: true,
      }),
    ).toEqual({
      error: {
        description: "Enter a positive number for the Moniger flat fee amount.",
        title: "Invalid flat fee",
      },
      ok: false,
    });
  });
});
