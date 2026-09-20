import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Check, CheckCircle2, Eye, EyeOff, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell, {
  AuthCardHeader,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { supabase } from "@/lib/supabase";
import { defaultSubscriptionCatalog, isSubscriptionPlan, type SubscriptionPlan } from "@/lib/subscriptions";

const getPasswordStrength = (
  t: (key: string, params?: Record<string, string | number>) => string,
  password: string,
): { label: string; score: number; fillClassName: string; textClassName: string } => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return {
      label: t("auth.register.passwordStrength.weak"),
      score: 1,
      fillClassName: "bg-[#DC2626]",
      textClassName: "text-[#DC2626]",
    };
  }

  if (score <= 2) {
    return {
      label: t("auth.register.passwordStrength.fair"),
      score: 2,
      fillClassName: "bg-[#D97706]",
      textClassName: "text-[#D97706]",
    };
  }

  return {
    label: t("auth.register.passwordStrength.strong"),
    score: 3,
    fillClassName: "bg-[#16A34A]",
    textClassName: "text-[#16A34A]",
  };
};

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const isValidEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const checkEmailRegistration = async (candidateEmail: string) => {
  const { data, error } = await supabase.rpc("is_email_registered", {
    p_email: candidateEmail,
  });

  return {
    taken: Boolean(data),
    error: error?.message ?? null,
  };
};

const getStepOneValidationMessage = (
  t: (key: string, params?: Record<string, string | number>) => string,
  businessName: string,
  fullName: string,
) => {
  const normalizedBusinessName = normalizeWhitespace(businessName);
  const normalizedFullName = normalizeWhitespace(fullName);

  if (!normalizedBusinessName) {
    return t("auth.register.validation.businessNameRequired");
  }

  if (normalizedBusinessName.length < 2) {
    return t("auth.register.validation.businessNameTooShort");
  }

  if (!normalizedFullName) {
    return t("auth.register.validation.enterFullName");
  }

  const nameParts = normalizedFullName.split(" ").filter(Boolean);

  if (nameParts.length < 2) {
    return t("auth.register.validation.enterFirstAndLastName");
  }

  const firstName = nameParts[0] ?? "";
  const lastName = nameParts[nameParts.length - 1] ?? "";

  if (firstName.length < 2 || lastName.length < 2) {
    return t("auth.register.validation.useLongerNames");
  }

  if (!nameParts.every((part) => /^[\p{L}][\p{L}'-]*$/u.test(part))) {
    return t("auth.register.nameCharactersOnly");
  }

  return "";
};

const getRegistrationErrorMessage = (
  t: (key: string, params?: Record<string, string | number>) => string,
  error: unknown,
) => {
  const message =
    typeof error === "object" && error && "message" in error && typeof error.message === "string"
      ? error.message
      : t("auth.register.registrationFailed");

  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("rate limit")) {
    return t("auth.register.rateLimited");
  }

  if (normalizedMessage.includes("already registered") || normalizedMessage.includes("already been registered")) {
    return t("auth.register.validation.accountExists");
  }

  if (normalizedMessage.includes("invalid email")) {
    return t("auth.register.validation.invalidEmail");
  }

  if (normalizedMessage.includes("password")) {
    return t("auth.register.validation.passwordMessage", { message });
  }

  return message;
};

type RegisterSuccessState =
  | {
      email: string;
      redirectToDashboard: boolean;
    }
  | null;

type EmailAvailabilityState = {
  email: string;
  status: "idle" | "checking" | "available" | "taken" | "error";
};

const DASHBOARD_REDIRECT_DELAY_MS = 6000;

const registrationPlanOptions: Array<{
  plan: SubscriptionPlan;
  eyebrow: string;
  paymentLabel: string;
}> = [
  { plan: "starter", eyebrow: "Start free", paymentLabel: "Free trial" },
  { plan: "growth", eyebrow: "For growing teams", paymentLabel: "Pay with Paystack" },
  { plan: "business", eyebrow: "For finance operations", paymentLabel: "Pay with Paystack" },
];

const getRegistrationDestination = (nextPath: string | null, plan: SubscriptionPlan) => {
  if (nextPath?.startsWith("/")) {
    return nextPath;
  }

  return plan === "starter" ? "/dashboard" : `/pricing?subscribe=${plan}`;
};

const getPrefilledEmailFromState = (state: unknown) => {
  if (!state || typeof state !== "object" || !("email" in state)) {
    return "";
  }

  const candidateEmail = state.email;
  return typeof candidateEmail === "string" ? candidateEmail : "";
};

const RegisterPage = () => {
  const { signUp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const [searchParams] = useSearchParams();
  const inviteEmail = searchParams.get("email") ?? getPrefilledEmailFromState(location.state);
  const nextPath = searchParams.get("next");
  const directPlan = searchParams.get("subscribe");
  const initialSelectedPlan: SubscriptionPlan = useMemo(() => {
    if (isSubscriptionPlan(directPlan)) {
      return directPlan;
    }

    if (!nextPath?.startsWith("/")) {
      return "starter";
    }

    const plan = new URL(nextPath, window.location.origin).searchParams.get("subscribe");
    return isSubscriptionPlan(plan) ? plan : "starter";
  }, [directPlan, nextPath]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(initialSelectedPlan);
  useEffect(() => {
    setSelectedPlan(initialSelectedPlan);
  }, [initialSelectedPlan]);
  const selectedPlanDetails = defaultSubscriptionCatalog[selectedPlan];
  const selectedPlanLabel = selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1);
  const registrationDestination = getRegistrationDestination(nextPath, selectedPlan);
  const loginPath = `/login?next=${encodeURIComponent(registrationDestination)}`;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState({
    businessName: "",
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successState, setSuccessState] = useState<RegisterSuccessState>(null);
  const [redirectRemainingMs, setRedirectRemainingMs] = useState(DASHBOARD_REDIRECT_DELAY_MS);
  const [emailAvailability, setEmailAvailability] = useState<EmailAvailabilityState>({
    email: "",
    status: "idle",
  });
  const signUpInFlightRef = useRef(false);
  const emailCheckRequestRef = useRef(0);

  const setEmailAvailabilityStatus = (
    email: string,
    status: EmailAvailabilityState["status"],
  ) => {
    setEmailAvailability((currentState) =>
      currentState.email === email && currentState.status === status
        ? currentState
        : { email, status },
    );
  };

  const resetEmailAvailability = (email = "") => {
    emailCheckRequestRef.current += 1;
    setEmailAvailabilityStatus(email, "idle");
  };

  const strength = useMemo(() => getPasswordStrength(t, form.password), [form.password, t]);
  const stepOneValidationMessage = useMemo(
    () => getStepOneValidationMessage(t, form.businessName, form.fullName),
    [form.businessName, form.fullName, t],
  );
  const normalizedBusinessName = useMemo(() => normalizeWhitespace(form.businessName), [form.businessName]);
  const normalizedFullName = useMemo(() => normalizeWhitespace(form.fullName), [form.fullName]);
  const normalizedEmail = useMemo(() => normalizeEmail(form.email), [form.email]);
  const emailHasValidFormat = useMemo(() => isValidEmailAddress(normalizedEmail), [normalizedEmail]);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (error) setError("");
    if (field === "email") {
      resetEmailAvailability();
    }
    setForm((currentForm) => ({ ...currentForm, [field]: event.target.value }));
  };

  const canContinue = step === 1 || !stepOneValidationMessage;

  const canSubmit = Boolean(
    agreed &&
      !stepOneValidationMessage &&
      normalizedEmail &&
      emailHasValidFormat &&
      form.password.length >= 8 &&
      form.password === form.confirmPassword &&
      emailAvailability.status !== "checking" &&
      emailAvailability.status !== "taken",
  );

  const redirectSecondsRemaining = Math.max(1, Math.ceil(redirectRemainingMs / 1000));
  const redirectProgress = Math.max(0, (redirectRemainingMs / DASHBOARD_REDIRECT_DELAY_MS) * 100);
  const emailHelperMessage = useMemo(() => {
    if (!normalizedEmail) {
      return "";
    }

    if (!emailHasValidFormat) {
      return t("auth.register.enterValidEmail");
    }

    if (emailAvailability.email !== normalizedEmail) {
      return "";
    }

    if (emailAvailability.status === "checking") {
      return t("auth.register.checkingAvailability");
    }

    if (emailAvailability.status === "taken") {
      return t("auth.register.emailTaken");
    }

    if (emailAvailability.status === "available") {
      return t("auth.register.emailAvailable");
    }

    if (emailAvailability.status === "error") {
      return t("auth.register.emailCouldNotVerify");
    }

    return "";
  }, [emailAvailability.email, emailAvailability.status, emailHasValidFormat, normalizedEmail, t]);
  const emailHelperClassName = useMemo(() => {
    if (emailAvailability.status === "checking") {
      return "text-[#677391]";
    }

    if (emailAvailability.status === "available") {
      return "text-[#16A34A]";
    }

    return "text-[#DC2626]";
  }, [emailAvailability.status]);

  const getPostSignupPath = () => {
    return getRegistrationDestination(nextPath, selectedPlan);
  };

  const openDashboard = () => {
    navigate(getPostSignupPath(), { replace: true });
  };

  const goToPreviousStep = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setError("");
    setStep((currentStep) => (currentStep === 3 ? 2 : 1));
  };

  useEffect(() => {
    if (!inviteEmail) {
      return;
    }

    setForm((currentForm) =>
      currentForm.email
        ? currentForm
        : {
            ...currentForm,
            email: inviteEmail,
          },
    );
  }, [inviteEmail]);

  const checkEmailAvailability = async (emailToCheck = normalizedEmail) => {
    const candidateEmail = normalizeEmail(emailToCheck);

    if (!candidateEmail || !isValidEmailAddress(candidateEmail)) {
      setEmailAvailabilityStatus(candidateEmail, "idle");
      return { taken: false, error: null as string | null };
    }

    if (emailAvailability.email === candidateEmail) {
      if (emailAvailability.status === "available") {
        return { taken: false, error: null as string | null };
      }

      if (emailAvailability.status === "taken") {
        return { taken: true, error: null as string | null };
      }
    }

    const requestId = ++emailCheckRequestRef.current;
    setEmailAvailabilityStatus(candidateEmail, "checking");
    const result = await checkEmailRegistration(candidateEmail);

    if (requestId !== emailCheckRequestRef.current) {
      return { taken: false, error: null as string | null };
    }

    if (result.error) {
      setEmailAvailabilityStatus(candidateEmail, "error");
      return { taken: false, error: result.error };
    }

    const isTaken = result.taken;
    setEmailAvailabilityStatus(candidateEmail, isTaken ? "taken" : "available");

    return { taken: isTaken, error: null as string | null };
  };

  useEffect(() => {
    if (!successState?.redirectToDashboard) {
      setRedirectRemainingMs(DASHBOARD_REDIRECT_DELAY_MS);
      return;
    }

    const startedAt = Date.now();
    setRedirectRemainingMs(DASHBOARD_REDIRECT_DELAY_MS);

    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setRedirectRemainingMs(Math.max(DASHBOARD_REDIRECT_DELAY_MS - elapsed, 0));
    }, 100);

    const timeoutId = window.setTimeout(() => {
      navigate(nextPath?.startsWith("/") ? nextPath : "/dashboard", { replace: true });
    }, DASHBOARD_REDIRECT_DELAY_MS);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(timeoutId);
    };
  }, [navigate, nextPath, successState?.redirectToDashboard]);

  useEffect(() => {
    if (step !== 2) {
      return;
    }

    if (!normalizedEmail || !emailHasValidFormat) {
      setEmailAvailability((currentState) =>
        currentState.email === normalizedEmail && currentState.status === "idle"
          ? currentState
          : { email: normalizedEmail, status: "idle" },
      );
      return;
    }

    if (
      emailAvailability.email === normalizedEmail &&
      (emailAvailability.status === "checking" ||
        emailAvailability.status === "available" ||
        emailAvailability.status === "taken" ||
        emailAvailability.status === "error")
    ) {
      return;
    }

    const candidateEmail = normalizedEmail;
    const requestId = ++emailCheckRequestRef.current;

    const timeoutId = window.setTimeout(() => {
      setEmailAvailability((currentState) =>
        currentState.email === candidateEmail && currentState.status === "checking"
          ? currentState
          : { email: candidateEmail, status: "checking" },
      );

      void checkEmailRegistration(candidateEmail).then((result) => {
        if (requestId !== emailCheckRequestRef.current) {
          return;
        }

        if (result.error) {
          setEmailAvailability((currentState) =>
            currentState.email === candidateEmail && currentState.status === "error"
              ? currentState
              : { email: candidateEmail, status: "error" },
          );
          return;
        }

        const nextStatus = result.taken ? "taken" : "available";
        setEmailAvailability((currentState) =>
          currentState.email === candidateEmail && currentState.status === nextStatus
            ? currentState
            : { email: candidateEmail, status: nextStatus },
        );
      });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [emailAvailability.email, emailAvailability.status, emailHasValidFormat, normalizedEmail, step]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (signUpInFlightRef.current) {
      return;
    }

    if (step === 1) {
      setError("");
      setStep(2);
      return;
    }

    if (step === 2) {
      if (stepOneValidationMessage) {
        setError(stepOneValidationMessage);
        return;
      }

      setError("");
      setStep(3);
      return;
    }

    if (!canSubmit) {
      setError(t("auth.register.completeFields"));
      return;
    }

    const emailCheckResult = await checkEmailAvailability(normalizedEmail);
    if (emailCheckResult.taken) {
      setError(t("auth.register.emailTakenLogin"));
      return;
    }

    setError("");
    signUpInFlightRef.current = true;
    setLoading(true);

    try {
      const result = await signUp({
        email: normalizedEmail,
        password: form.password,
        name: normalizedFullName,
        businessName: normalizedBusinessName,
        plan: selectedPlan,
      });

      if (result.needsEmailConfirmation) {
        setSuccessState({
          email: normalizedEmail,
          redirectToDashboard: false,
        });
        return;
      }

      setSuccessState({
        email: normalizedEmail,
        redirectToDashboard: true,
      });
    } catch (err: unknown) {
      setError(getRegistrationErrorMessage(t, err));
    } finally {
      signUpInFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <AuthShell
      topActionLabel={t("auth.register.logIn")}
      topActionTo={loginPath}
      cardClassName="max-w-[1180px]"
      cardHeader={
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 text-[13px] font-medium text-[#677391]">
            <span>{step === 1 ? t("auth.register.step1of3") : step === 2 ? t("auth.register.step2of3") : t("auth.register.step3of3")}</span>
            <span>{step === 1 ? t("auth.register.planSelection") : step === 2 ? t("auth.register.businessDetails") : t("auth.register.loginDetails")}</span>
          </div>

          <div className="flex gap-2">
            <span className="h-1.5 flex-1 rounded-full bg-[#5B67F7]" />
            <span className={`h-1.5 flex-1 rounded-full ${step >= 2 ? "bg-[#5B67F7]" : "bg-[#E4E8F4]"}`} />
            <span className={`h-1.5 flex-1 rounded-full ${step === 3 ? "bg-[#5B67F7]" : "bg-[#E4E8F4]"}`} />
          </div>

          <AuthCardHeader
            title={step === 1 ? t("auth.register.planSelectionTitle") : step === 2 ? t("auth.register.stepOneTitle") : t("auth.register.stepTwoTitle")}
            subtitle={
              step === 1 ? t("auth.register.planSelectionSubtitle") : step === 2 ? t("auth.register.stepOneSubtitle") : t("auth.register.stepTwoSubtitle")
            }
          />
          <div className="mt-5 flex items-center justify-between gap-4 rounded-[14px] border border-[#DDE2FF] bg-[#F5F6FF] px-4 py-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#5B67F7]">Selected plan</p>
              <p className="mt-1 text-[15px] font-semibold text-[#15203B]">{selectedPlanLabel}</p>
            </div>
            <p className="text-right text-[14px] font-medium text-[#4A56E0]">
              {selectedPlan === "starter" ? "Free trial" : selectedPlanDetails.priceLabel}
            </p>
          </div>
        </div>
      }
    >
      {successState ? (
        <div className="space-y-6">
          <div className="relative rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-5 py-5 text-sm text-[#1D4ED8]">
            {successState.redirectToDashboard ? (
              <>
                <button
                  type="button"
                  onClick={openDashboard}
                  className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#BFDBFE] bg-white/80 text-[#3157A7] transition-colors hover:bg-white hover:text-[#1E3A8A]"
                  aria-label={t("auth.register.openDashboardNow")}
                >
                  <X size={16} />
                </button>
                <p className="text-base font-semibold text-[#1E3A8A]">{t("auth.register.accountCreated")}</p>
                <p className="mt-2 leading-7">
                  {t("auth.register.accountReady", { email: successState.email })}
                </p>
                <p className="mt-2 leading-7 text-[#3157A7]">
                  {t("auth.register.redirecting", { seconds: redirectSecondsRemaining })}
                </p>
                <div className="mt-4">
                  <div className="h-2 overflow-hidden rounded-full bg-[#D7E5FF]">
                    <div
                      className="h-full rounded-full bg-[#5B67F7] transition-[width] duration-100"
                      style={{ width: `${redirectProgress}%` }}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-[#1E3A8A]">{t("auth.register.checkInbox")}</p>
                <p className="mt-2 leading-7">
                  {t("auth.register.successCreatedFor", { email: successState.email })}
                </p>
                <p className="mt-2 leading-7 text-[#3157A7]">
                  {t("auth.register.inboxHelp")}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {successState.redirectToDashboard ? (
              <button
                type="button"
                onClick={openDashboard}
                className={authPrimaryButtonClassName}
              >
                {t("auth.register.openDashboardNow")}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/login?signup=success&email=${encodeURIComponent(successState.email)}&next=${encodeURIComponent(registrationDestination)}`,
                      { replace: true },
                    )
                  }
                  className={authPrimaryButtonClassName}
                >
                  {t("auth.register.goToLogin")}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessState(null);
                    setStep(1);
                    setForm({
                      businessName: "",
                      fullName: "",
                      email: "",
                      password: "",
                      confirmPassword: "",
                    });
                    resetEmailAvailability();
                    setAgreed(false);
                    setError("");
                  }}
                  className={authSecondaryButtonClassName}
                >
                  {t("auth.register.useAnotherEmail")}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {!successState ? (
        <>
      {error && (
        <div className="mb-6 rounded-[14px] border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 1 ? (
          <>
            <fieldset className="space-y-3">
              <legend className="text-[14px] font-semibold text-[#15203B]">Choose your workspace plan</legend>
              <p className="text-[13px] leading-6 text-[#677391]">
                Start free, or choose a paid plan and complete secure Paystack checkout after creating your account.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {registrationPlanOptions.map(({ eyebrow, paymentLabel, plan }) => {
                  const planDetails = defaultSubscriptionCatalog[plan];
                  const isSelected = selectedPlan === plan;

                  return (
                    <button
                      type="button"
                      key={plan}
                      aria-label={isSelected ? `${plan} plan selected` : `Choose ${plan} plan`}
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedPlan(plan);
                        if (error) setError("");
                      }}
                      className={`flex h-full flex-col rounded-[18px] border p-5 text-left transition-colors ${
                        isSelected
                          ? "border-[#5B67F7] bg-[#F8F9FF] shadow-[0_12px_28px_rgba(91,103,247,0.12)]"
                          : "border-[#DDE2EF] bg-white hover:border-[#9EA9D8] hover:bg-[#FAFBFF]"
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5B67F7]">
                            {eyebrow}
                          </span>
                          <span className="mt-1 block text-[20px] font-bold capitalize tracking-[-0.02em] text-[#15203B]">
                            {plan}
                          </span>
                        </span>
                        <span
                          aria-hidden="true"
                          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border ${
                            isSelected ? "border-[#5B67F7] bg-[#5B67F7]" : "border-[#C9D0E6] bg-white"
                          }`}
                        >
                          <Check size={12} className={isSelected ? "text-white" : "text-transparent"} />
                        </span>
                      </span>
                      <span className="mt-5 block text-[26px] font-extrabold tracking-[-0.04em] text-[#10203F]">
                        {plan === "starter" ? "Free" : planDetails.priceLabel.replace("/mo", "")}
                        {plan !== "starter" ? <span className="ml-1 text-[13px] font-normal tracking-normal text-[#677391]">/month</span> : null}
                      </span>
                      <span className="mt-1 block text-[12px] text-[#677391]">{paymentLabel}</span>
                      <ul className="my-5 flex-1 space-y-3 border-t border-[#E5E9F3] pt-5">
                        {planDetails.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-[#677391]">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#5B67F7]" aria-hidden="true" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <span
                        className={`inline-flex h-11 w-full items-center justify-center rounded-[10px] px-4 text-[14px] font-semibold transition-colors ${
                          isSelected
                            ? "bg-[#5B67F7] text-white hover:bg-[#4A56E0]"
                            : "border border-[#D8DDF0] bg-white text-[#15203B] hover:border-[#9EA9D8] hover:bg-[#FAFBFF]"
                        }`}
                      >
                        {isSelected ? "Selected plan" : "Choose plan"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="pt-2">
              <button type="submit" className={authPrimaryButtonClassName}>
                {t("auth.register.next")}
              </button>
            </div>
          </>
        ) : step === 2 ? (
          <>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label htmlFor="businessName" className={authLabelClassName}>
                  {t("auth.register.businessName")}
                </Label>
                <Input
                  id="businessName"
                  value={form.businessName}
                  onChange={update("businessName")}
                  placeholder={t("auth.register.businessNamePlaceholder")}
                  className={authInputClassName}
                  required
                />
                {normalizedBusinessName && normalizedBusinessName.length < 2 ? (
                  <p className="mt-2 text-[13px] text-[#DC2626]">{t("auth.register.validation.businessNameTooShort")}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="fullName" className={authLabelClassName}>
                  {t("auth.register.fullName")}
                </Label>
                <Input
                  id="fullName"
                  value={form.fullName}
                  onChange={update("fullName")}
                  placeholder={t("auth.register.fullNamePlaceholder")}
                  className={authInputClassName}
                  required
                />
                {normalizedFullName &&
                stepOneValidationMessage &&
                stepOneValidationMessage !== t("auth.register.validation.businessNameTooShort") ? (
                  <p className="mt-2 text-[13px] text-[#DC2626]">{stepOneValidationMessage}</p>
                ) : (
                  <p className="mt-2 text-[13px] text-[#677391]">{t("auth.register.fullNameHelp")}</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={goToPreviousStep}
                className={authSecondaryButtonClassName}
              >
                {t("auth.register.back")}
              </button>
              <button type="submit" disabled={!canContinue} className={authPrimaryButtonClassName}>
                {t("auth.register.next")}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor="regEmail" className={authLabelClassName}>
                {t("auth.register.workEmail")}
              </Label>
              <Input
                id="regEmail"
                type="email"
                value={form.email}
                onChange={update("email")}
                onBlur={() => {
                  if (normalizedEmail && emailHasValidFormat) {
                    void checkEmailAvailability(normalizedEmail);
                  }
                }}
                placeholder={t("auth.register.workEmailPlaceholder")}
                autoComplete="off"
                className={authInputClassName}
                required
              />
              {emailHelperMessage ? (
                <p className={`mt-2 text-[13px] ${emailHelperClassName}`}>{emailHelperMessage}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="regPassword" className={authLabelClassName}>
                {t("auth.login.password")}
              </Label>
              <div className="relative">
                <Input
                  id="regPassword"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={update("password")}
                  placeholder={t("auth.register.createPassword")}
                  className={`${authInputClassName} pr-16`}
                  required
                  minLength={8}
                />
                <span className="pointer-events-none absolute right-12 top-1/2 h-7 -translate-y-1/2 border-l border-[#E1E5F0]" />
                <button
                  type="button"
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7D8090] transition-colors hover:text-[#15203B]"
                  aria-label={showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="text-[14px] text-[#677391]">{t("auth.register.minimumPassword")}</p>
                {form.password ? (
                  <p className={`text-[13px] font-medium ${strength.textClassName}`}>{strength.label}</p>
                ) : null}
              </div>

              {form.password ? (
                <div className="mt-3 flex h-1 gap-[3px]">
                  {[1, 2, 3].map((segment) => (
                    <span
                      key={segment}
                      className={`flex-1 rounded-full ${
                        segment <= strength.score ? strength.fillClassName : "bg-[#E2E8F0]"
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <Label htmlFor="confirmPassword" className={authLabelClassName}>
                {t("auth.register.confirmPassword")}
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={update("confirmPassword")}
                  placeholder={t("auth.register.confirmPasswordPlaceholder")}
                  className={`${authInputClassName} pr-16`}
                  required
                />
                <span className="pointer-events-none absolute right-12 top-1/2 h-7 -translate-y-1/2 border-l border-[#E1E5F0]" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((currentValue) => !currentValue)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7D8090] transition-colors hover:text-[#15203B]"
                  aria-label={showConfirmPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {form.confirmPassword && form.password !== form.confirmPassword ? (
                <p className="mt-2 text-[13px] text-[#DC2626]">{t("auth.register.passwordMismatch")}</p>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-8 text-[#677391]">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(event) => {
                  setAgreed(event.target.checked);
                  if (error) setError("");
                }}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
                  agreed ? "border-[#5B67F7] bg-[#5B67F7]" : "border-[#C9D0E6] bg-white"
                }`}
              >
                <Check size={12} className={agreed ? "text-white" : "text-transparent"} />
              </span>
              <span>
                {t("auth.register.agreement.prefix")}{" "}
                <Link to="/terms" target="_blank" rel="noreferrer" className="text-[#5864F7] underline-offset-2 hover:underline">
                  {t("auth.register.agreement.termsOfUse")}
                </Link>
                ,{" "}
                <Link to="/privacy" target="_blank" rel="noreferrer" className="text-[#5864F7] underline-offset-2 hover:underline">
                  {t("auth.register.agreement.privacyPolicy")}
                </Link>
                , {t("auth.register.agreement.consentSuffix")}
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={goToPreviousStep}
                className={authSecondaryButtonClassName}
              >
                {t("auth.register.back")}
              </button>

              <button type="submit" disabled={!canSubmit || loading} className={authPrimaryButtonClassName}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? t("auth.register.creating") : t("auth.register.createAccount")}
              </button>
            </div>
          </>
        )}
      </form>
        </>
      ) : null}
    </AuthShell>
  );
};

export default RegisterPage;
