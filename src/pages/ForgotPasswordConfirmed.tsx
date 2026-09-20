import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthShell, {
  AuthCardHeader,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/auth/AuthShell";

const ForgotPasswordConfirmedPage = () => {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next")?.trim() || "";
  const loginPath = useMemo(() => (next ? `/login?next=${encodeURIComponent(next)}` : "/login"), [next]);

  return (
    <AuthShell
      topActionLabel="Back to login"
      topActionTo={loginPath}
      cardHeader={
        <AuthCardHeader
          title="Check your email"
          subtitle="If an account exists for that email, you'll receive a password reset link shortly."
        />
      }
    >
      <div className="space-y-6 text-center">
        <div className="rounded-[18px] border border-[#D8DDF0] bg-[#F8F9FD] px-4 py-4 text-sm text-[#4A5675]">
          Open the email and click the reset link to continue.
        </div>

        <div className="space-y-3">
          <Link to={loginPath} className={`${authPrimaryButtonClassName} w-full`}>
            Continue to login
          </Link>
          <Link to="/forgot-password" className={`${authSecondaryButtonClassName} w-full`}>
            Send another reset email
          </Link>
        </div>
      </div>
    </AuthShell>
  );
};

export default ForgotPasswordConfirmedPage;
