import { Link } from "react-router-dom";
import AuthShell, {
  AuthCardHeader,
  authPrimaryButtonClassName,
  authSecondaryButtonClassName,
} from "@/components/auth/AuthShell";

const ResetPasswordConfirmedPage = () => (
  <AuthShell
    topActionLabel="Back to login"
    topActionTo="/login"
    cardHeader={
      <AuthCardHeader
        title="Password updated"
        subtitle="Your password has been changed successfully. Sign in again to continue."
      />
    }
  >
    <div className="space-y-6 text-center">
      <div className="rounded-[18px] border border-[#D8DDF0] bg-[#F8F9FD] px-4 py-4 text-sm text-[#4A5675]">
        You can now sign in with your new password.
      </div>
      <div className="space-y-3">
        <Link to="/login" className={`${authPrimaryButtonClassName} w-full`}>
          Continue to login
        </Link>
        <Link to="/forgot-password" className={`${authSecondaryButtonClassName} w-full`}>
          Reset another password
        </Link>
      </div>
    </div>
  </AuthShell>
);

export default ResetPasswordConfirmedPage;
