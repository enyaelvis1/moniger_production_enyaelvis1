import { supabase } from "@/lib/supabase";
import type { Tables } from "@/integrations/supabase/types";

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type WorkspaceWalletFundingSessionRecord = Tables<"workspace_wallet_funding_sessions">;

export type WorkspaceWalletFundingInitializationInput = {
  amount: number;
  businessId: string;
  payerName?: string | null;
  returnUrl?: string | null;
};

export type WorkspaceWalletFundingInitializationResponse = {
  checkoutUrl: string;
  fundingSession: WorkspaceWalletFundingSessionRecord;
  ok: true;
  providerReference: string;
};

export type WorkspaceWalletFundingVerificationResponse = {
  applied: boolean;
  balanceAfter: number;
  balanceBefore: number;
  fundingSession: WorkspaceWalletFundingSessionRecord;
  ledgerEntryId: string | null;
  message: string | null;
  ok: true;
  reservedAfter: number;
  reservedBefore: number;
  status: WorkspaceWalletFundingSessionRecord["status"];
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

  return "We could not update the wallet funding session.";
};

const normalizeWalletFundingErrorMessage = (message: string) => {
  const normalizedMessage = message.trim();
  const lowerCaseMessage = normalizedMessage.toLowerCase();

  if (
    lowerCaseMessage.includes("failed to send a request to the edge function") ||
    lowerCaseMessage.includes("edge function is not available") ||
    lowerCaseMessage.includes("edge function unavailable")
  ) {
    return "We couldn’t reach the wallet funding service right now. Please try again in a moment.";
  }

  if (lowerCaseMessage.includes("you need to be signed in")) {
    return "Please sign in again before funding your wallet.";
  }

  if (lowerCaseMessage.includes("a workspace is required")) {
    return "Select a workspace before funding your wallet.";
  }

  if (lowerCaseMessage.includes("app_base_url is required")) {
    return "Wallet funding is not fully configured yet. Please contact an admin.";
  }

  if (lowerCaseMessage.includes("payment provider rejected") || lowerCaseMessage.includes("paystack")) {
    return "Paystack rejected this top-up request. Please check the amount and try again.";
  }

  if (lowerCaseMessage.includes("could not verify") || lowerCaseMessage.includes("not complete yet")) {
    return "We couldn’t confirm this top-up yet. Please complete checkout and try again.";
  }

  return normalizedMessage;
};

export const getWorkspaceWalletFundingErrorMessage = (error: unknown, fallbackMessage = "Please try again.") => {
  if (error instanceof Error && error.message.trim()) {
    return normalizeWalletFundingErrorMessage(error.message);
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return normalizeWalletFundingErrorMessage(error.message);
  }

  return fallbackMessage;
};

const invokeWorkspaceWalletFunding = async <TResponse>(
  action: "self.initialize-topup" | "self.verify-topup",
  body: Record<string, unknown>,
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to be signed in before funding a workspace wallet.");
  }

  const { data, error, response } = await supabase.functions.invoke("workspace-wallet-funding", {
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
    throw new Error("The wallet funding service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResponse;
};

export const initializeWorkspaceWalletFunding = (input: WorkspaceWalletFundingInitializationInput) =>
  invokeWorkspaceWalletFunding<WorkspaceWalletFundingInitializationResponse>("self.initialize-topup", {
    amount: input.amount,
    businessId: input.businessId,
    payerName: input.payerName ?? null,
    returnUrl: input.returnUrl ?? null,
  });

export const verifyWorkspaceWalletFunding = (reference: string) =>
  invokeWorkspaceWalletFunding<WorkspaceWalletFundingVerificationResponse>("self.verify-topup", {
    reference,
  });

export const fetchWorkspaceWalletFundingSessions = async (businessId: string) => {
  const { data, error } = await supabase
    .from("workspace_wallet_funding_sessions")
    .select(
      "id, business_id, wallet_id, provider, amount, currency, status, provider_reference, checkout_url, callback_url, payer_email, payer_name, access_code, provider_metadata, failure_reason, verified_at, completed_at, ledger_entry_id, created_by, updated_by, created_at, updated_at",
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return (data ?? []) as WorkspaceWalletFundingSessionRecord[];
};
