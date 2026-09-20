import { supabase } from "@/lib/supabase";
import type {
  SubscriptionBillingCycle,
  SubscriptionPlan,
  WorkspaceSubscriptionActionResult,
} from "@/lib/subscriptions";

type WorkspaceSubscriptionAction = "self.cancel" | "self.initialize-checkout" | "self.update" | "self.verify-checkout";
type WorkspaceSubscriptionPublicAction = "public.confirmation-status";

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

  return "We could not update your workspace subscription.";
};

const invokeWorkspaceSubscriptions = async <TResponse>(
  action: WorkspaceSubscriptionAction,
  body: Record<string, unknown>,
) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to be signed in before managing workspace subscriptions.");
  }

  const { data, error, response } = await supabase.functions.invoke("workspace-subscriptions", {
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
    throw new Error("The workspace subscription service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResponse;
};

const invokePublicWorkspaceSubscriptions = async <TResponse>(
  action: WorkspaceSubscriptionPublicAction,
  body: Record<string, unknown>,
) => {
  const { data, error, response } = await supabase.functions.invoke("workspace-subscriptions", {
    body: {
      action,
      ...body,
    },
  });

  if (error) {
    const responseMessage = await getResponseErrorMessage(isResponseLike(response) ? response : undefined);
    throw new Error(responseMessage ?? (await getFunctionErrorMessage(error)));
  }

  if (!data || typeof data !== "object") {
    throw new Error("The workspace subscription service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new Error(data.error);
  }

  return data as TResponse;
};

export const updateWorkspaceSubscription = ({
  billingCycle,
  businessId,
  plan,
}: {
  billingCycle: SubscriptionBillingCycle;
  businessId?: string;
  plan: SubscriptionPlan;
}) =>
  invokeWorkspaceSubscriptions<WorkspaceSubscriptionActionResult>("self.update", {
    billingCycle,
    businessId: businessId ?? null,
    plan,
  });

export const cancelWorkspaceSubscription = ({ businessId }: { businessId?: string }) =>
  invokeWorkspaceSubscriptions<WorkspaceSubscriptionActionResult>("self.cancel", {
    businessId: businessId ?? null,
  });

export const initializeWorkspaceSubscriptionCheckout = ({
  billingCycle,
  businessId,
  plan,
}: {
  billingCycle: SubscriptionBillingCycle;
  businessId?: string;
  plan: SubscriptionPlan;
}) =>
  invokeWorkspaceSubscriptions<WorkspaceSubscriptionActionResult>("self.initialize-checkout", {
    billingCycle,
    businessId: businessId ?? null,
    plan,
  });

export const verifyWorkspaceSubscriptionCheckout = ({
  businessId,
  reference,
}: {
  businessId?: string;
  reference: string;
}) =>
  invokeWorkspaceSubscriptions<WorkspaceSubscriptionActionResult>("self.verify-checkout", {
    businessId: businessId ?? null,
    reference,
  });

export const getWorkspaceSubscriptionConfirmationStatus = ({ reference }: { reference: string }) =>
  invokePublicWorkspaceSubscriptions<WorkspaceSubscriptionActionResult>("public.confirmation-status", {
    reference,
  });
