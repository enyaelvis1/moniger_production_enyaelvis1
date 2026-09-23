import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { logAuditEventSafe } from "@/lib/audit";
import { defaultNotificationPreferences } from "@/lib/notifications";
import { defaultPrivacyPreferences, sanitizeWorkspaceExportSnapshot, type PrivacyPreferenceState } from "@/lib/privacy";
import {
  notificationPreferencesQueryOptions,
  securityActivityQueryOptions,
  settingsQueryOptions,
} from "@/lib/query";
import { supabase } from "@/lib/supabase";

type ProfileRow = Tables<"profiles">;
type BusinessRow = Tables<"businesses">;
type BusinessMemberRow = Tables<"business_members">;
type WorkspaceWalletRow = Tables<"workspace_wallets">;
type PrivacyPreferenceRow = Tables<"privacy_preferences">;
type NotificationPreferenceRow = Tables<"notification_preferences">;
type NotificationPreferenceState = Record<keyof typeof defaultNotificationPreferences, boolean>;
type TeamMemberExportRow = {
  avatar_url: string | null;
  business_id: string;
  created_at: string;
  email: string | null;
  full_name: string | null;
  invited_by: string | null;
  joined_at: string;
  membership_id: string;
  role: Enums<"business_role">;
  status: Enums<"business_member_status">;
  updated_at: string;
  user_id: string | null;
};
type SecurityActivityRow = Pick<Tables<"audit_logs">, "action" | "created_at" | "detail" | "id" | "summary">;

export type AccountDataExportSnapshot = {
  account: {
    app_metadata: Record<string, unknown>;
    email: string | null;
    last_sign_in_at: string | null;
    user_id: string;
    user_metadata: Record<string, unknown>;
  };
  currentBusiness: BusinessRow | null;
  exportedAt: string;
  memberships: Array<Pick<BusinessMemberRow, "business_id" | "created_at" | "joined_at" | "role" | "status" | "updated_at">>;
  notificationPreferences: NotificationPreferenceState;
  privacyPreferences: PrivacyPreferenceState;
  profile: ProfileRow | null;
  recentNotifications: Array<
    Pick<Tables<"notifications">, "body" | "business_id" | "created_at" | "id" | "link" | "read_at" | "title" | "type">
  >;
};

export type WorkspaceDataExportSnapshot = {
  appliedPrivacyControls: PrivacyPreferenceState;
  auditLogs: Tables<"audit_logs">[];
  bills: Tables<"bills">[];
  business: BusinessRow;
  customers: Tables<"customers">[];
  exportedAt: string;
  exportedByUserId: string;
  invoiceItems: Tables<"invoice_items">[];
  invoices: Tables<"invoices">[];
  payments: Tables<"payments">[];
  teamMembers: TeamMemberExportRow[];
  vendors: Tables<"vendors">[];
};

export type SecurityActivityItem = {
  action: string;
  createdAt: string;
  detail: string;
  id: number;
  summary: string;
};

export type SettingsData = {
  business: BusinessRow | null;
  membership: Pick<BusinessMemberRow, "business_id" | "role" | "status"> | null;
  profile: ProfileRow | null;
};

export type ProfileUpdateInput = {
  avatar_url?: string | null;
  full_name?: string | null;
  language?: string | null;
  locale?: string | null;
  phone?: string | null;
};

export type BusinessUpdateInput = {
  address: string | null;
  default_currency: string;
  default_language: string;
  default_locale: string;
  fiscal_year_start_month: number;
  name: string;
  phone: string | null;
  rc_number: string | null;
  tax_id: string | null;
};

export type PasswordUpdateInput = {
  current_password?: string;
  nonce?: string;
  password: string;
};

const settingsQueryKey = (userId: string) => ["settings", userId] as const;
const privacyPreferencesQueryKey = (businessId: string, userId: string) => ["privacy-preferences", businessId, userId] as const;
const securityActivityQueryKey = (businessId: string, userId: string) => ["security-activity", businessId, userId] as const;
const workspaceWalletQueryKey = (businessId: string) => ["workspace-wallet", businessId] as const;

const fetchNotificationPreferences = async (businessId: string, userId: string) => {
  const fields = Object.keys(defaultNotificationPreferences).join(", ");
  const { data, error } = await supabase
    .from("notification_preferences")
    .select(fields)
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    ...defaultNotificationPreferences,
    ...((data ?? {}) as Partial<NotificationPreferenceRow>),
  };
};

const fetchPrivacyPreferences = async (businessId: string, userId: string): Promise<PrivacyPreferenceState> => {
  const fields = Object.keys(defaultPrivacyPreferences).join(", ");
  const { data, error } = await supabase
    .from("privacy_preferences")
    .select(fields)
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    ...defaultPrivacyPreferences,
    ...((data ?? {}) as Partial<PrivacyPreferenceRow>),
  };
};

const getSecurityDetailText = (detail: unknown) => {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) {
    return "";
  }

  if ("description" in detail && typeof detail.description === "string") {
    return detail.description;
  }

  return "";
};

const fetchSecurityActivity = async (businessId: string, userId: string): Promise<SecurityActivityItem[]> => {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, summary, detail, created_at")
    .eq("business_id", businessId)
    .eq("actor_user_id", userId)
    .like("action", "security.%")
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return ((data ?? []) as SecurityActivityRow[]).map((entry) => ({
    action: entry.action,
    createdAt: entry.created_at,
    detail: getSecurityDetailText(entry.detail),
    id: entry.id,
    summary: entry.summary,
  }));
};

const fetchSettingsData = async (userId: string): Promise<SettingsData> => {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  let business: BusinessRow | null = null;

  if (membership?.business_id) {
    const { data: businessRow, error: businessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", membership.business_id)
      .maybeSingle();

    if (businessError) {
      throw businessError;
    }

    business = businessRow;
  }

  if (!business) {
    const { data: fallbackBusiness, error: fallbackBusinessError } = await supabase
      .from("businesses")
      .select("*")
      .eq("owner_user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackBusinessError) {
      throw fallbackBusinessError;
    }

    business = fallbackBusiness;
  }

  return {
    business,
    membership,
    profile,
  };
};

const fetchWorkspaceWalletData = async (businessId: string): Promise<WorkspaceWalletRow | null> => {
  const { data, error } = await supabase
    .from("workspace_wallets")
    .select("id, business_id, currency, balance, reserved_balance, available_balance, provider, provider_metadata, last_funded_at, created_at, updated_at")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as WorkspaceWalletRow | null;
};

const updateProfile = async (userId: string, values: ProfileUpdateInput) => {
  const profilePayload = {
    id: userId,
    ...(values.avatar_url !== undefined ? { avatar_url: values.avatar_url } : {}),
    ...(values.full_name !== undefined ? { full_name: values.full_name } : {}),
    ...(values.language !== undefined ? { language: values.language } : {}),
    ...(values.locale !== undefined ? { locale: values.locale } : {}),
    ...(values.phone !== undefined ? { phone: values.phone } : {}),
  };

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      profilePayload,
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      ...(values.avatar_url !== undefined ? { avatar_url: values.avatar_url ?? undefined } : {}),
      name: values.full_name ?? undefined,
    },
  });

  if (authError) {
    throw authError;
  }

  return data;
};

const updateBusiness = async (businessId: string, userId: string | undefined, values: BusinessUpdateInput) => {
  const { data, error } = await supabase
    .from("businesses")
    .update(values)
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      business_name: values.name,
    },
  });

  if (authError) {
    throw authError;
  }

  if (userId) {
    await logAuditEventSafe({
      action: "business.updated",
      actorUserId: userId,
      businessId,
      detail: {
        description: `Workspace settings updated for ${values.name}`,
        rc_number: values.rc_number,
        tax_id: values.tax_id,
      },
      entityId: businessId,
      entityType: "business",
      summary: "Workspace settings updated",
    });
  }

  return data;
};

const sendPasswordReauthentication = async () => {
  const { error } = await supabase.auth.reauthenticate();

  if (error) {
    throw error;
  }
};

const upsertPrivacyPreferences = async (
  businessId: string,
  userId: string,
  values: PrivacyPreferenceState,
) => {
  const { data, error } = await supabase
    .from("privacy_preferences")
    .upsert(
      {
        business_id: businessId,
        user_id: userId,
        ...values,
      },
      { onConflict: "business_id,user_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
};

export const getAccountDataExportSnapshot = async (
  userId: string,
  businessId?: string,
): Promise<AccountDataExportSnapshot> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError) {
    throw authError;
  }

  const currentUser = authData.user;

  if (!currentUser || currentUser.id !== userId) {
    throw new Error("You must be signed in as this account before exporting account data.");
  }

  const [profileResponse, membershipsResponse, businessResponse, notificationPreferences, privacyPreferences, notificationsResponse] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("business_members")
        .select("business_id, role, status, joined_at, created_at, updated_at")
        .eq("user_id", userId)
        .order("joined_at", { ascending: true }),
      businessId ? supabase.from("businesses").select("*").eq("id", businessId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      businessId ? fetchNotificationPreferences(businessId, userId) : Promise.resolve(defaultNotificationPreferences),
      businessId ? fetchPrivacyPreferences(businessId, userId) : Promise.resolve(defaultPrivacyPreferences),
      supabase
        .from("notifications")
        .select("id, business_id, type, title, body, link, read_at, created_at")
        .eq("recipient_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (profileResponse.error) throw profileResponse.error;
  if (membershipsResponse.error) throw membershipsResponse.error;
  if (businessResponse.error) throw businessResponse.error;
  if (notificationsResponse.error) throw notificationsResponse.error;

  return {
    account: {
      app_metadata: (currentUser.app_metadata ?? {}) as Record<string, unknown>,
      email: currentUser.email ?? null,
      last_sign_in_at: currentUser.last_sign_in_at ?? null,
      user_id: currentUser.id,
      user_metadata: (currentUser.user_metadata ?? {}) as Record<string, unknown>,
    },
    currentBusiness: businessResponse.data ?? null,
    exportedAt: new Date().toISOString(),
    memberships: (membershipsResponse.data ?? []) as Array<
      Pick<BusinessMemberRow, "business_id" | "created_at" | "joined_at" | "role" | "status" | "updated_at">
    >,
    notificationPreferences,
    privacyPreferences,
    profile: profileResponse.data ?? null,
    recentNotifications: (notificationsResponse.data ?? []) as AccountDataExportSnapshot["recentNotifications"],
  };
};

export const getWorkspaceDataExportSnapshot = async (
  businessId: string,
  userId: string,
): Promise<WorkspaceDataExportSnapshot> => {
  const membershipResponse = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipResponse.error) {
    throw membershipResponse.error;
  }

  const currentRole = membershipResponse.data?.role;

  if (!currentRole || !["owner", "admin", "accountant"].includes(currentRole)) {
    throw new Error("Only workspace owners, admins, or accountants can export workspace data.");
  }

  const privacyPreferences = await fetchPrivacyPreferences(businessId, userId);

  const [
    businessResponse,
    customersResponse,
    vendorsResponse,
    invoicesResponse,
    billsResponse,
    paymentsResponse,
    auditLogsResponse,
    teamMembersResponse,
  ] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).single(),
    supabase.from("customers").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("vendors").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("business_id", businessId).order("issue_date", { ascending: false }),
    supabase.from("bills").select("*").eq("business_id", businessId).order("bill_date", { ascending: false }),
    supabase.from("payments").select("*").eq("business_id", businessId).order("paid_on", { ascending: false }),
    supabase.from("audit_logs").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.rpc("list_business_members", { p_business_id: businessId }),
  ]);

  if (businessResponse.error) throw businessResponse.error;
  if (customersResponse.error) throw customersResponse.error;
  if (vendorsResponse.error) throw vendorsResponse.error;
  if (invoicesResponse.error) throw invoicesResponse.error;
  if (billsResponse.error) throw billsResponse.error;
  if (paymentsResponse.error) throw paymentsResponse.error;
  if (auditLogsResponse.error) throw auditLogsResponse.error;
  if (teamMembersResponse.error) throw teamMembersResponse.error;

  const invoiceIds = ((invoicesResponse.data ?? []) as Tables<"invoices">[]).map((invoice) => invoice.id);
  const invoiceItemsResponse =
    invoiceIds.length > 0
      ? await supabase.from("invoice_items").select("*").in("invoice_id", invoiceIds)
      : { data: [], error: null };

  if (invoiceItemsResponse.error) throw invoiceItemsResponse.error;

  const sanitizedSnapshot = sanitizeWorkspaceExportSnapshot(
    {
      auditLogs: (auditLogsResponse.data ?? []) as Array<Record<string, unknown>>,
      customers: (customersResponse.data ?? []) as Array<Record<string, unknown>>,
      teamMembers: (teamMembersResponse.data ?? []) as Array<Record<string, unknown>>,
      vendors: (vendorsResponse.data ?? []) as Array<Record<string, unknown>>,
    },
    privacyPreferences,
  );

  return {
    appliedPrivacyControls: privacyPreferences,
    auditLogs: (sanitizedSnapshot.auditLogs ?? []) as Tables<"audit_logs">[],
    bills: (billsResponse.data ?? []) as Tables<"bills">[],
    business: businessResponse.data,
    customers: sanitizedSnapshot.customers as Tables<"customers">[],
    exportedAt: new Date().toISOString(),
    exportedByUserId: userId,
    invoiceItems: (invoiceItemsResponse.data ?? []) as Tables<"invoice_items">[],
    invoices: (invoicesResponse.data ?? []) as Tables<"invoices">[],
    payments: (paymentsResponse.data ?? []) as Tables<"payments">[],
    teamMembers: (sanitizedSnapshot.teamMembers ?? []) as TeamMemberExportRow[],
    vendors: sanitizedSnapshot.vendors as Tables<"vendors">[],
  };
};

const updatePassword = async (
  userId: string,
  businessId: string | undefined,
  values: PasswordUpdateInput,
) => {
  const { error } = await supabase.auth.updateUser({
    ...(values.current_password ? { current_password: values.current_password } : {}),
    ...(values.nonce ? { nonce: values.nonce } : {}),
    password: values.password,
  });

  if (error) {
    throw error;
  }

  if (businessId) {
    await logAuditEventSafe({
      action: "security.password.updated",
      actorUserId: userId,
      businessId,
      detail: {
        description: "Account password updated from the security settings tab.",
      },
      entityId: userId,
      entityType: "profile",
      summary: "Account password updated",
    });
  }
};

export const useSettingsData = (userId?: string) =>
  useQuery({
    queryKey: userId ? settingsQueryKey(userId) : ["settings", "guest"],
    queryFn: () => fetchSettingsData(userId!),
    enabled: Boolean(userId),
    ...settingsQueryOptions,
  });

export const useUpdateProfile = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: ProfileUpdateInput) => {
      if (!userId) {
        throw new Error("You must be signed in to update your profile.");
      }

      return updateProfile(userId, values);
    },
    onSuccess: async () => {
      if (!userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: settingsQueryKey(userId) });
    },
  });
};

export const useUpdateBusiness = (userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ businessId, values }: { businessId: string; values: BusinessUpdateInput }) =>
      updateBusiness(businessId, userId, values),
    onSuccess: async (_, variables) => {
      if (!userId) {
        return;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: settingsQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: ["operations", variables.businessId] }),
      ]);
    },
  });
};

export const useSendPasswordReauthentication = () =>
  useMutation({
    mutationFn: () => sendPasswordReauthentication(),
  });

export const useUpdatePassword = (userId?: string, businessId?: string) =>
  useMutation({
    mutationFn: (values: PasswordUpdateInput) => {
      if (!userId) {
        throw new Error("You must be signed in to change your password.");
      }

      return updatePassword(userId, businessId, values);
    },
  });

export const usePrivacyPreferencesData = (businessId?: string, userId?: string) =>
  useQuery({
    queryKey:
      businessId && userId ? privacyPreferencesQueryKey(businessId, userId) : ["privacy-preferences", "missing-context"],
    queryFn: () => fetchPrivacyPreferences(businessId!, userId!),
    enabled: Boolean(businessId && userId),
    ...notificationPreferencesQueryOptions,
  });

export const useSecurityActivityData = (businessId?: string, userId?: string) =>
  useQuery({
    queryKey:
      businessId && userId ? securityActivityQueryKey(businessId, userId) : ["security-activity", "missing-context"],
    queryFn: () => fetchSecurityActivity(businessId!, userId!),
    enabled: Boolean(businessId && userId),
    ...securityActivityQueryOptions,
  });

export const useWorkspaceWalletData = (businessId?: string) =>
  useQuery({
    queryKey: businessId ? workspaceWalletQueryKey(businessId) : ["workspace-wallet", "missing-business"],
    queryFn: () => fetchWorkspaceWalletData(businessId!),
    enabled: Boolean(businessId),
    ...settingsQueryOptions,
  });

export const useUpdatePrivacyPreferences = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: PrivacyPreferenceState) => {
      if (!businessId || !userId) {
        throw new Error("A business workspace is required before privacy preferences can be updated.");
      }

      return upsertPrivacyPreferences(businessId, userId, values);
    },
    onSuccess: async () => {
      if (!businessId || !userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: privacyPreferencesQueryKey(businessId, userId) });
    },
  });
};
