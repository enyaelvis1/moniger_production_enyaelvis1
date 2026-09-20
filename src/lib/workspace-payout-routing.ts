import { supabase } from "@/lib/supabase";

type WorkspacePayoutRoutingAction =
  | "self.get-config"
  | "self.upsert-payout-account"
  | "self.upsert-split-config"
  | "admin.get-config"
  | "admin.upsert-split-config";

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type WorkspacePayoutAccountRecord = {
  accountName: string;
  accountNumberLast4: string | null;
  bankId: string | null;
  bankName: string;
  businessId: string;
  countryCode: string;
  createdAt: string;
  currency: string;
  id: string;
  isDefault: boolean;
  lastSyncError: string | null;
  lastVerifiedAt: string | null;
  provider: string;
  providerMetadata: Record<string, unknown>;
  providerSettlementBankCode: string | null;
  providerSubaccountCode: string | null;
  providerSubaccountId: string | null;
  status: string;
  updatedAt: string;
};

export type WorkspaceSplitConfigRecord = {
  businessId: string;
  currency: string;
  id: string;
  lastSyncError: string | null;
  monigerFeeFlatAmount: number;
  monigerFeePercentageBasisPoints: number | null;
  payoutAccountId: string | null;
  provider: string;
  providerMetadata: Record<string, unknown>;
  providerSplitCode: string | null;
  providerSplitId: string | null;
  splitMode: "flat" | "percentage";
  status: string;
  updatedAt: string;
};

export type WorkspacePayoutRoutingSyncResult = {
  attempted: boolean;
  message: string;
  providerSplitCode?: string | null;
  providerSplitId?: string | null;
  providerSubaccountCode?: string | null;
  resolvedAccountName?: string | null;
  resolvedBankCode?: string | null;
  status: "failed" | "not_required" | "skipped" | "succeeded";
};

export type WorkspacePayoutRoutingConfigResult = {
  ok: true;
  payoutAccount: WorkspacePayoutAccountRecord | null;
  splitConfig: WorkspaceSplitConfigRecord | null;
  sync?: WorkspacePayoutRoutingSyncResult;
};

export type WorkspacePayoutAccountInput = {
  accountName?: string | null;
  accountNumber: string;
  bankId?: string | null;
  bankName?: string | null;
  countryCode?: string | null;
  currency?: string | null;
  providerSettlementBankCode?: string | null;
  syncProvider?: boolean;
};

export type WorkspaceSplitConfigInput = {
  currency?: string | null;
  monigerFeeFlatAmount?: number | null;
  monigerFeePercentageBasisPoints?: number | null;
  splitMode: "flat" | "percentage";
  syncProvider?: boolean;
};

const isResponseLike = (value: unknown): value is ResponseLike =>
  typeof value === "object" &&
  value !== null &&
  "clone" in value &&
  typeof value.clone === "function" &&
  "json" in value &&
  typeof value.json === "function" &&
  "text" in value &&
  typeof value.text === "function";

const getResponseErrorMessage = async (response: ResponseLike | undefined) => {
  if (!response) {
    return null;
  }

  try {
    const payload = await response.clone().json();

    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch {
    try {
      const text = await response.clone().text();

      if (text.trim()) {
        return text.trim();
      }
    } catch {
      return null;
    }
  }

  return null;
};

const getFunctionErrorMessage = async (error: unknown) => {
  if (typeof error === "object" && error && "context" in error) {
    const context = (error as { context?: unknown }).context;
    const responseMessage = await getResponseErrorMessage(isResponseLike(context) ? context : undefined);

    if (responseMessage) {
      return responseMessage;
    }
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "We could not update workspace payout routing.";
};

const invokeWorkspacePayoutRouting = async <TResponse>(
  action: WorkspacePayoutRoutingAction,
  body: Record<string, unknown>,
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to be signed in before managing workspace payout routing.");
  }

  const { data, error, response } = await supabase.functions.invoke("workspace-payout-routing", {
    body: {
      action,
      ...body,
    },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    const responseMessage = await getResponseErrorMessage(isResponseLike(response) ? response : undefined);
    throw new Error(responseMessage ?? (await getFunctionErrorMessage(error)));
  }

  if (!data || typeof data !== "object") {
    throw new Error("The workspace payout routing service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResponse;
};

export const getWorkspacePayoutRoutingConfig = (businessId?: string) =>
  invokeWorkspacePayoutRouting<WorkspacePayoutRoutingConfigResult>("self.get-config", {
    businessId: businessId ?? null,
  });

export const upsertWorkspacePayoutAccount = (businessId: string, values: WorkspacePayoutAccountInput) =>
  invokeWorkspacePayoutRouting<WorkspacePayoutRoutingConfigResult>("self.upsert-payout-account", {
    accountName: values.accountName ?? null,
    accountNumber: values.accountNumber,
    bankId: values.bankId ?? null,
    bankName: values.bankName ?? null,
    businessId,
    countryCode: values.countryCode ?? null,
    currency: values.currency ?? null,
    providerSettlementBankCode: values.providerSettlementBankCode ?? null,
    syncProvider: values.syncProvider ?? true,
  });

export const upsertWorkspaceSplitConfig = (businessId: string, values: WorkspaceSplitConfigInput) =>
  invokeWorkspacePayoutRouting<WorkspacePayoutRoutingConfigResult>("self.upsert-split-config", {
    businessId,
    currency: values.currency ?? null,
    monigerFeeFlatAmount: values.monigerFeeFlatAmount ?? null,
    monigerFeePercentageBasisPoints: values.monigerFeePercentageBasisPoints ?? null,
    splitMode: values.splitMode,
    syncProvider: values.syncProvider ?? true,
  });

export const getAdminWorkspacePayoutRoutingConfig = (businessId: string) =>
  invokeWorkspacePayoutRouting<WorkspacePayoutRoutingConfigResult>("admin.get-config", {
    businessId,
  });

export const upsertAdminWorkspaceSplitConfig = (businessId: string, values: WorkspaceSplitConfigInput) =>
  invokeWorkspacePayoutRouting<WorkspacePayoutRoutingConfigResult>("admin.upsert-split-config", {
    businessId,
    currency: values.currency ?? null,
    monigerFeeFlatAmount: values.monigerFeeFlatAmount ?? null,
    monigerFeePercentageBasisPoints: values.monigerFeePercentageBasisPoints ?? null,
    splitMode: values.splitMode,
    syncProvider: values.syncProvider ?? true,
  });
