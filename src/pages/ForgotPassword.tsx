import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  return fallback;
};

const isResponseLike = (value: unknown): value is Response =>
  typeof value === "object" && value !== null && "clone" in value && typeof value.clone === "function";

const getResponseErrorMessage = async (response?: Response) => {
  if (!response) {
    return null;
  }

  try {
    const payload = await response.clone().json() as Record<string, unknown>;
    return typeof payload.error === "string" && payload.error.trim() ? payload.error : null;
  } catch {
    return null;
  }
};

const normalizeOrigin = () => {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin.replace(/\/$/, "");
};

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next")?.trim() || "";
  const loginPath = next ? `/login?next=${encodeURIComponent(next)}` : "/login";
  const confirmedPath = next ? `/forgot-password/confirmed?next=${encodeURIComponent(next)}` : "/forgot-password/confirmed";

  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const appBaseUrl = useMemo(() => normalizeOrigin(), []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Enter your email address.");
      return;
    }

    setIsSending(true);

    try {
      const { error, response } = await supabase.functions.invoke("auth-email", {
        body: {
          action: "password_reset",
          email: email.trim(),
        },
      });
      if (error) {
        const responseMessage = await getResponseErrorMessage(isResponseLike(response) ? response : undefined);
        throw new Error(responseMessage ?? getErrorMessage(error, "We could not send the reset email. Please try again."));
      }
      navigate(confirmedPath, { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "We could not send the reset email. Please try again."));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AuthShell
      topActionLabel="Back to login"
      topActionTo={loginPath}
      cardHeader={
        <AuthCardHeader
          title="Forgot your password?"
          subtitle="Enter your email and we'll send you a password reset link."
        />
      }
    >
      {!appBaseUrl ? (
        <div className="mb-6 rounded-[14px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
          Email delivery links depend on your current site URL. If you are previewing this page outside the app, run it
          from your real domain or localhost.
        </div>
      ) : null}
      {errorMessage ? (
        <div className="mb-6 rounded-[14px] border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
        <div>
          <Label htmlFor="email" className={authLabelClassName}>Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={authInputClassName}
          />
        </div>

        <button className={`${authPrimaryButtonClassName} w-full`} type="submit" disabled={isSending}>
          {isSending ? "Sending..." : "Send reset link"}
        </button>

        <Link to={loginPath} className={`${authSecondaryButtonClassName} w-full`}>
          Back to login
        </Link>
      </form>
    </AuthShell>
  );
};

export default ForgotPasswordPage;
