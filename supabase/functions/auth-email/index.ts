import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { buildPasswordResetEmail } from "../_shared/auth-reset-email.ts";

type AuthEmailAction = "password_reset";

type AuthEmailRequestPayload = {
  action: AuthEmailAction;
  email: string;
};

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const PASSWORD_RESET_WINDOW_MS = 15 * 60 * 1000;
const PASSWORD_RESET_EMAIL_MAX_ATTEMPTS = 3;
const PASSWORD_RESET_IP_MAX_ATTEMPTS = 10;

const json = (body: Record<string, unknown>, status = 200, extraHeaders: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asRecord = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {});

const parsePayload = async (request: Request): Promise<AuthEmailRequestPayload> => {
  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    action: asString(payload.action) as AuthEmailAction,
    email: asString(payload.email).trim().toLowerCase(),
  };
};

const getAppBaseUrl = (_request: Request) => {
  const configuredUrl = Deno.env.get("APP_BASE_URL")?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  throw new Error("APP_BASE_URL is required for password reset email delivery.");
};

const getClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) {
    return forwardedFor;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "";
};

const hashValue = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getRateLimitWindowStart = (now = Date.now()) => {
  const bucketStart = Math.floor(now / PASSWORD_RESET_WINDOW_MS) * PASSWORD_RESET_WINDOW_MS;
  return new Date(bucketStart).toISOString();
};

const getRetryAfterSeconds = (now = Date.now()) => {
  const windowStartedAt = new Date(getRateLimitWindowStart(now)).getTime();
  const windowEndsAt = windowStartedAt + PASSWORD_RESET_WINDOW_MS;
  return Math.max(1, Math.ceil((windowEndsAt - now) / 1000));
};

const isUnknownUserError = (error: unknown) => {
  const message = error instanceof Error ? error.message : asString(error);
  const normalized = message.trim().toLowerCase();
  return normalized.includes("user with this email not found") || normalized.includes("user not found");
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

const bumpRateLimitWindow = async ({
  adminClient,
  action,
  keyHash,
  scope,
  windowStartedAt,
}: {
  adminClient: ReturnType<typeof createClient>;
  action: string;
  keyHash: string;
  scope: "email" | "ip";
  windowStartedAt: string;
}) => {
  const response = await adminClient.rpc("bump_auth_email_rate_limit_window", {
    p_action: action,
    p_key_hash: keyHash,
    p_scope: scope,
    p_window_started_at: windowStartedAt,
  });

  if (response.error) {
    throw response.error;
  }

  return typeof response.data === "number" ? response.data : Number(response.data ?? 0);
};

const resolveRecipientName = async ({
  adminClient,
  email,
  generatedLinkData,
}: {
  adminClient: ReturnType<typeof createClient>;
  email: string;
  generatedLinkData: unknown;
}) => {
  const dataRecord = asRecord(generatedLinkData);
  const userRecord = asRecord(dataRecord.user);
  const userMetadata = asRecord(userRecord.user_metadata);
  const metadataName = [
    asString(userMetadata.full_name).trim(),
    asString(userMetadata.name).trim(),
    asString(userMetadata.display_name).trim(),
  ].find(Boolean);

  if (metadataName) {
    return metadataName;
  }

  const userId = asString(userRecord.id).trim();
  if (userId) {
    const profileResponse = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileResponse.error) {
      throw profileResponse.error;
    }

    const profileName = asString(profileResponse.data?.full_name).trim();
    if (profileName) {
      return profileName;
    }
  }

  return email.split("@")[0]?.trim() || null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const { action, email } = await parsePayload(request);

    if (action !== "password_reset") {
      return json({ error: "Unknown auth email action." }, 400);
    }

    if (!email || !email.includes("@")) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Supabase auth email delivery is not configured." }, 500);
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY")?.trim() ?? "";
    const fromAddress = Deno.env.get("EMAIL_FROM_ADDRESS")?.trim() ?? "";

    if (!resendApiKey || !fromAddress) {
      return json({ error: "Missing RESEND_API_KEY or EMAIL_FROM_ADDRESS environment configuration." }, 500);
    }

    const appBaseUrl = getAppBaseUrl(request);
    const redirectTo = `${appBaseUrl}/reset-password`;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = Date.now();
    const windowStartedAt = getRateLimitWindowStart(now);
    const retryAfterSeconds = getRetryAfterSeconds(now);
    const emailHash = await hashValue(email);
    const emailAttemptCount = await bumpRateLimitWindow({
      adminClient,
      action,
      keyHash: emailHash,
      scope: "email",
      windowStartedAt,
    });

    if (emailAttemptCount > PASSWORD_RESET_EMAIL_MAX_ATTEMPTS) {
      return json(
        { error: "Too many password reset requests for this email. Please wait a few minutes and try again." },
        429,
        { "Retry-After": String(retryAfterSeconds) },
      );
    }

    const clientIp = getClientIp(request);
    if (clientIp) {
      const ipHash = await hashValue(clientIp);
      const ipAttemptCount = await bumpRateLimitWindow({
        adminClient,
        action,
        keyHash: ipHash,
        scope: "ip",
        windowStartedAt,
      });

      if (ipAttemptCount > PASSWORD_RESET_IP_MAX_ATTEMPTS) {
        return json(
          { error: "Too many password reset attempts from this connection. Please wait a few minutes and try again." },
          429,
          { "Retry-After": String(retryAfterSeconds) },
        );
      }
    }

    const linkResponse = await adminClient.auth.admin.generateLink({
      email,
      options: { redirectTo },
      type: "recovery",
    });

    if (linkResponse.error) {
      if (isUnknownUserError(linkResponse.error)) {
        return json({ ok: true });
      }

      throw linkResponse.error;
    }

    const actionLink = typeof linkResponse.data.properties?.action_link === "string"
      ? linkResponse.data.properties.action_link
      : "";

    if (actionLink) {
      const recipientName = await resolveRecipientName({
        adminClient,
        email,
        generatedLinkData: linkResponse.data,
      });
      const emailContent = buildPasswordResetEmail({
        actionLink,
        recipientEmail: email,
        appBaseUrl,
        recipientName,
      });

      await sendViaResend({
        fromAddress,
        html: emailContent.html,
        recipientEmail: email,
        resendApiKey,
        subject: emailContent.subject,
        text: emailContent.text,
      });
    }

    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return json({ error: message }, 500);
  }
});
