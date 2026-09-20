import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export const recordFinanceAuditLog = async ({
  action,
  actorUserId = null,
  adminClient,
  businessId,
  detail = {},
  entityId = null,
  entityType = "payment",
  summary,
}: {
  action: string;
  actorUserId?: string | null;
  adminClient: ReturnType<typeof createClient>;
  businessId: string;
  detail?: Record<string, unknown>;
  entityId?: string | null;
  entityType?: string;
  summary: string;
}) => {
  try {
    const { error } = await adminClient.from("audit_logs").insert({
      action,
      actor_user_id: actorUserId,
      business_id: businessId,
      detail,
      entity_id: entityId,
      entity_type: entityType,
      summary,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error("Unable to record finance audit log", error);
  }
};
