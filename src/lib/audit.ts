import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabase";

export type AuditEventInput = {
  action: string;
  actorUserId?: string | null;
  businessId: string;
  detail?: Json;
  entityId?: string | null;
  entityType: string;
  summary: string;
};

export const logAuditEvent = async ({
  action,
  actorUserId = null,
  businessId,
  detail = {},
  entityId = null,
  entityType,
  summary,
}: AuditEventInput) => {
  const payload: TablesInsert<"audit_logs"> = {
    action,
    actor_user_id: actorUserId,
    business_id: businessId,
    detail,
    entity_id: entityId,
    entity_type: entityType,
    summary,
  };

  const { error } = await supabase.from("audit_logs").insert(payload);

  if (error) {
    throw error;
  }
};

export const logAuditEventSafe = async (input: AuditEventInput) => {
  try {
    await logAuditEvent(input);
  } catch (error) {
    console.error("Unable to write audit log", error);
  }
};
