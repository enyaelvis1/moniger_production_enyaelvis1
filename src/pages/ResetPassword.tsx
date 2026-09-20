import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthShell, {
  AuthCardHeader,
  authInputClassName,
  authLabelClassName,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { getPasswordStrength, validatePasswordChangeForm } from "@/lib/passwords";

type FormState = {
  confirmPassword: string;
  newPassword: string;
};

const parseHashParams = (hash: string) => {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(trimmed);
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
};

const ResetPasswordPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({ confirmPassword: "", newPassword: "" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const passwordStrength = useMemo(() => getPasswordStrength(form.newPassword), [form.newPassword]);

  useEffect(() => {
    let isMounted = true;

    const prepare = async () => {
      setIsPreparing(true);
      setErrorMessage(null);

      try {
        const query = new URLSearchParams(location.search);
        const code = query.get("code")?.trim() || "";
        let shouldClearSensitiveUrlData = false;

        if (code) {
          const exchangeResponse = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeResponse.error) {
            throw exchangeResponse.error;
          }
          shouldClearSensitiveUrlData = true;
        } else if (location.hash) {
          const hashParams = parseHashParams(location.hash);
          const accessToken = hashParams.get("access_token")?.trim() || "";
          const refreshToken = hashParams.get("refresh_token")?.trim() || "";

          if (accessToken && refreshToken) {
            const setSessionResponse = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (setSessionResponse.error) {
              throw setSessionResponse.error;
            }
            shouldClearSensitiveUrlData = true;
          }
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!isMounted) return;
        setHasRecoverySession(Boolean(data.session));

        if (shouldClearSensitiveUrlData && typeof window !== "undefined") {
          window.history.replaceState(window.history.state, document.title, location.pathname);
        }
      } catch (error) {
        if (!isMounted) return;
        setHasRecoverySession(false);
        setErrorMessage(getErrorMessage(error, "We could not prepare your password reset session. Please request a new link."));
      } finally {
        if (isMounted) setIsPreparing(false);
      }
    };

    void prepare();

    return () => {
      isMounted = false;
    };
  }, [location.hash, location.search]);

  const handleSubmit = async () => {
    const errors = validatePasswordChangeForm({
      confirmPassword: form.confirmPassword,
      currentPassword: "",
      newPassword: form.newPassword,
      verificationCode: "",
    });

    if (errors.newPassword || errors.confirmPassword) {
      setErrorMessage(errors.newPassword ?? errors.confirmPassword ?? "Check your password entries and try again.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: form.newPassword });
      if (error) throw error;
      navigate("/reset-password/confirmed", { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "We could not update your password. Please request a new reset link."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthShell
      topActionLabel="Back to login"
      topActionTo="/login"
      cardHeader={
        <AuthCardHeader
          title="Reset your password"
          subtitle="Choose a new password for your Moniger account."
        />
      }
    >
      {isPreparing ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
          <Loader2 size={28} className="animate-spin text-[#5B67F7]" />
          <p className="mt-4 text-sm font-medium text-[#10203F]">Preparing your reset session...</p>
          <p className="mt-1 text-xs text-[#677391]">This should only take a moment.</p>
        </div>
      ) : !hasRecoverySession ? (
        <div className="space-y-4">
          <div className="rounded-[14px] border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {errorMessage ?? "This reset link is missing or has expired. Request a new password reset email."}
          </div>
          <div className="space-y-3">
            <button className={`${authPrimaryButtonClassName} w-full`} onClick={() => navigate("/login")} type="button">
              Go to login
            </button>
            <Link to="/forgot-password" className={`${authSecondaryButtonClassName} w-full`}>
              Request a new link
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {errorMessage ? (
            <div className="rounded-[14px] border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
              {errorMessage}
            </div>
          ) : null}

          <div>
            <Label htmlFor="new-password" className={authLabelClassName}>New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={form.newPassword}
              onChange={(event) => setForm((current) => ({ ...current, newPassword: event.target.value }))}
              className={authInputClassName}
            />
            {form.newPassword ? (
              <div className="mt-3 flex items-center justify-between rounded-[14px] border border-[#D8DDF0] bg-[#F8F9FD] px-3 py-2 text-xs">
                <span className="text-[#677391]">Strength</span>
                <span className={`font-semibold ${passwordStrength.textClassName}`}>{passwordStrength.label}</span>
              </div>
            ) : null}
          </div>

          <div>
            <Label htmlFor="confirm-password" className={authLabelClassName}>Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={(event) => setForm((current) => ({ ...current, confirmPassword: event.target.value }))}
              className={authInputClassName}
            />
          </div>

          <button className={`${authPrimaryButtonClassName} w-full`} onClick={() => void handleSubmit()} disabled={isSaving} type="button">
            {isSaving ? "Saving..." : "Update password"}
          </button>

          <p className="text-xs text-[#677391]">
            If this link does not work, request a new reset email and try again.
          </p>
        </div>
      )}
    </AuthShell>
  );
};

export default ResetPasswordPage;
