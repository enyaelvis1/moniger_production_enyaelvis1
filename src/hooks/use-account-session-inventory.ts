import type { Session } from "@supabase/supabase-js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentDeviceSnapshot } from "@/lib/device";
import type { AppAuthMethod, AuthenticatorAssuranceLevel } from "@/lib/mfa";
import { getSessionIdFromAccessToken } from "@/lib/mfa-recovery";
import { sessionInventoryQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";

export type AccountSessionInventoryItem = {
  aal: string | null;
  authMethods: AppAuthMethod[];
  browser: string;
  createdAt: string;
  deviceLabel: string;
  expiresAt: string | null;
  lastSeenAt: string;
  os: string;
  platform: string;
  provider: string | null;
  recoveryBypassActive: boolean;
  sessionId: string;
  signedOutAt: string | null;
};

type AccountSessionSignOutScope = "global" | "local" | "others";

const accountSessionInventoryQueryKey = (userId: string) => ["account-session-inventory", userId] as const;

const normalizeAuthMethods = (value: unknown): AppAuthMethod[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const method = "method" in entry && typeof entry.method === "string" ? entry.method : null;
    if (!method) {
      return [];
    }

    const verifiedAt =
      "verifiedAt" in entry && typeof entry.verifiedAt === "string"
        ? entry.verifiedAt
        : "verified_at" in entry && typeof entry.verified_at === "string"
          ? entry.verified_at
          : null;

    return [{ method, verifiedAt }];
  });
};

const fetchAccountSessionInventory = async (): Promise<AccountSessionInventoryItem[]> => {
  const { data, error } = await supabase.rpc("list_account_session_inventory");

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") {
      return [];
    }

    const sessionId = "session_id" in row && typeof row.session_id === "string" ? row.session_id : null;
    if (!sessionId) {
      return [];
    }

    return [
      {
        aal: "aal" in row && typeof row.aal === "string" ? row.aal : null,
        authMethods: normalizeAuthMethods("auth_methods" in row ? row.auth_methods : null),
        browser: "browser" in row && typeof row.browser === "string" ? row.browser : "Unknown browser",
        createdAt: "created_at" in row && typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
        deviceLabel:
          "device_label" in row && typeof row.device_label === "string" ? row.device_label : "Unknown device",
        expiresAt: "expires_at" in row && typeof row.expires_at === "string" ? row.expires_at : null,
        lastSeenAt:
          "last_seen_at" in row && typeof row.last_seen_at === "string" ? row.last_seen_at : new Date().toISOString(),
        os: "os" in row && typeof row.os === "string" ? row.os : "Unknown OS",
        platform: "platform" in row && typeof row.platform === "string" ? row.platform : "Unknown platform",
        provider: "provider" in row && typeof row.provider === "string" ? row.provider : null,
        recoveryBypassActive:
          "recovery_bypass_active" in row && typeof row.recovery_bypass_active === "boolean"
            ? row.recovery_bypass_active
            : false,
        sessionId,
        signedOutAt: "signed_out_at" in row && typeof row.signed_out_at === "string" ? row.signed_out_at : null,
      },
    ];
  });
};

export const syncCurrentAccountSessionInventory = async ({
  currentAal,
  currentAuthMethods,
  isRecoveryBypassActive,
  session,
}: {
  currentAal: AuthenticatorAssuranceLevel;
  currentAuthMethods: AppAuthMethod[];
  isRecoveryBypassActive: boolean;
  session: Session;
}) => {
  const sessionId = getSessionIdFromAccessToken(session.access_token);

  if (!sessionId) {
    return;
  }

  const snapshot = getCurrentDeviceSnapshot();
  const expiresAt = typeof session.expires_at === "number" ? new Date(session.expires_at * 1000).toISOString() : null;
  const provider =
    typeof session.user.app_metadata?.provider === "string" ? session.user.app_metadata.provider : null;

  const { error } = await supabase.rpc("upsert_account_session_inventory", {
    p_aal: currentAal ?? null,
    p_auth_methods: currentAuthMethods,
    p_browser: snapshot.browser,
    p_device_label: snapshot.label,
    p_expires_at: expiresAt,
    p_os: snapshot.os,
    p_platform: snapshot.platform,
    p_provider: provider,
    p_recovery_bypass_active: isRecoveryBypassActive,
    p_session_id: sessionId,
  });

  if (error) {
    throw error;
  }
};

const markAccountSessionsSignedOut = async ({
  currentSession,
  scope,
}: {
  currentSession: Session | null;
  scope: AccountSessionSignOutScope;
}) => {
  const currentSessionId = currentSession?.access_token
    ? getSessionIdFromAccessToken(currentSession.access_token)
    : null;

  const { data, error } = await supabase.rpc("mark_account_sessions_signed_out", {
    p_current_session_id: currentSessionId,
    p_scope: scope,
  });

  if (error) {
    throw error;
  }

  return typeof data === "number" ? data : 0;
};

export const useAccountSessionInventoryData = (userId?: string) =>
  useQuery({
    queryKey: userId ? accountSessionInventoryQueryKey(userId) : ["account-session-inventory", "guest"],
    queryFn: () => fetchAccountSessionInventory(),
    enabled: Boolean(userId),
    ...sessionInventoryQueryOptions,
  });

export const useMarkAccountSessionsSignedOut = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAccountSessionsSignedOut,
    onSuccess: async () => {
      if (!userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: accountSessionInventoryQueryKey(userId) });
    },
  });
};
