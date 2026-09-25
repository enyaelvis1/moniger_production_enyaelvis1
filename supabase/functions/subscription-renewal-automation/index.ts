import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { escapeHtml, renderBrandedEmail } from "../_shared/branded-email.ts";

type SubscriptionRow = {
  amount: number | string;
  business_id: string;
  currency: string;
  next_renewal_at: string | null;
  plan: "business" | "growth" | "starter";
  status: "active" | "past_due";
};

type BusinessRow = { id: string; name: string; owner_user_id: string };
type NoticeType = "14_day" | "48_hour" | "expired";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const planLabel = (plan: SubscriptionRow["plan"]) => plan.charAt(0).toUpperCase() + plan.slice(1);

const buildEmail = ({
  appBaseUrl,
  businessName,
  noticeType,
  plan,
  renewalAt,
}: {
  appBaseUrl: string;
  businessName: string;
  noticeType: NoticeType;
  plan: SubscriptionRow["plan"];
  renewalAt: string;
}) => {
  const label = planLabel(plan);
  const renewalDate = new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(new Date(renewalAt));
  const isExpired = noticeType === "expired";
  const timing = noticeType === "14_day" ? "in 14 days" : noticeType === "48_hour" ? "in 48 hours" : "has expired";
  const subject = isExpired
    ? `Your Moniger ${label} subscription has expired`
    : `Your Moniger ${label} subscription renews ${timing}`;
  const heading = isExpired ? "Your workspace is paused" : `Renewal reminder: ${timing}`;
  const bodyHtml = `
    <p>Your <strong>${escapeHtml(label)}</strong> subscription for <strong>${escapeHtml(businessName)}</strong> ${isExpired ? "has expired and paid workspace features are now paused." : `is scheduled to renew ${escapeHtml(timing)}.`}</p>
    <p>Renewal date: <strong>${escapeHtml(renewalDate)}</strong></p>
    <p>${isExpired ? "Renew now to restore access to workspace operations." : "Please make sure your payment method is ready to avoid interruption."}</p>
  `;
  const settingsUrl = `${appBaseUrl}/settings?tab=business`;
  const email = renderBrandedEmail({
    subject,
    preheader: subject,
    heading,
    bodyHtml,
    cta: { href: settingsUrl, label: isExpired ? "Renew subscription" : "Review subscription" },
    footerText: businessName,
    logoUrl: `${appBaseUrl}/logo.png`,
    logoAlt: "Moniger",
    brandHref: appBaseUrl,
  });
  return { ...email, renewalDate };
};

const sendViaResend = async ({
  apiKey,
  from,
  html,
  subject,
  text,
  to,
}: {
  apiKey: string;
  from: string;
  html: string;
  subject: string;
  text: string;
  to: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : "Email provider rejected delivery.");
  return payload as { id?: string };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
  const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
  const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";
  const cronSecret = Deno.env.get("SUBSCRIPTION_RENEWAL_CRON_SECRET")?.trim() ?? "";
  const receivedSecret = request.headers.get("x-cron-secret")?.trim() ?? "";

  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromAddress || !cronSecret) {
    return json({ error: "Subscription renewal automation is not configured." }, 500);
  }
  if (receivedSecret !== cronSecret) return json({ error: "Unauthorized." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const appBaseUrl = (Deno.env.get("APP_BASE_URL")?.trim() || "https://moniger.net").replace(/\/$/, "");
  const now = new Date();
  const nowMs = now.getTime();
  const fourteenDayStart = new Date(nowMs + 13 * 24 * 60 * 60 * 1000);
  const fourteenDayEnd = new Date(nowMs + 15 * 24 * 60 * 60 * 1000);
  const fortyEightHourStart = new Date(nowMs + 36 * 60 * 60 * 1000);
  const fortyEightHourEnd = new Date(nowMs + 60 * 60 * 60 * 1000);

  const { data: rows, error: subscriptionError } = await adminClient
    .from("business_subscriptions")
    .select("amount, business_id, currency, next_renewal_at, plan, status")
    .in("plan", ["growth", "business"])
    .in("status", ["active", "past_due"])
    .not("next_renewal_at", "is", null);
  if (subscriptionError) return json({ error: subscriptionError.message }, 500);

  const subscriptions = (rows ?? []) as SubscriptionRow[];
  const businessIds = subscriptions.map((row) => row.business_id);
  const { data: businesses, error: businessesError } = await adminClient
    .from("businesses")
    .select("id, name, owner_user_id")
    .in("id", businessIds);
  if (businessesError) return json({ error: businessesError.message }, 500);
  const businessMap = new Map(((businesses ?? []) as BusinessRow[]).map((business) => [business.id, business]));

  let sent = 0;
  let expired = 0;
  let skipped = 0;
  let failed = 0;

  const deliver = async (subscription: SubscriptionRow, business: BusinessRow, noticeType: NoticeType, renewalAt: string) => {
    const { data: claim, error: claimError } = await adminClient
      .from("subscription_renewal_notifications")
      .insert({ business_id: business.id, notice_type: noticeType, renewal_at: renewalAt, user_id: business.owner_user_id })
      .select("id")
      .maybeSingle();
    if (claimError?.code === "23505") {
      skipped += 1;
      return;
    }
    if (claimError || !claim?.id) {
      failed += 1;
      return;
    }

    try {
      const authUser = await adminClient.auth.admin.getUserById(business.owner_user_id);
      const recipient = authUser.data.user?.email?.trim().toLowerCase() ?? "";
      if (!recipient) throw new Error("Workspace owner email could not be loaded.");
      const email = buildEmail({ appBaseUrl, businessName: business.name, noticeType, plan: subscription.plan, renewalAt });
      const provider = await sendViaResend({
        apiKey: resendApiKey,
        from: fromAddress,
        html: email.html,
        subject: email.subject,
        text: `${email.subject}\n\nRenewal date: ${email.renewalDate}\n\nOpen Moniger: ${appBaseUrl}/settings?tab=business`,
        to: recipient,
      });
      await adminClient.from("subscription_renewal_notifications").update({ provider_message_id: provider.id ?? null, sent_at: new Date().toISOString(), status: "sent" }).eq("id", claim.id);
      await adminClient.from("email_deliveries").insert({
        business_id: business.id,
        metadata: { notice_type: noticeType, provider_id: provider.id ?? null, renewal_at: renewalAt },
        provider: "resend",
        recipient_email: recipient,
        sent_at: new Date().toISOString(),
        status: "sent",
        subject: email.subject,
        template_key: `subscription-renewal-${noticeType}`,
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await adminClient.from("subscription_renewal_notifications").update({ error_message: error instanceof Error ? error.message : "Email delivery failed.", status: "failed" }).eq("id", claim.id);
    }
  };

  for (const subscription of subscriptions) {
    const renewalAt = subscription.next_renewal_at;
    const business = businessMap.get(subscription.business_id);
    if (!renewalAt || !business?.name) {
      skipped += 1;
      continue;
    }
    const renewalDate = new Date(renewalAt);
    if (renewalDate <= now) {
      const { data: expiredRows, error: expiryError } = await adminClient
        .from("business_subscriptions")
        .update({ expired_at: now.toISOString(), status: "expired", updated_at: now.toISOString() })
        .eq("business_id", subscription.business_id)
        .in("status", ["active", "past_due"])
        .lte("next_renewal_at", now.toISOString())
        .select("business_id");
      if (expiryError) {
        failed += 1;
        continue;
      }
      if ((expiredRows ?? []).length > 0) {
        expired += 1;
        await deliver(subscription, business, "expired", renewalAt);
      } else {
        skipped += 1;
      }
      continue;
    }
    if (renewalDate >= fourteenDayStart && renewalDate <= fourteenDayEnd) await deliver(subscription, business, "14_day", renewalAt);
    if (renewalDate >= fortyEightHourStart && renewalDate <= fortyEightHourEnd) await deliver(subscription, business, "48_hour", renewalAt);
  }

  return json({ expired, failed, processed: subscriptions.length, sent, skipped });
});
