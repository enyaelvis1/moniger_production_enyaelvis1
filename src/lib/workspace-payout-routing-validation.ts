export type ValidationMessage = {
  description: string;
  title: string;
};

export type WorkspacePayoutAccountValidationInput = {
  accountName?: string | null;
  accountNumber: string;
  bankId?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  syncProvider: boolean;
};

export type WorkspacePayoutAccountValidationResult =
  | {
    ok: false;
    error: ValidationMessage;
  }
  | {
    normalized: {
      accountName: string | null;
      accountNumber: string;
      bankId: string | null;
      countryCode: string;
      currency: string;
    };
    ok: true;
  };

export type WorkspaceSplitConfigValidationInput = {
  currency?: string | null;
  flatFeeAmount?: number;
  percentageFee?: number;
  splitMode: "flat" | "percentage";
  syncProvider: boolean;
};

export type WorkspaceSplitConfigValidationResult =
  | {
    ok: false;
    error: ValidationMessage;
  }
  | {
    normalized: {
      basisPoints: number | null;
      currency: string;
      flatFeeAmount: number | null;
    };
    ok: true;
  };

export const paystackLiveSyncCountryCodes = ["GH", "NG"] as const;

const normalizeOptionalText = (value: string | null | undefined) => {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";
  return trimmed || null;
};

export const validateWorkspacePayoutAccountInput = (
  input: WorkspacePayoutAccountValidationInput,
): WorkspacePayoutAccountValidationResult => {
  const normalized = {
    accountName: normalizeOptionalText(input.accountName),
    accountNumber: (input.accountNumber ?? "").replace(/\D/g, ""),
    bankId: normalizeOptionalText(input.bankId),
    countryCode: normalizeOptionalText(input.countryCode)?.toUpperCase() ?? "NG",
    currency: normalizeOptionalText(input.currency)?.toUpperCase() ?? "NGN",
  };

  if (!normalized.bankId) {
    return {
      error: {
        title: "Choose a bank",
        description: "Select the bank account that should receive subscriber payouts.",
      },
      ok: false,
    };
  }

  if (!normalized.accountNumber) {
    return {
      error: {
        title: "Account number required",
        description: "Enter the payout account number before saving this routing setup.",
      },
      ok: false,
    };
  }

  if (normalized.countryCode.length !== 2) {
    return {
      error: {
        title: "Invalid country code",
        description: "Use a 2-letter country code like NG before saving this payout destination.",
      },
      ok: false,
    };
  }

  if (normalized.currency.length !== 3) {
    return {
      error: {
        title: "Invalid routing currency",
        description: "Use a 3-letter routing currency like NGN before saving this payout destination.",
      },
      ok: false,
    };
  }

  if (!input.syncProvider && !normalized.accountName) {
    return {
      error: {
        title: "Account name required",
        description: "Add the account name when saving a draft without Paystack sync.",
      },
      ok: false,
    };
  }

  if (input.syncProvider && paystackLiveSyncCountryCodes.includes(normalized.countryCode as (typeof paystackLiveSyncCountryCodes)[number])) {
    if (normalized.accountNumber.length !== 10) {
      return {
        error: {
          title: "10-digit account number required",
          description: `Paystack account resolution expects a 10-digit account number for ${normalized.countryCode} payouts.`,
        },
        ok: false,
      };
    }
  }

  if (input.syncProvider && !paystackLiveSyncCountryCodes.includes(normalized.countryCode as (typeof paystackLiveSyncCountryCodes)[number])) {
    return {
      error: {
        title: "Draft only for this country",
        description: "Live Paystack payout sync is currently supported for NG and GH account resolution only. Save as draft first if needed.",
      },
      ok: false,
    };
  }

  return {
    normalized,
    ok: true,
  };
};

export const validateWorkspaceSplitConfigInput = (
  input: WorkspaceSplitConfigValidationInput,
): WorkspaceSplitConfigValidationResult => {
  const normalizedCurrency = normalizeOptionalText(input.currency)?.toUpperCase() ?? "NGN";

  if (normalizedCurrency.length !== 3) {
    return {
      error: {
        title: "Invalid routing currency",
        description: "Use a valid 3-letter routing currency like NGN before saving the fee rule.",
      },
      ok: false,
    };
  }

  if (input.splitMode === "percentage") {
    const percentageValue = Number(input.percentageFee);

    if (!Number.isFinite(percentageValue) || percentageValue < 0 || percentageValue > 100) {
      return {
        error: {
          title: "Invalid percentage fee",
          description: "Enter a number between 0 and 100 for the Moniger percentage fee.",
        },
        ok: false,
      };
    }

    const basisPoints = Math.round(percentageValue * 100);

    if (input.syncProvider && basisPoints % 100 !== 0) {
      return {
        error: {
          title: "Whole percentages required for Paystack sync",
          description: "Use values like 5, 10, or 15 when syncing a percentage split to Paystack.",
        },
        ok: false,
      };
    }

    return {
      normalized: {
        basisPoints,
        currency: normalizedCurrency,
        flatFeeAmount: null,
      },
      ok: true,
    };
  }

  const flatFeeAmount = Number(input.flatFeeAmount);

  if (!Number.isFinite(flatFeeAmount) || flatFeeAmount < 0) {
    return {
      error: {
        title: "Invalid flat fee",
        description: "Enter a positive number for the Moniger flat fee amount.",
      },
      ok: false,
    };
  }

  return {
    normalized: {
      basisPoints: null,
      currency: normalizedCurrency,
      flatFeeAmount,
    },
    ok: true,
  };
};
