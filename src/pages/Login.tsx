import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthShell, {
  AuthCardHeader,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/auth/AuthShell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useConsumeMfaRecoveryCode } from "@/hooks/use-mfa-recovery";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { normalizeRecoveryCode, validateRecoveryCode } from "@/lib/mfa-recovery";
import { validateTotpCode } from "@/lib/mfa";

const getSafeNextPath = (candidatePath: string | null) => {
  if (!candidatePath || candidatePath === "/login" || candidatePath.startsWith("/login?")) {
    return "/dashboard";
  }

  return candidatePath.startsWith("/") ? candidatePath : "/dashboard";
};

const LoginPage = () => {
  const {
    currentAal,
    isMfaRequired,
    isRecoveryBypassActive,
    mfaLoading,
    refreshMfaState,
    session,
    signIn,
    signOut,
    verifyMfa,
    verifiedMfaFactors,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLocalization();
  const [searchParams] = useSearchParams();
  const signupEmail = searchParams.get("email") ?? "";
  const signupSuccess = searchParams.get("signup") === "success";
  const nextQuery = searchParams.get("next");
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const mfaRequiredFromRoute = searchParams.get("mfa") === "required";
  const registerPath = nextQuery ? `/register?next=${encodeURIComponent(nextPath)}` : "/register";
  const forgotPasswordPath = "/forgot-password";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [selectedFactorId, setSelectedFactorId] = useState("");
  const [mfaMethod, setMfaMethod] = useState<"authenticator" | "recovery">("authenticator");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [error, setError] = useState("");
  const consumeRecoveryCodeMutation = useConsumeMfaRecoveryCode();
  const showMfaStep = Boolean(session) && isMfaRequired;
  const activeFactorId = selectedFactorId || verifiedMfaFactors[0]?.id || "";
  const mfaSubtitle = useMemo(() => {
    if (!showMfaStep) {
      return "";
    }

    if (currentAal === "aal1") {
      return mfaMethod === "recovery"
        ? t("auth.login.mfa.subtitles.aal1Recovery")
        : t("auth.login.mfa.subtitles.aal1Authenticator");
    }

    return mfaMethod === "recovery"
      ? t("auth.login.mfa.subtitles.defaultRecovery")
      : t("auth.login.mfa.subtitles.defaultAuthenticator");
  }, [currentAal, mfaMethod, showMfaStep, t]);
  const registrationMessage = useMemo(() => {
    if (signupSuccess && signupEmail) {
      return t("auth.login.registrationMessage", { email: signupEmail });
    }

    return typeof location.state === "object" && location.state && "message" in location.state
      ? location.state.message
      : "";
  }, [location.state, signupEmail, signupSuccess, t]);

  useEffect(() => {
    if (signupEmail) {
      setEmail((currentEmail) => currentEmail || signupEmail);
    }
  }, [signupEmail]);

  useEffect(() => {
    if (showMfaStep) {
      setSelectedFactorId((currentFactorId) => currentFactorId || verifiedMfaFactors[0]?.id || "");
      return;
    }

    setMfaCode("");
    setRecoveryCode("");
    setSelectedFactorId("");
    setMfaMethod("authenticator");
  }, [showMfaStep, verifiedMfaFactors]);

  useEffect(() => {
    if (session && !isMfaRequired && !mfaLoading) {
      navigate(nextPath, { replace: true });
    }
  }, [isMfaRequired, mfaLoading, navigate, nextPath, session]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (!result.needsMfa) {
        navigate(nextPath);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.login.errors.loginFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (mfaMethod === "recovery") {
      const codeError = validateRecoveryCode(recoveryCode);

      if (codeError) {
        setError(codeError);
        return;
      }

      setVerifyingMfa(true);

      try {
        await consumeRecoveryCodeMutation.mutateAsync({
          code: normalizeRecoveryCode(recoveryCode),
        });
        await refreshMfaState();
        navigate(nextPath, { replace: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t("auth.login.errors.recoveryVerificationFailed"));
      } finally {
        setVerifyingMfa(false);
      }

      return;
    }

    const codeError = validateTotpCode(mfaCode);
    if (codeError) {
      setError(codeError);
      return;
    }

    if (!activeFactorId) {
      setError(t("auth.login.errors.noAuthenticatorFactor"));
      return;
    }

    setVerifyingMfa(true);

    try {
      await verifyMfa(activeFactorId, mfaCode.trim());
      navigate(nextPath, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.login.errors.mfaVerificationFailed"));
    } finally {
      setVerifyingMfa(false);
    }
  };

  const handleUseAnotherAccount = async () => {
    setError("");
    setMfaCode("");
    setRecoveryCode("");

    try {
      await signOut("local");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("auth.login.errors.switchAccountFailed"));
    }
  };

  return (
    <AuthShell
      topActionLabel={t("auth.login.openAccount")}
      topActionTo={registerPath}
      cardHeader={
        <AuthCardHeader
          title={showMfaStep ? t("auth.login.mfa.verifyTitle") : t("auth.login.logIn")}
          subtitle={
            showMfaStep
              ? mfaSubtitle
              : t("auth.login.subtitle")
          }
        />
      }
    >
      {registrationMessage ? (
        <div className="mb-6 rounded-[14px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-sm text-[#1D4ED8]">
          {registrationMessage}
        </div>
      ) : null}

      {error && (
        <div className="mb-6 rounded-[14px] border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
          {error}
        </div>
      )}

      {showMfaStep ? (
        <form onSubmit={handleMfaSubmit} className="space-y-6">
          <div className="rounded-[18px] border border-[#D8DDF0] bg-[#F8F9FD] px-4 py-4 text-sm text-[#4A5675]">
            {mfaRequiredFromRoute
              ? t("auth.login.mfa.mfaRequiredMessage")
              : t("auth.login.mfa.passwordAcceptedMessage")}
          </div>

          {isRecoveryBypassActive ? (
            <div className="rounded-[18px] border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-sm text-[#1D4ED8]">
              {t("auth.login.mfa.recoveryActiveMessage")}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-[#D8DDF0] bg-white p-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                setMfaMethod("authenticator");
              }}
              className={`rounded-[12px] px-4 py-2 text-sm font-medium transition-colors ${
                mfaMethod === "authenticator" ? "bg-[#15203B] text-white" : "text-[#4A5675] hover:bg-[#F3F4FB]"
              }`}
            >
              {t("auth.login.mfa.authenticatorApp")}
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setMfaMethod("recovery");
              }}
              className={`rounded-[12px] px-4 py-2 text-sm font-medium transition-colors ${
                mfaMethod === "recovery" ? "bg-[#15203B] text-white" : "text-[#4A5675] hover:bg-[#F3F4FB]"
              }`}
            >
              {t("auth.login.mfa.recoveryCode")}
            </button>
          </div>

          {mfaMethod === "authenticator" && verifiedMfaFactors.length > 1 ? (
            <div>
              <Label className={authLabelClassName}>{t("auth.login.mfa.authenticatorApp")}</Label>
              <Select value={activeFactorId} onValueChange={setSelectedFactorId}>
                <SelectTrigger className={authInputClassName}>
                  <SelectValue placeholder={t("auth.login.mfa.chooseAuthenticator")} />
                </SelectTrigger>
                <SelectContent>
                  {verifiedMfaFactors.map((factor) => (
                    <SelectItem key={factor.id} value={factor.id}>
                      {factor.friendlyName || t("auth.login.mfa.authenticatorApp")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {mfaMethod === "authenticator" ? (
            <div>
              <Label htmlFor="mfa-code" className={authLabelClassName}>
                {t("auth.login.mfa.authenticatorCode")}
              </Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(event) => setMfaCode(event.target.value)}
                className={authInputClassName}
                placeholder={t("auth.login.mfa.authenticatorPlaceholder")}
                maxLength={6}
                required
              />
              <p className="mt-2 text-[14px] text-[#5F6A88]">
                {t("auth.login.mfa.authenticatorHelp")}
              </p>
            </div>
          ) : (
            <div>
              <Label htmlFor="recovery-code" className={authLabelClassName}>
                {t("auth.login.mfa.recoveryCode")}
              </Label>
              <Input
                id="recovery-code"
                autoComplete="one-time-code"
                value={recoveryCode}
                onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
                className={authInputClassName}
                placeholder={t("auth.login.mfa.recoveryPlaceholder")}
                maxLength={14}
                required
              />
              <p className="mt-2 text-[14px] text-[#5F6A88]">
                {t("auth.login.mfa.recoveryHelp")}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-3 sm:flex-row">
            <button type="submit" disabled={verifyingMfa} className={`${authPrimaryButtonClassName} w-full sm:flex-1`}>
              {verifyingMfa ? <Loader2 size={16} className="animate-spin" /> : null}
              {verifyingMfa
                ? t("auth.login.mfa.verifying")
                : mfaMethod === "recovery"
                  ? t("auth.login.mfa.useRecoveryCode")
                  : t("auth.login.mfa.verifyAndContinue")}
            </button>
            <button
              type="button"
              onClick={() => void handleUseAnotherAccount()}
              disabled={verifyingMfa}
              className={`${authSecondaryButtonClassName} w-full sm:flex-1`}
            >
              {t("auth.login.mfa.useAnotherAccount")}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="email" className={authLabelClassName}>
              {t("auth.login.email")}
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={authInputClassName}
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className={authLabelClassName}>
              {t("auth.login.password")}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${authInputClassName} pr-16`}
                required
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

            <div className="mt-2">
              <Link to={forgotPasswordPath} className="text-[14px] text-[#5F6A88] hover:text-[#15203B] hover:underline">
                {t("auth.login.forgotPassword")}
              </Link>
            </div>
          </div>

          <div className="pt-3">
            <button type="submit" disabled={loading} className={`${authPrimaryButtonClassName} w-full`}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? t("auth.login.loggingIn") : t("auth.login.logIn")}
            </button>
            <p className="mt-4 text-center text-[14px] text-[#5F6A88]">
              New here?{" "}
              <Link to={registerPath} className="font-semibold text-[#15203B] hover:underline">
                {t("auth.login.openAccount")}
              </Link>
            </p>
          </div>
        </form>
      )}
    </AuthShell>
  );
};

export default LoginPage;
