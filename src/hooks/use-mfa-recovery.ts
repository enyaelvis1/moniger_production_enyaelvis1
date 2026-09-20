import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mfaRecoveryQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

type MfaRecoveryAction = "consume-code" | "generate-codes";

export type MfaRecoverySummary = {
  lastUsedAt: string | null;
  latestGeneratedAt: string | null;
  remainingCodes: number;
  totalCodes: number;
};

type GenerateRecoveryCodesPayload = {
  businessId?: string;
};

type GenerateRecoveryCodesResult = {
  codes: string[];
  generatedAt: string;
  remainingCodes: number;
};

type ConsumeRecoveryCodePayload = {
  code: string;
};

type ConsumeRecoveryCodeResult = {
  expiresAt: string;
  sessionId: string;
};

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

const recoverySummaryQueryKey = (userId: string) => ["mfa-recovery-summary", userId] as const;

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

    if (isResponseLike(context)) {
      const responseMessage = await getResponseErrorMessage(context);

      if (responseMessage) {
        return responseMessage;
      }
    }
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "We could not reach the account security recovery service.";
};

const invokeRecoveryAction = async <TResult>(
  action: MfaRecoveryAction,
  payload: ConsumeRecoveryCodePayload | GenerateRecoveryCodesPayload,
): Promise<TResult> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need an active session before using MFA recovery.");
  }

  const { data, error, response } = await supabase.functions.invoke("account-security-recovery", {
    body: {
      action,
      ...payload,
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
    throw new Error("The MFA recovery service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResult;
};

const fetchRecoverySummary = async (): Promise<MfaRecoverySummary> => {
  const { data, error } = await supabase.rpc("get_mfa_recovery_summary");

  if (error) {
    throw error;
  }

  const summary = Array.isArray(data) ? data[0] : data;

  return {
    lastUsedAt:
      summary && typeof summary === "object" && "last_used_at" in summary && typeof summary.last_used_at === "string"
        ? summary.last_used_at
        : null,
    latestGeneratedAt:
      summary &&
      typeof summary === "object" &&
      "latest_generated_at" in summary &&
      typeof summary.latest_generated_at === "string"
        ? summary.latest_generated_at
        : null,
    remainingCodes:
      summary && typeof summary === "object" && "remaining_codes" in summary && typeof summary.remaining_codes === "number"
        ? summary.remaining_codes
        : 0,
    totalCodes:
      summary && typeof summary === "object" && "total_codes" in summary && typeof summary.total_codes === "number"
        ? summary.total_codes
        : 0,
  };
};

export const useMfaRecoverySummaryData = (userId?: string) =>
  useQuery({
    queryKey: userId ? recoverySummaryQueryKey(userId) : ["mfa-recovery-summary", "guest"],
    queryFn: () => fetchRecoverySummary(),
    enabled: Boolean(userId),
    ...mfaRecoveryQueryOptions,
  });

export const useGenerateMfaRecoveryCodes = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: GenerateRecoveryCodesPayload) =>
      invokeRecoveryAction<GenerateRecoveryCodesResult>("generate-codes", payload),
    onSuccess: async () => {
      if (!userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: recoverySummaryQueryKey(userId) });
    },
  });
};

export const useConsumeMfaRecoveryCode = () =>
  useMutation({
    mutationFn: (payload: ConsumeRecoveryCodePayload) =>
      invokeRecoveryAction<ConsumeRecoveryCodeResult>("consume-code", payload),
  });
