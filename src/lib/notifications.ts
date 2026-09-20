import type { Enums, Tables } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabase";

export type NotificationPreferenceKey =
  | "bill_due"
  | "email_digest"
  | "invoice_sent"
  | "overdue"
  | "payment_received"
  | "push_notifications"
  | "team_updates"
  | "weekly_report";

export const defaultNotificationPreferences: Record<NotificationPreferenceKey, boolean> = {
  bill_due: true,
  email_digest: true,
  invoice_sent: true,
  overdue: true,
  payment_received: true,
  push_notifications: false,
  team_updates: false,
  weekly_report: true,
};

const isNotificationEnabled = async (businessId: string, userId: string, preferenceKey?: NotificationPreferenceKey) => {
  if (!preferenceKey) {
    return true;
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select(preferenceKey)
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return defaultNotificationPreferences[preferenceKey];
  }

  return Boolean(data[preferenceKey]);
};

export const createNotificationSafe = async ({
  body,
  businessId,
  link = null,
  preferenceKey,
  title,
  type,
  userId,
}: {
  body: string;
  businessId: string;
  link?: string | null;
  preferenceKey?: NotificationPreferenceKey;
  title: string;
  type: Enums<"notification_type">;
  userId: string;
}) => {
  try {
    const enabled = await isNotificationEnabled(businessId, userId, preferenceKey);

    if (!enabled) {
      return;
    }

    const payload: Tables<"notifications">["Insert"] = {
      body,
      business_id: businessId,
      link,
      recipient_user_id: userId,
      title,
      type,
    };

    const { error } = await supabase.from("notifications").insert(payload);

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Unable to create notification", error);
  }
};
