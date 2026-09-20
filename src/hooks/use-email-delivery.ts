import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Enums } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabase";

type EmailDeliveryAction = "digest-preview" | "invoice-delivery" | "team-invite";

type EmailDeliveryResponse = {
  deliveryId: string;
  provider: string;
  recipientEmail: string;
  status: "failed" | "sent";
  subject: string;
};

type DigestPreviewEmailInput = {
  businessId: string;
};

type TeamInviteEmailInput = {
  businessId: string;
  inviteeEmail: string;
  invitationToken?: string | null;
  role: Enums<"business_role">;
};

type InvoiceDeliveryEmailInput = {
  businessId: string;
  email: string;
  invoiceId: string;
  message?: string | null;
  subject: string;
};

type ResponseLike = {
  clone: () => ResponseLike;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
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

const getFunctionErrorMessage = async (error: unknown) => {
  if (typeof error === "object" && error && "context" in error) {
    const context = (error as { context?: unknown }).context;

    if (isResponseLike(context)) {
      try {
        const payload = await context.clone().json();

        if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
          return payload.error;
        }
      } catch {
        try {
          const text = await context.clone().text();

          if (text.trim()) {
            return text.trim();
          }
        } catch {
          // Fall through to the generic message below.
        }
      }
    }
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "We could not reach the email delivery service.";
};

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

const invokeEmailDelivery = async (
  action: EmailDeliveryAction,
  payload: DigestPreviewEmailInput | InvoiceDeliveryEmailInput | TeamInviteEmailInput,
): Promise<EmailDeliveryResponse> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to be signed in before sending workspace emails.");
  }

  const { data, error, response } = await supabase.functions.invoke("workspace-email-delivery", {
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
    throw new Error("The email delivery service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as EmailDeliveryResponse;
};

export const useSendDigestPreviewEmail = () =>
  useMutation({
    mutationFn: (payload: DigestPreviewEmailInput) => invokeEmailDelivery("digest-preview", payload),
  });

export const useSendTeamInviteEmail = () =>
  useMutation({
    mutationFn: (payload: TeamInviteEmailInput) => invokeEmailDelivery("team-invite", payload),
  });

export const useSendInvoiceDeliveryEmail = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InvoiceDeliveryEmailInput) => invokeEmailDelivery("invoice-delivery", payload),
    onSuccess: async () => {
      if (!businessId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["invoices", businessId] }),
        queryClient.invalidateQueries({ queryKey: ["payments", businessId] }),
        queryClient.invalidateQueries({ queryKey: ["operations", businessId] }),
        ...(userId ? [queryClient.invalidateQueries({ queryKey: ["notifications", businessId, userId] })] : []),
      ]);
    },
  });
};
