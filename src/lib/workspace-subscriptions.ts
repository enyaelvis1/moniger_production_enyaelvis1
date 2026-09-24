import { supabase } from "@/lib/supabase";
import type {
  SubscriptionBillingCycle,
  SubscriptionPlan,
  WorkspaceSubscriptionActionResult,
} from "@/lib/subscriptions";

type WorkspaceSubscriptionAction = "self.cancel" | "self.initialize-checkout" | "self.update" | "self.verify-checkout";
type WorkspaceSubscriptionPublicAction = "public.confirmation-status";

export type WorkspaceSubscriptionErrorCode =
  | "CHECKOUT_PENDING"
  | "PROVIDER_PENDING"
  | "CHECKOUT_MISMATCH"
  | "CHECKOUT_WORKSPACE_MISMATCH"
  | "CHECKOUT_WORKSPACE_FORBIDDEN";

export class WorkspaceSubscriptionError extends Error {
  readonly code: WorkspaceSubscriptionErrorCode | null;
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, options: { code?: WorkspaceSubscriptionErrorCode | null; retryable?: boolean; status?: number | null } = {}) {
    super(message);
    this.name = "WorkspaceSubscriptionError";
    this.code = options.code ?? null;
    this.retryable = options.retryable ?? false;
    this.status = options.status ?? null;
  }
}

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

const getResponseError = async (response: ResponseLike | undefined) => {
  if (!response) {
    return null;
  }

  try {
    const payload = await response.clone().json();

    if (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string") {
      const code = "code" in payload && typeof payload.code === "string" ? payload.code : null;
      const retryable = "retryable" in payload && typeof payload.retryable === "boolean" ? payload.retryable : false;
      return { code, message: payload.error, retryable };
    }
  } catch {
    try {
      const text = await response.clone().text();

      if (text.trim()) {
        return { code: null, message: text.trim(), retryable: false };
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
    const responseError = await getResponseError(isResponseLike(context) ? context : undefined);

    if (responseError) {
      return responseError.message;
    }
  }

  if (typeof error === "object" && error && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "We could not update your workspace subscription.";
};

const toSubscriptionError = (error: unknown, response: ResponseLike | undefined) => {
  const responseErrorPromise = getResponseError(response);
  return responseErrorPromise.then(async (responseError) => {
    const message = responseError?.message ?? (await getFunctionErrorMessage(error));
    const code = responseError?.code;
    const validCode = code === "CHECKOUT_PENDING" || code === "PROVIDER_PENDING" || code === "CHECKOUT_MISMATCH" || code === "CHECKOUT_WORKSPACE_MISMATCH" || code === "CHECKOUT_WORKSPACE_FORBIDDEN" ? code : null;
    return new WorkspaceSubscriptionError(message, {
      code: validCode,
      retryable: responseError?.retryable ?? (validCode === "CHECKOUT_PENDING" || validCode === "PROVIDER_PENDING"),
      status: typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : null,
    });
  });
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
    throw await toSubscriptionError(error, isResponseLike(response) ? response : undefined);
  }

  if (!data || typeof data !== "object") {
    throw new Error("The workspace subscription service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new WorkspaceSubscriptionError(data.error, {
      code: "code" in data && typeof data.code === "string" ? (data.code as WorkspaceSubscriptionErrorCode) : null,
      retryable: "retryable" in data && data.retryable === true,
    });
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
    throw await toSubscriptionError(error, isResponseLike(response) ? response : undefined);
  }

  if (!data || typeof data !== "object") {
    throw new Error("The workspace subscription service returned an unexpected response.");
  }

  if ("error" in data && typeof data.error === "string") {
    throw new WorkspaceSubscriptionError(data.error);
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
