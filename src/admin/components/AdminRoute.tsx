import { createContext, useContext, useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type AdminRole = "super_admin" | "support";

export type AdminAccess = {
  adminUserId: string;
  createdAt: string;
  role: AdminRole;
  userId: string;
};

const AdminAccessContext = createContext<AdminAccess | null>(null);

export const useAdminAccess = () => {
  const context = useContext(AdminAccessContext);

  if (!context) {
    throw new Error("useAdminAccess must be used within an AdminRoute.");
  }

  return context;
};

const AdminRoute = () => {
  const { isMfaRequired, loading, mfaLoading, session } = useAuth();
  const location = useLocation();
  const [adminAccess, setAdminAccess] = useState<AdminAccess | null>(null);
  const [adminLoading, setAdminLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    let active = true;

    if (!session?.user?.id) {
      setAdminAccess(null);
      setAccessDenied(false);
      setAdminLoading(false);
      return () => {
        active = false;
      };
    }

    const loadAdminAccess = async () => {
      setAdminLoading(true);

      const { data, error } = await supabase
        .from("admin_users")
        .select("id, created_at, role, user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error || !data) {
        setAdminAccess(null);
        setAccessDenied(true);
        setAdminLoading(false);
        return;
      }

      setAdminAccess({
        adminUserId: data.id,
        createdAt: data.created_at,
        role: data.role as AdminRole,
        userId: data.user_id,
      });
      setAccessDenied(false);
      setAdminLoading(false);
    };

    void loadAdminAccess();

    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (loading || (session && mfaLoading) || adminLoading) {
    return <RouteLoadingScreen />;
  }

  if (!session) {
    const nextPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (isMfaRequired) {
    const nextPath = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?mfa=required&next=${encodeURIComponent(nextPath)}`} replace />;
  }

  if (accessDenied || !adminAccess) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ message: "Access denied. This area is restricted." }}
      />
    );
  }

  return (
    <AdminAccessContext.Provider value={adminAccess}>
      <Outlet />
    </AdminAccessContext.Provider>
  );
};

export default AdminRoute;
