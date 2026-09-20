import { supabase } from "@/lib/supabase";

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

export type WorkspacePayoutRequestResponse = {
  amount: number;
  billId: string;
  businessId: string;
  payoutId: string;
  payoutStatus: string;
  providerRecipientCode: string;
  providerReference: string;
  providerTransferCode: string | null;
  status: string;
  success: true;
};

export type WorkspacePayoutScheduleResponse = {
  amount: number;
  billId: string;
  businessId: string;
  payoutId: string;
  payoutStatus: string;
  scheduledFor: string;
  status: string;
  success: true;
};

export type WorkspacePayoutApproveResponse = {
  payoutId: string;
  payoutStatus: string;
  providerReference?: string | null;
  scheduledFor?: string | null;
  success: true;
};

export type WorkspacePayoutCancelResponse = {
  payoutId: string;
  payoutStatus: string;
  success: true;
};

export type WorkspacePayoutRescheduleResponse = {
  payoutId: string;
  payoutStatus: string;
  scheduledFor: string;
  success: true;
};

export type WorkspacePayoutReleaseResponse = {
  payoutId: string;
  success: true;
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

  return "We could not update the payout request.";
};

const normalizePayoutErrorMessage = (message: string) => {
  const normalizedMessage = message.trim();
  const lowerCaseMessage = normalizedMessage.toLowerCase();

  if (
    lowerCaseMessage.includes("failed to send a request to the edge function") ||
    lowerCaseMessage.includes("edge function unavailable")
  ) {
    return "We couldn’t reach the payout service right now. Please try again in a moment.";
  }

  if (lowerCaseMessage.includes("insufficient wallet balance")) {
    return "The wallet does not have enough available balance for this payout.";
  }

  if (lowerCaseMessage.includes("vendor needs bank details")) {
    return "Add the vendor’s bank details before paying this bill.";
  }

  if (lowerCaseMessage.includes("bank code")) {
    return "Add a bank code for this vendor bank before paying this bill.";
  }

  if (lowerCaseMessage.includes("invalid bank") || lowerCaseMessage.includes("account validation")) {
    return "The vendor bank details could not be verified. Please review the bank account and try again.";
  }

  if (lowerCaseMessage.includes("approval required")) {
    return "This payout needs approval before it can continue.";
  }

  if (lowerCaseMessage.includes("needs approval")) {
    return "This payout needs approval before it can continue.";
  }

  if (lowerCaseMessage.includes("rate limited")) {
    return "Payout requests are moving too quickly. Please wait a moment and try again.";
  }

  if (lowerCaseMessage.includes("per-transaction limit")) {
    return "This payout exceeds the workspace per-transaction limit.";
  }

  if (lowerCaseMessage.includes("daily payout limit")) {
    return "This payout would exceed the workspace daily payout limit.";
  }

  if (lowerCaseMessage.includes("weekly payout limit")) {
    return "This payout would exceed the workspace weekly payout limit.";
  }

  if (lowerCaseMessage.includes("paystack is not configured")) {
    return "Payouts are not fully configured yet. Please contact an admin.";
  }

  if (lowerCaseMessage.includes("scheduled execution time is required")) {
    return "Add a due date before scheduling this payout.";
  }

  if (lowerCaseMessage.includes("must be in the future")) {
    return "Choose a future payout date and time.";
  }

  if (lowerCaseMessage.includes("can only be cancelled while reserved")) {
    return "This payout can only be cancelled before it has been submitted.";
  }

  if (lowerCaseMessage.includes("can only be rescheduled while reserved")) {
    return "This payout can only be rescheduled before it has been submitted.";
  }

  if (lowerCaseMessage.includes("cannot be scheduled")) {
    return "This bill cannot be scheduled for payout in its current state.";
  }

  if (
    lowerCaseMessage.includes("temporarily") ||
    lowerCaseMessage.includes("timeout") ||
    lowerCaseMessage.includes("timed out") ||
    lowerCaseMessage.includes("unavailable") ||
    lowerCaseMessage.includes("service right now")
  ) {
    return "The payout provider is temporarily unavailable. Please try again in a moment.";
  }

  return normalizedMessage;
};

export const getWorkspacePayoutErrorMessage = (error: unknown, fallbackMessage = "Please try again.") => {
  if (error instanceof Error && error.message.trim()) {
    return normalizePayoutErrorMessage(error.message);
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return normalizePayoutErrorMessage(error.message);
  }

  return fallbackMessage;
};

const invokeWorkspacePayoutExecution = async <TResponse>(
  action:
    | "self.request-payout"
    | "self.release-payout"
    | "self.schedule-payout"
    | "self.cancel-scheduled-payout"
    | "self.reschedule-scheduled-payout"
    | "self.approve-payout"
    | "self.process-due-payouts",
  body: Record<string, unknown>,
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to be signed in before requesting a payout.");
  }

  const { data, error, response } = await supabase.functions.invoke("workspace-payout-execution", {
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
    throw new Error("The payout service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResponse;
};

export const requestWorkspaceBillPayout = ({
  billId,
  businessId,
  idempotencyKey,
}: {
  billId: string;
  businessId: string;
  idempotencyKey?: string | null;
}) =>
  invokeWorkspacePayoutExecution<WorkspacePayoutRequestResponse>("self.request-payout", {
    billId,
    businessId,
    idempotencyKey: idempotencyKey ?? null,
  });

export const scheduleWorkspaceBillPayout = ({
  billId,
  businessId,
  idempotencyKey,
  scheduledFor,
}: {
  billId: string;
  businessId: string;
  idempotencyKey?: string | null;
  scheduledFor: string;
}) =>
  invokeWorkspacePayoutExecution<WorkspacePayoutScheduleResponse>("self.schedule-payout", {
    billId,
    businessId,
    idempotencyKey: idempotencyKey ?? null,
    scheduledFor,
  });

export const cancelWorkspaceBillPayout = ({
  businessId,
  payoutId,
}: {
  businessId: string;
  payoutId: string;
}) =>
  invokeWorkspacePayoutExecution<WorkspacePayoutCancelResponse>("self.cancel-scheduled-payout", {
    businessId,
    payoutId,
  });

export const rescheduleWorkspaceBillPayout = ({
  businessId,
  payoutId,
  scheduledFor,
}: {
  businessId: string;
  payoutId: string;
  scheduledFor: string;
}) =>
  invokeWorkspacePayoutExecution<WorkspacePayoutRescheduleResponse>("self.reschedule-scheduled-payout", {
    businessId,
    payoutId,
    scheduledFor,
  });

export const releaseWorkspaceBillPayoutReservation = ({
  businessId,
  failureReason,
  payoutId,
}: {
  businessId: string;
  failureReason?: string | null;
  payoutId: string;
}) =>
  invokeWorkspacePayoutExecution<WorkspacePayoutReleaseResponse>("self.release-payout", {
    businessId,
    failureReason: failureReason ?? null,
    payoutId,
  });

export const approveWorkspaceBillPayout = ({
  businessId,
  payoutId,
}: {
  businessId: string;
  payoutId: string;
}) =>
  invokeWorkspacePayoutExecution<WorkspacePayoutApproveResponse>("self.approve-payout", {
    businessId,
    payoutId,
  });
