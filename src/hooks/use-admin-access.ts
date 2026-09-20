import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminRole = "super_admin" | "support";

export type AdminAccessState = {
  adminUserId: string;
  createdAt: string;
  role: AdminRole;
  userId: string;
};

export const useAdminAccess = (userId: string | undefined | null) => {
  const [adminAccess, setAdminAccess] = useState<AdminAccessState | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId));

  useEffect(() => {
    let active = true;

    if (!userId) {
      setAdminAccess(null);
      setIsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadAdminAccess = async () => {
      setIsLoading(true);

      const { data, error } = await supabase
        .from("admin_users")
        .select("id, created_at, role, user_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) {
        return;
      }

      if (error || !data) {
        setAdminAccess(null);
        setIsLoading(false);
        return;
      }

      setAdminAccess({
        adminUserId: data.id,
        createdAt: data.created_at,
        role: data.role as AdminRole,
        userId: data.user_id,
      });
      setIsLoading(false);
    };

    void loadAdminAccess();

    return () => {
      active = false;
    };
  }, [userId]);

  return { adminAccess, isLoading };
};
