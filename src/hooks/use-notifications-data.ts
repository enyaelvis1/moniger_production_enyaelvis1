import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Enums, Tables } from "@/integrations/supabase/types";
import { defaultNotificationPreferences, type NotificationPreferenceKey } from "@/lib/notifications";
import {
  notificationPreferencesQueryOptions,
  notificationsFeedQueryOptions,
  scheduledDigestRunsQueryOptions,
} from "@/lib/query";
import { supabase } from "@/lib/supabase";

type NotificationRow = Pick<Tables<"notifications">, "body" | "created_at" | "id" | "link" | "read_at" | "title" | "type">;
type ScheduledDigestRunRow = Pick<
  Tables<"scheduled_digest_runs">,
  "created_at" | "error_message" | "item_count" | "scheduled_for" | "status"
>;

export type NotificationPreferenceState = Record<NotificationPreferenceKey, boolean>;

export type NotificationItem = {
  body: string;
  createdAt: string;
  id: string;
  link: string | null;
  readAt: string | null;
  title: string;
  type: Enums<"notification_type">;
};

export type ScheduledDigestRunItem = {
  createdAt: string;
  errorMessage: string | null;
  itemCount: number;
  scheduledFor: string;
  status: string;
};

const notificationsQueryKey = (businessId: string, userId: string) => ["notifications", businessId, userId] as const;
const notificationPreferencesQueryKey = (businessId: string, userId: string) =>
  ["notification-preferences", businessId, userId] as const;
const scheduledDigestRunsQueryKey = (businessId: string, userId: string) =>
  ["scheduled-digest-runs", businessId, userId] as const;

const fetchNotifications = async (businessId: string, userId: string): Promise<NotificationItem[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, link, read_at, created_at")
    .eq("business_id", businessId)
    .eq("recipient_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw error;
  }

  return ((data ?? []) as NotificationRow[]).map((notification) => ({
    body: notification.body,
    createdAt: notification.created_at,
    id: notification.id,
    link: notification.link,
    readAt: notification.read_at,
    title: notification.title,
    type: notification.type,
  }));
};

const fetchNotificationPreferences = async (businessId: string, userId: string): Promise<NotificationPreferenceState> => {
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
    ...(data ?? {}),
  } as NotificationPreferenceState;
};

const fetchLatestScheduledDigestRun = async (businessId: string, userId: string): Promise<ScheduledDigestRunItem | null> => {
  const { data, error } = await supabase
    .from("scheduled_digest_runs")
    .select("created_at, error_message, item_count, scheduled_for, status")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as ScheduledDigestRunRow;
  return {
    createdAt: row.created_at,
    errorMessage: row.error_message,
    itemCount: row.item_count,
    scheduledFor: row.scheduled_for,
    status: row.status,
  };
};

const upsertNotificationPreferences = async (
  businessId: string,
  userId: string,
  values: NotificationPreferenceState,
) => {
  const { data, error } = await supabase
    .from("notification_preferences")
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

const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId);

  if (error) {
    throw error;
  }
};

const markAllNotificationsAsRead = async (businessId: string, userId: string) => {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("business_id", businessId)
    .eq("recipient_user_id", userId)
    .is("read_at", null);

  if (error) {
    throw error;
  }
};

export const useNotificationsData = (businessId?: string, userId?: string) =>
  useQuery({
    queryKey:
      businessId && userId ? notificationsQueryKey(businessId, userId) : ["notifications", "missing-context"],
    queryFn: () => fetchNotifications(businessId!, userId!),
    enabled: Boolean(businessId && userId),
    ...notificationsFeedQueryOptions,
  });

export const useNotificationPreferencesData = (businessId?: string, userId?: string) =>
  useQuery({
    queryKey:
      businessId && userId
        ? notificationPreferencesQueryKey(businessId, userId)
        : ["notification-preferences", "missing-context"],
    queryFn: () => fetchNotificationPreferences(businessId!, userId!),
    enabled: Boolean(businessId && userId),
    ...notificationPreferencesQueryOptions,
  });

export const useScheduledDigestRunData = (businessId?: string, userId?: string) =>
  useQuery({
    queryKey:
      businessId && userId
        ? scheduledDigestRunsQueryKey(businessId, userId)
        : ["scheduled-digest-runs", "missing-context"],
    queryFn: () => fetchLatestScheduledDigestRun(businessId!, userId!),
    enabled: Boolean(businessId && userId),
    ...scheduledDigestRunsQueryOptions,
  });

export const useNotificationMutations = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  const invalidate = async () => {
    if (!businessId || !userId) {
      return;
    }

    await queryClient.invalidateQueries({ queryKey: notificationsQueryKey(businessId, userId) });
  };

  return {
    markAllAsRead: useMutation({
      mutationFn: () => {
        if (!businessId || !userId) {
          throw new Error("A business workspace is required before notifications can be updated.");
        }

        return markAllNotificationsAsRead(businessId, userId);
      },
      onSuccess: invalidate,
    }),
    markAsRead: useMutation({
      mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
      onSuccess: invalidate,
    }),
  };
};

export const useUpdateNotificationPreferences = (businessId?: string, userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: NotificationPreferenceState) => {
      if (!businessId || !userId) {
        throw new Error("A business workspace is required before notification preferences can be updated.");
      }

      return upsertNotificationPreferences(businessId, userId, values);
    },
    onSuccess: async () => {
      if (!businessId || !userId) {
        return;
      }

      await queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey(businessId, userId) });
    },
  });
};
