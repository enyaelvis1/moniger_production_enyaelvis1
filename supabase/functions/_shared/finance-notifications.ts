import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type NotificationRow = {
  body: string;
  business_id: string;
  link: string | null;
  recipient_user_id: string;
  title: string;
  type: "invoice" | "bill" | "payment" | "team" | "report" | "system";
};

export const notifyFinanceUsers = async ({
  adminClient,
  body,
  businessId,
  link = "/wallet",
  title,
  type = "payment",
}: {
  adminClient: ReturnType<typeof createClient>;
  body: string;
  businessId: string;
  link?: string | null;
  title: string;
  type?: NotificationRow["type"];
}) => {
  const { data: recipients, error } = await adminClient
    .from("business_members")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "accountant"]);

  if (error) {
    throw error;
  }

  const recipientRows = recipients ?? [];
  if (recipientRows.length === 0) {
    return;
  }

  const insertRows: NotificationRow[] = recipientRows.map((recipient) => ({
    body,
    business_id: businessId,
    link,
    recipient_user_id: recipient.user_id,
    title,
    type,
  }));

  const { error: insertError } = await adminClient.from("notifications").insert(insertRows);
  if (insertError) {
    throw insertError;
  }
};
