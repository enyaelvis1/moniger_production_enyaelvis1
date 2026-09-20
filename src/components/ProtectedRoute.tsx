import { Navigate, useLocation } from "react-router-dom";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import { useAuth } from "@/contexts/AuthContext";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isMfaRequired, loading, mfaLoading, session } = useAuth();
  const location = useLocation();

  if (loading || (session && mfaLoading)) {
    return <RouteLoadingScreen />;
  }

  if (!session) return <Navigate to="/login" replace />;
  if (isMfaRequired) {
    const nextPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?mfa=required&next=${encodeURIComponent(nextPath)}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
