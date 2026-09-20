import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { formatTemplateDate, normalizeTemplateLanguage, normalizeTemplateLocale, translateTemplate } from "../_shared/localization.ts";

type NotificationRow = {
  body: string;
  created_at: string;
  title: string;
};

type NotificationPreferenceRow = {
  business_id: string;
  user_id: string;
};

type BusinessMembershipRow = {
  business_id: string;
  status: string;
  user_id: string;
};

type BusinessRow = {
  default_language: string | null;
  default_locale: string | null;
  id: string;
  name: string;
};

type ProfileRow = {
  full_name: string | null;
  id: string;
  language: string | null;
  locale: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getAppBaseUrl = (request: Request) => {
  const configuredUrl = Deno.env.get("APP_BASE_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const requestOrigin = request.headers.get("origin")?.trim();
  if (requestOrigin) {
    return requestOrigin.replace(/\/$/, "");
  }

  return "https://moniger.net";
};

const getUtcWeekStart = (value: Date) => {
  const normalized = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() - (day - 1));
  normalized.setUTCHours(0, 0, 0, 0);
  return normalized;
};

const getWeeklyPeriodKey = (value: Date) => {
  const weekStart = getUtcWeekStart(value);
  const year = weekStart.getUTCFullYear();
  const startOfYear = getUtcWeekStart(new Date(Date.UTC(year, 0, 4)));
  const diffInWeeks = Math.round((weekStart.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${year}-W${String(diffInWeeks + 1).padStart(2, "0")}`;
};

const buildDigestEmail = ({
  appBaseUrl,
  businessName,
  language,
  locale,
  notifications,
  recipientName,
}: {
  appBaseUrl: string;
  businessName: string;
  language: string | null | undefined;
  locale: string | null | undefined;
  notifications: NotificationRow[];
  recipientName: string;
}) => {
  const settingsUrl = `${appBaseUrl}/settings?tab=notifications`;
  const digestDate = formatTemplateDate(new Date(), locale);
  const subject = translateTemplate(language, "email.digest.subjectWeekly", {
    businessName,
    date: digestDate,
  });
  const heading = translateTemplate(language, "email.digest.headingWeekly", { businessName });
  const greeting = translateTemplate(language, "email.digest.greeting", { name: recipientName });
  const intro = translateTemplate(language, "email.digest.introWeekly");
  const emptyState = translateTemplate(language, "email.digest.noWeekly");
  const manageSettingsLabel = translateTemplate(language, "email.digest.manageSettings");
  const itemsHtml =
    notifications.length > 0
      ? notifications
          .map(
            (item) => `
              <li style="margin-bottom: 12px;">
                <strong>${escapeHtml(item.title)}</strong><br />
                <span style="color: #475569;">${escapeHtml(item.body)}</span>
              </li>
            `,
          )
          .join("")
      : `<li style="margin-bottom: 12px;">${escapeHtml(emptyState)}</li>`;
  const itemsText =
    notifications.length > 0
      ? notifications.map((item) => `- ${item.title}: ${item.body}`).join("\n")
      : `- ${emptyState}`;
  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h2 style="margin-bottom: 12px;">${escapeHtml(heading)}</h2>
      <p>${escapeHtml(greeting)}</p>
      <p>${escapeHtml(intro)}</p>
      <ul style="padding-left: 20px;">${itemsHtml}</ul>
      <p style="margin: 24px 0;">
        <a href="${escapeHtml(settingsUrl)}" style="background: #17324d; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 10px; display: inline-block;">
          ${escapeHtml(manageSettingsLabel)}
        </a>
      </p>
    </div>
  `;
  const text = [
    greeting,
    "",
    intro,
    itemsText,
    "",
    `${manageSettingsLabel}: ${settingsUrl}`,
  ].join("\n");

  return { html, subject, text };
};

const sendViaResend = async ({
  fromAddress,
  html,
  recipientEmail,
  resendApiKey,
  subject,
  text,
}: {
  fromAddress: string;
  html: string;
  recipientEmail: string;
  resendApiKey: string;
  subject: string;
  text: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [recipientEmail],
      subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMessage =
      typeof payload?.message === "string" ? payload.message : "The email provider rejected the delivery request.";
    throw new Error(errorMessage);
  }

  return payload as { id?: string };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";
  const digestCronSecret = Deno.env.get("DIGEST_CRON_SECRET")?.trim() ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for scheduled digests." }, 500);
  }

  if (!resendApiKey || !fromAddress) {
    return json(
      { error: "Missing RESEND_API_KEY or EMAIL_FROM_ADDRESS environment configuration for scheduled digests." },
      500,
    );
  }

  if (!digestCronSecret) {
    return json({ error: "Missing DIGEST_CRON_SECRET environment configuration." }, 500);
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (!headerSecret || headerSecret !== digestCronSecret) {
    return json({ error: "Unauthorized." }, 401);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const appBaseUrl = getAppBaseUrl(request);
  const now = new Date();
  const periodKey = getWeeklyPeriodKey(now);
  const windowStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const safeInsertAuditLog = async (values: {
    action: string;
    actorUserId?: string | null;
    businessId: string;
    detail: Record<string, unknown>;
    entityId: string | null;
    summary: string;
  }) => {
    try {
      await adminClient.from("audit_logs").insert({
        action: values.action,
        actor_user_id: values.actorUserId ?? null,
        business_id: values.businessId,
        detail: values.detail,
        entity_id: values.entityId,
        entity_type: "scheduled_digest_run",
        summary: values.summary,
      });
    } catch (auditError) {
      console.error("Unable to record scheduled digest audit log", auditError);
    }
  };

  const safeRecordEmailDelivery = async (values: {
    businessId: string;
    errorMessage?: string | null;
    metadata: Record<string, unknown>;
    recipientEmail: string;
    status: "failed" | "sent";
    subject: string;
  }) => {
    try {
      const { data } = await adminClient
        .from("email_deliveries")
        .insert({
          business_id: values.businessId,
          error_message: values.errorMessage ?? null,
          metadata: values.metadata,
          provider: "resend",
          recipient_email: values.recipientEmail,
          sent_at: values.status === "sent" ? new Date().toISOString() : null,
          status: values.status,
          subject: values.subject,
          template_key: "scheduled-weekly-digest",
        })
        .select("id")
        .single();

      return data?.id ?? null;
    } catch (recordError) {
      console.error("Unable to record scheduled digest email delivery", recordError);
      return null;
    }
  };

  const safeRecordDigestRun = async (values: {
    businessId: string;
    emailDeliveryId: string | null;
    errorMessage?: string | null;
    itemCount: number;
    scheduledFor: string;
    status: "failed" | "sent";
    userId: string;
  }) => {
    try {
      const { data } = await adminClient
        .from("scheduled_digest_runs")
        .insert({
          business_id: values.businessId,
          email_delivery_id: values.emailDeliveryId,
          error_message: values.errorMessage ?? null,
          item_count: values.itemCount,
          period_key: periodKey,
          scheduled_for: values.scheduledFor,
          status: values.status,
          user_id: values.userId,
        })
        .select("id")
        .single();

      return data?.id ?? null;
    } catch (runError) {
      console.error("Unable to record scheduled digest run", runError);
      return null;
    }
  };

  const { data: preferenceRows, error: preferenceError } = await adminClient
    .from("notification_preferences")
    .select("business_id, user_id")
    .eq("email_digest", true)
    .eq("weekly_report", true);

  if (preferenceError) {
    return json({ error: preferenceError.message }, 500);
  }

  const preferences = (preferenceRows ?? []) as NotificationPreferenceRow[];
  if (preferences.length === 0) {
    return json({ attempted: 0, delivered: 0, failed: 0, skipped: 0, message: "No eligible digest recipients." });
  }

  const businessIds = [...new Set(preferences.map((row) => row.business_id))];
  const userIds = [...new Set(preferences.map((row) => row.user_id))];

  const [membershipsResponse, businessesResponse, profilesResponse] = await Promise.all([
    adminClient
      .from("business_members")
      .select("business_id, user_id, status")
      .in("business_id", businessIds)
      .in("user_id", userIds),
    adminClient.from("businesses").select("id, name, default_language, default_locale").in("id", businessIds),
    adminClient.from("profiles").select("id, full_name, language, locale").in("id", userIds),
  ]);

  if (membershipsResponse.error) {
    return json({ error: membershipsResponse.error.message }, 500);
  }

  if (businessesResponse.error) {
    return json({ error: businessesResponse.error.message }, 500);
  }

  if (profilesResponse.error) {
    return json({ error: profilesResponse.error.message }, 500);
  }

  const activeMembershipKeys = new Set(
    ((membershipsResponse.data ?? []) as BusinessMembershipRow[])
      .filter((row) => row.status === "active")
      .map((row) => `${row.business_id}:${row.user_id}`),
  );
  const businesses = new Map(((businessesResponse.data ?? []) as BusinessRow[]).map((row) => [row.id, row]));
  const profiles = new Map(((profilesResponse.data ?? []) as ProfileRow[]).map((row) => [row.id, row]));

  let delivered = 0;
  let failed = 0;
  let skipped = 0;

  for (const preference of preferences) {
    const membershipKey = `${preference.business_id}:${preference.user_id}`;
    if (!activeMembershipKeys.has(membershipKey)) {
      skipped += 1;
      continue;
    }

    const business = businesses.get(preference.business_id);
    if (!business?.name) {
      skipped += 1;
      continue;
    }

    const { data: existingRun } = await adminClient
      .from("scheduled_digest_runs")
      .select("id")
      .eq("business_id", preference.business_id)
      .eq("user_id", preference.user_id)
      .eq("period_key", periodKey)
      .eq("status", "sent")
      .maybeSingle();

    if (existingRun?.id) {
      skipped += 1;
      continue;
    }

    const { data: authUserData, error: authUserError } = await adminClient.auth.admin.getUserById(preference.user_id);
    const recipientEmail = authUserData.user?.email?.trim().toLowerCase() ?? "";

    if (authUserError || !recipientEmail) {
      failed += 1;
      const runId = await safeRecordDigestRun({
        businessId: preference.business_id,
        emailDeliveryId: null,
        errorMessage: "Recipient account email could not be loaded.",
        itemCount: 0,
        scheduledFor: now.toISOString(),
        status: "failed",
        userId: preference.user_id,
      });
      await safeInsertAuditLog({
        action: "notification.digest_scheduled.failed",
        actorUserId: null,
        businessId: preference.business_id,
        detail: {
          description: "Recipient account email could not be loaded for the scheduled digest.",
          user_id: preference.user_id,
        },
        entityId: runId,
        summary: "Scheduled digest failed",
      });
      continue;
    }

    const { data: notifications, error: notificationsError } = await adminClient
      .from("notifications")
      .select("title, body, created_at")
      .eq("business_id", preference.business_id)
      .eq("recipient_user_id", preference.user_id)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(6);

    if (notificationsError) {
      failed += 1;
      const runId = await safeRecordDigestRun({
        businessId: preference.business_id,
        emailDeliveryId: null,
        errorMessage: notificationsError.message,
        itemCount: 0,
        scheduledFor: now.toISOString(),
        status: "failed",
        userId: preference.user_id,
      });
      await safeInsertAuditLog({
        action: "notification.digest_scheduled.failed",
        actorUserId: null,
        businessId: preference.business_id,
        detail: {
          description: notificationsError.message,
          recipient_email: recipientEmail,
        },
        entityId: runId,
        summary: "Scheduled digest failed",
      });
      continue;
    }

    const recipientName =
      profiles.get(preference.user_id)?.full_name?.trim() ||
      (typeof authUserData.user?.user_metadata?.name === "string" ? authUserData.user.user_metadata.name.trim() : "") ||
      recipientEmail;
    const recipientProfile = profiles.get(preference.user_id) ?? null;
    const templateLanguage = normalizeTemplateLanguage(recipientProfile?.language ?? business.default_language);
    const templateLocale = normalizeTemplateLocale(recipientProfile?.locale ?? business.default_locale);

    const digestEmail = buildDigestEmail({
      appBaseUrl,
      businessName: business.name,
      language: templateLanguage,
      locale: templateLocale,
      notifications: (notifications ?? []) as NotificationRow[],
      recipientName,
    });

    try {
      const providerResponse = await sendViaResend({
        fromAddress,
        html: digestEmail.html,
        recipientEmail,
        resendApiKey,
        subject: digestEmail.subject,
        text: digestEmail.text,
      });
      const emailDeliveryId = await safeRecordEmailDelivery({
        businessId: preference.business_id,
        metadata: {
          automation: "weekly",
          business_name: business.name,
          item_count: notifications?.length ?? 0,
          period_key: periodKey,
          provider_id: providerResponse.id ?? null,
          recipient_name: recipientName,
        },
        recipientEmail,
        status: "sent",
        subject: digestEmail.subject,
      });
      const runId = await safeRecordDigestRun({
        businessId: preference.business_id,
        emailDeliveryId,
        itemCount: notifications?.length ?? 0,
        scheduledFor: now.toISOString(),
        status: "sent",
        userId: preference.user_id,
      });
      await safeInsertAuditLog({
        action: "notification.digest_scheduled.sent",
        actorUserId: null,
        businessId: preference.business_id,
        detail: {
          description: `Scheduled weekly digest sent to ${recipientEmail}.`,
          item_count: notifications?.length ?? 0,
          period_key: periodKey,
          provider: "resend",
        },
        entityId: runId,
        summary: "Scheduled digest sent",
      });
      delivered += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The scheduled digest request failed.";
      const emailDeliveryId = await safeRecordEmailDelivery({
        businessId: preference.business_id,
        errorMessage: message,
        metadata: {
          automation: "weekly",
          business_name: business.name,
          period_key: periodKey,
        },
        recipientEmail,
        status: "failed",
        subject: digestEmail.subject,
      });
      const runId = await safeRecordDigestRun({
        businessId: preference.business_id,
        emailDeliveryId,
        errorMessage: message,
        itemCount: notifications?.length ?? 0,
        scheduledFor: now.toISOString(),
        status: "failed",
        userId: preference.user_id,
      });
      await safeInsertAuditLog({
        action: "notification.digest_scheduled.failed",
        actorUserId: null,
        businessId: preference.business_id,
        detail: {
          description: message,
          recipient_email: recipientEmail,
        },
        entityId: runId,
        summary: "Scheduled digest failed",
      });
      failed += 1;
    }
  }

  return json({
    attempted: preferences.length,
    delivered,
    failed,
    periodKey,
    skipped,
  });
});
