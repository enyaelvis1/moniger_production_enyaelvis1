import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { renderBrandedEmail } from "../_shared/branded-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const asString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const MAX_MESSAGE_LENGTH = 300;
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const hashValue = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getClientIp = (request: Request) =>
  request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  request.headers.get("x-real-ip")?.trim() ||
  request.headers.get("cf-connecting-ip")?.trim() ||
  "unknown";

const sendEmail = async ({
  fromAddress,
  html,
  recipients,
  replyTo,
  resendApiKey,
  subject,
  text,
}: {
  fromAddress: string;
  html: string;
  recipients: string[];
  replyTo: string;
  resendApiKey: string;
  subject: string;
  text: string;
}) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: fromAddress, to: recipients, reply_to: replyTo, subject, html, text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload?.message === "string" ? payload.message : "The email provider rejected the message.");
  }
  return typeof payload?.id === "string" ? payload.id : null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let adminClient: ReturnType<typeof createClient> | null = null;
  let contactMessageId = "";
  try {
    const payload = await request.json().catch(() => ({})) as Record<string, unknown>;
    const fullName = asString(payload.fullName);
    const email = asString(payload.email).toLowerCase();
    const subject = asString(payload.subject);
    const message = asString(payload.message);
    const honeypot = asString(payload.website);

    if (honeypot) return json({ ok: true });
    if (!fullName || fullName.length > 120) return json({ error: "Enter your name." }, 400);
    if (!isValidEmail(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
    if (!subject || subject.length > 180) return json({ error: "Enter a subject." }, 400);
    if (!message || message.length > MAX_MESSAGE_LENGTH) return json({ error: `Enter a message under ${MAX_MESSAGE_LENGTH} characters.` }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
    const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";
    const configuredRecipients = Deno.env.get("CONTACT_RECIPIENT_EMAILS")?.trim() || Deno.env.get("CONTACT_RECIPIENT_EMAIL")?.trim() || "admin@moniger.net,foxyrule@gmail.com";
    const recipients = configuredRecipients.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromAddress || recipients.length === 0 || recipients.some((item) => !isValidEmail(item))) {
      return json({ error: "Contact delivery is not configured." }, 500);
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const ipHash = await hashValue(getClientIp(request));
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rateResponse = await adminClient.from("contact_messages").select("id", { count: "exact", head: true })
      .eq("requester_ip_hash", ipHash).gte("created_at", since);
    if (rateResponse.error) throw rateResponse.error;
    if ((rateResponse.count ?? 0) >= 5) return json({ error: "Too many messages from this connection. Please try again later." }, 429);

    const insertResponse = await adminClient.from("contact_messages").insert({ full_name: fullName, email, subject, message, requester_ip_hash: ipHash }).select("id").single();
    if (insertResponse.error) throw insertResponse.error;
    contactMessageId = insertResponse.data.id;

    const emailContent = renderBrandedEmail({
      subject: `[Contact] ${subject}`,
      preheader: `New message from ${fullName}`,
      heading: subject,
      bodyHtml: `<p><strong>From:</strong> ${escapeHtml(fullName)} &lt;${escapeHtml(email)}&gt;</p><div style="margin-top:16px; white-space:normal;">${escapeHtml(message).replace(/\n/g, "<br />")}</div>`,
      footerText: "Reply to this email to respond to the visitor.",
    });
    const providerMessageId = await sendEmail({ ...emailContent, fromAddress, recipients, replyTo: email, resendApiKey });
    await adminClient.from("contact_messages").update({ delivery_status: "sent", delivered_at: new Date().toISOString(), provider_message_id: providerMessageId }).eq("id", contactMessageId);
    return json({ ok: true, message: "Your message was sent. We will respond within 24 hours." });
  } catch (error) {
    if (adminClient && contactMessageId) {
      await adminClient.from("contact_messages").update({ delivery_status: "failed", failure_reason: error instanceof Error ? error.message : "Unknown delivery error" }).eq("id", contactMessageId);
    }
    return json({ error: error instanceof Error ? error.message : "Unable to send your message." }, 500);
  }
});
