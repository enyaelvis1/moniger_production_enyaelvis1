import { useState } from "react";
import {
  initializeWorkspaceSubscriptionCheckout,
  updateWorkspaceSubscription,
} from "@/lib/workspace-subscriptions";
import {
  getDefaultSubscriptionBillingCycle,
  isPaidSubscriptionSelection,
  type SubscriptionBillingCycle,
  type SubscriptionPlan,
  type WorkspaceSubscriptionActionResult,
} from "@/lib/subscriptions";

type SubscriptionFormState = {
  plan: SubscriptionPlan;
  billingCycle?: SubscriptionBillingCycle;
  businessId?: string;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const candidateError = error as { error?: unknown; message?: unknown };

    if (typeof candidateError.message === "string") {
      return candidateError.message;
    }

    if (typeof candidateError.error === "string") {
      return candidateError.error;
    }

    return JSON.stringify(error);
  }

  return fallbackMessage;
};

const executeSubscriptionAction = async (
  formState: SubscriptionFormState,
): Promise<WorkspaceSubscriptionActionResult> => {
  const billingCycle = formState.billingCycle ?? getDefaultSubscriptionBillingCycle(formState.plan);

  if (
    isPaidSubscriptionSelection({
      billingCycle,
      plan: formState.plan,
    })
  ) {
    return initializeWorkspaceSubscriptionCheckout({
      billingCycle,
      businessId: formState.businessId,
      plan: formState.plan,
    });
  }

  return updateWorkspaceSubscription({
    billingCycle,
    businessId: formState.businessId,
    plan: formState.plan,
  });
};

/**
 * Subscription management hook for public pricing pages
 * Handles direct free-plan activation and paid Paystack checkout initialization.
 */
export const useSubscriptionManagement = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (formState: SubscriptionFormState) => {
    setIsLoading(true);
    setError(null);

    try {
      return await executeSubscriptionAction(formState);
    } catch (err) {
      let errorMessage = "Failed to subscribe to plan";
      errorMessage = getErrorMessage(err, errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (formState: SubscriptionFormState) => {
    setIsLoading(true);
    setError(null);

    try {
      return await executeSubscriptionAction(formState);
    } catch (err) {
      let errorMessage = "Failed to upgrade plan";
      errorMessage = getErrorMessage(err, errorMessage);
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    error,
    handleSubscribe,
    handleUpgrade,
    isLoading,
  };
};
