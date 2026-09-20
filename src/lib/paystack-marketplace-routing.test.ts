import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildMarketplaceInitializationPayload,
  resolveMarketplaceRoutingConfig,
  resolveMarketplaceRoutingMetadata,
  type PayoutRoutingAccountRow,
  type PayoutRoutingSplitConfigRow,
} from "../../supabase/functions/_shared/paystack-marketplace-routing";

const verifiedPayoutAccount: PayoutRoutingAccountRow = {
  id: "payout-1",
  provider_metadata: { settlement_bank: "GTBank" },
  provider_subaccount_code: "SUB_123",
  status: "verified",
};

const readyPercentageSplit: PayoutRoutingSplitConfigRow = {
  id: "split-1",
  moniger_fee_flat_amount: 0,
  provider_metadata: { strategy: "split_code" },
  provider_split_code: "SPL_123",
  split_mode: "percentage",
  status: "ready",
};

const readyFlatSplit: PayoutRoutingSplitConfigRow = {
  id: "split-2",
  moniger_fee_flat_amount: 500,
  provider_metadata: { strategy: "transaction_charge" },
  provider_split_code: null,
  split_mode: "flat",
  status: "ready",
};

afterEach(() => {
  vi.useRealTimers();
});

describe("paystack marketplace routing helper", () => {
  it("returns inactive when payout or split config is missing or not ready", () => {
    expect(
      resolveMarketplaceRoutingConfig({
        amountKobo: 100_000,
        payoutAccount: null,
        splitConfig: readyPercentageSplit,
        toKobo: (value) => Math.round(Number(value) * 100),
      }),
    ).toEqual({ status: "inactive" });

    expect(
      resolveMarketplaceRoutingConfig({
        amountKobo: 100_000,
        payoutAccount: verifiedPayoutAccount,
        splitConfig: { ...readyPercentageSplit, status: "draft" },
        toKobo: (value) => Math.round(Number(value) * 100),
      }),
    ).toEqual({ status: "inactive" });

    expect(
      resolveMarketplaceRoutingConfig({
        amountKobo: 100_000,
        payoutAccount: { ...verifiedPayoutAccount, status: "draft" },
        splitConfig: readyPercentageSplit,
        toKobo: (value) => Math.round(Number(value) * 100),
      }),
    ).toEqual({ status: "inactive" });
  });

  it("builds a ready percentage routing config and initialization payload", () => {
    const config = resolveMarketplaceRoutingConfig({
      amountKobo: 100_000,
      payoutAccount: verifiedPayoutAccount,
      splitConfig: readyPercentageSplit,
      toKobo: (value) => Math.round(Number(value) * 100),
    });

    expect(config).toEqual({
      mode: "percentage",
      payoutAccountId: "payout-1",
      providerMetadata: { settlement_bank: "GTBank" },
      providerSplitCode: "SPL_123",
      providerSubaccountCode: "SUB_123",
      splitConfigId: "split-1",
      splitConfigMetadata: { strategy: "split_code" },
      status: "ready",
      transactionChargeKobo: null,
    });

    expect(buildMarketplaceInitializationPayload(config)).toEqual({
      bearer: "account",
      split_code: "SPL_123",
    });
  });

  it("builds a ready flat routing config and initialization payload", () => {
    const config = resolveMarketplaceRoutingConfig({
      amountKobo: 100_000,
      payoutAccount: verifiedPayoutAccount,
      splitConfig: readyFlatSplit,
      toKobo: (value) => Math.round(Number(value) * 100),
    });

    expect(config).toEqual({
      mode: "flat",
      payoutAccountId: "payout-1",
      providerMetadata: { settlement_bank: "GTBank" },
      providerSplitCode: null,
      providerSubaccountCode: "SUB_123",
      splitConfigId: "split-2",
      splitConfigMetadata: { strategy: "transaction_charge" },
      status: "ready",
      transactionChargeKobo: 50_000,
    });

    expect(buildMarketplaceInitializationPayload(config)).toEqual({
      bearer: "account",
      subaccount: "SUB_123",
      transaction_charge: 50_000,
    });
  });

  it("throws when ready routing is missing required provider fields or exceeds invoice amount", () => {
    expect(() =>
      resolveMarketplaceRoutingConfig({
        amountKobo: 100_000,
        payoutAccount: { ...verifiedPayoutAccount, provider_subaccount_code: null },
        splitConfig: readyPercentageSplit,
        toKobo: (value) => Math.round(Number(value) * 100),
      }),
    ).toThrow("missing a Paystack subaccount code");

    expect(() =>
      resolveMarketplaceRoutingConfig({
        amountKobo: 100_000,
        payoutAccount: verifiedPayoutAccount,
        splitConfig: { ...readyPercentageSplit, provider_split_code: null },
        toKobo: (value) => Math.round(Number(value) * 100),
      }),
    ).toThrow("missing a Paystack split code");

    expect(() =>
      resolveMarketplaceRoutingConfig({
        amountKobo: 10_000,
        payoutAccount: verifiedPayoutAccount,
        splitConfig: readyFlatSplit,
        toKobo: (value) => Math.round(Number(value) * 100),
      }),
    ).toThrow("fee exceeds this invoice amount");
  });

  it("merges settlement details into existing routing metadata", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:00:00.000Z"));

    const metadata = resolveMarketplaceRoutingMetadata({
      existingMetadata: {
        marketplace_routing: {
          enabled: false,
          mode: "percentage",
          provider_split_code: "SPL_123",
        },
      },
      paidAt: "2026-05-21T11:58:00.000Z",
      paystackPayload: {
        amount: 250000,
        currency: "NGN",
        fees: 3750,
        gateway_response: "Successful",
        paid_at: "2026-05-21T11:59:00.000Z",
        reference: "PSK-REF-123",
        split: { id: 88 },
        status: "success",
        subaccount: { subaccount_code: "SUB_123" },
        transaction_date: "2026-05-21T11:57:00.000Z",
      },
      reference: "PSK-REF-123",
    });

    expect(metadata).toEqual({
      enabled: false,
      mode: "percentage",
      provider_split_code: "SPL_123",
      settlement: {
        amount_kobo: 250000,
        currency: "NGN",
        fees_kobo: 3750,
        fees_split: null,
        gateway_response: "Successful",
        paid_at: "2026-05-21T11:59:00.000Z",
        provider_reference: "PSK-REF-123",
        provider_status: "success",
        split: { id: 88 },
        subaccount: { subaccount_code: "SUB_123" },
        transaction_date: "2026-05-21T11:57:00.000Z",
        verified_at: "2026-05-21T12:00:00.000Z",
      },
    });
  });

  it("falls back to provider metadata routing and defaults enabled to true", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:05:00.000Z"));

    const metadata = resolveMarketplaceRoutingMetadata({
      existingMetadata: {},
      paidAt: "2026-05-21T12:01:00.000Z",
      paystackPayload: {
        amount: 90000,
        currency: "NGN",
        metadata: {
          marketplace_routing: {
            mode: "flat",
            provider_subaccount_code: "SUB_999",
          },
        },
        reference: "PSK-REF-456",
        status: "success",
      },
      reference: "PSK-REF-456",
    });

    expect(metadata).toEqual({
      enabled: true,
      mode: "flat",
      provider_subaccount_code: "SUB_999",
      settlement: {
        amount_kobo: 90000,
        currency: "NGN",
        fees_kobo: null,
        fees_split: null,
        gateway_response: null,
        paid_at: "2026-05-21T12:01:00.000Z",
        provider_reference: "PSK-REF-456",
        provider_status: "success",
        split: null,
        subaccount: null,
        transaction_date: null,
        verified_at: "2026-05-21T12:05:00.000Z",
      },
    });

    expect(
      resolveMarketplaceRoutingMetadata({
        existingMetadata: {},
        paidAt: "2026-05-21T12:01:00.000Z",
        paystackPayload: {},
        reference: "PSK-REF-789",
      }),
    ).toBeNull();
  });
});
