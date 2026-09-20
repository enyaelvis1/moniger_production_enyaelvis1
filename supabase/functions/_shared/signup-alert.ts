export const signupPlans = ["starter", "growth", "business"] as const;
export type SignupPlan = (typeof signupPlans)[number];

type SignupAlertContextInput = {
  email: string;
  emailConfirmedAt?: string | null;
  environment: string;
  plan: string;
  userId: string;
  userMetadata: Record<string, unknown>;
};

export const buildSignupAlertContext = ({
  email,
  emailConfirmedAt,
  environment,
  plan,
  userId,
  userMetadata,
}: SignupAlertContextInput) => {
  if (!userId || !email || !signupPlans.includes(plan as SignupPlan)) {
    throw new Error("A valid signup context is required.");
  }

  const recordedPlan = typeof userMetadata.signup_plan === "string" ? userMetadata.signup_plan : "";
  if (recordedPlan && recordedPlan !== plan) {
    throw new Error("Signup plan verification failed.");
  }

  return {
    businessName: typeof userMetadata.business_name === "string" && userMetadata.business_name.trim() ? userMetadata.business_name.trim() : "Not provided",
    email: email.trim().toLowerCase(),
    environment: environment.trim() || "production",
    fullName: typeof userMetadata.name === "string" && userMetadata.name.trim()
      ? userMetadata.name.trim()
      : typeof userMetadata.full_name === "string" && userMetadata.full_name.trim()
        ? userMetadata.full_name.trim()
        : "Not provided",
    plan: plan as SignupPlan,
    signupStatus: emailConfirmedAt ? "active" : "email_confirmation_pending",
  };
};

export const isDuplicateSignupAlertError = (code: string | null | undefined) => code === "23505";

export const buildSignupDeliveryUpdate = ({
  deliveredAt,
  failureReason,
  providerMessageId,
}: {
  deliveredAt?: string;
  failureReason?: string;
  providerMessageId?: string | null;
}) => failureReason
  ? { delivery_status: "failed", failure_reason: failureReason }
  : { delivered_at: deliveredAt ?? new Date().toISOString(), delivery_status: "sent", provider_message_id: providerMessageId ?? null };
