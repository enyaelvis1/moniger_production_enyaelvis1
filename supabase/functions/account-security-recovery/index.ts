import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type RecoveryAction = "consume-code" | "generate-codes";

type GenerateCodesRequest = {
  action: "generate-codes";
  businessId?: string;
};

type ConsumeCodeRequest = {
  action: "consume-code";
  code: string;
};

type RecoveryRequest = ConsumeCodeRequest | GenerateCodesRequest;

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const recoveryCodeLength = 12;
const recoveryCodeCount = 8;

const normalizeRecoveryCode = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

const formatRecoveryCode = (value: string) => normalizeRecoveryCode(value).replace(/(.{4})(?=.)/g, "$1-");

const generateRecoveryCode = () => {
  const values = new Uint32Array(recoveryCodeLength);
  crypto.getRandomValues(values);
  const rawCode = Array.from(values, (value) => recoveryAlphabet[value % recoveryAlphabet.length]).join("");

  return formatRecoveryCode(rawCode);
};

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");

const hashRecoveryCode = async (value: string) => {
  const normalized = normalizeRecoveryCode(value);
  const data = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
};

const getJwtPayload = (authorizationHeader: string | null) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  try {
    const [, token] = authorizationHeader.split(" ");
    const [, payloadSegment] = token.split(".");

    if (!payloadSegment) {
      return null;
    }

    return JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const getPrimaryBusinessId = async (adminClient: ReturnType<typeof createClient>, userId: string) => {
  const { data } = await adminClient
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.business_id ?? null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Supabase environment variables are not configured for account recovery." }, 500);
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing authorization header." }, 401);
  }

  const requestClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await requestClient.auth.getUser();

  if (userError || !user) {
    return json({ error: "You need an active session before using account recovery." }, 401);
  }

  let payload: RecoveryRequest;
  try {
    payload = (await request.json()) as RecoveryRequest;
  } catch {
    return json({ error: "The account recovery request body is invalid." }, 400);
  }

  if (!payload.action) {
    return json({ error: "Missing recovery action." }, 400);
  }

  if (payload.action === "generate-codes") {
    const factorsResponse = await requestClient.auth.mfa.listFactors();

    if (factorsResponse.error) {
      return json({ error: factorsResponse.error.message }, 400);
    }

    const verifiedFactors = factorsResponse.data.all.filter((factor) => factor.status === "verified");
    if (verifiedFactors.length === 0) {
      return json({ error: "Add and verify an authenticator app before generating recovery codes." }, 400);
    }

    const codes = Array.from({ length: recoveryCodeCount }, () => generateRecoveryCode());
    const hashedCodes = await Promise.all(
      codes.map(async (code) => ({
        code_hash: await hashRecoveryCode(code),
        code_hint: code.slice(-4),
        user_id: user.id,
      })),
    );
    const generatedAt = new Date().toISOString();
    const businessId = payload.businessId ?? (await getPrimaryBusinessId(adminClient, user.id));

    await adminClient.from("mfa_recovery_codes").delete().eq("user_id", user.id);
    await adminClient.from("mfa_recovery_sessions").delete().eq("user_id", user.id);

    const insertResponse = await adminClient.from("mfa_recovery_codes").insert(hashedCodes);
    if (insertResponse.error) {
      return json({ error: insertResponse.error.message }, 500);
    }

    if (businessId) {
      await adminClient.from("audit_logs").insert({
        action: "security.mfa.recovery_codes.generated",
        actor_user_id: user.id,
        business_id: businessId,
        detail: {
          code_count: recoveryCodeCount,
          description: `Generated ${recoveryCodeCount} MFA recovery codes.`,
        },
        entity_id: user.id,
        entity_type: "profile",
        summary: "MFA recovery codes generated",
      });
    }

    return json({
      codes,
      generatedAt,
      remainingCodes: recoveryCodeCount,
    });
  }

  const normalizedCode = normalizeRecoveryCode(payload.code);
  if (normalizedCode.length !== recoveryCodeLength) {
    return json({ error: "Enter a valid MFA recovery code." }, 400);
  }

  const codeHash = await hashRecoveryCode(normalizedCode);
  const jwtPayload = getJwtPayload(authHeader);
  const sessionId = jwtPayload && typeof jwtPayload.session_id === "string" ? jwtPayload.session_id : null;
  const expiresAt =
    jwtPayload && typeof jwtPayload.exp === "number" ? new Date(jwtPayload.exp * 1000).toISOString() : null;

  if (!sessionId || !expiresAt) {
    return json({ error: "We could not determine the current session for recovery." }, 400);
  }

  const { data: recoveryCode } = await adminClient
    .from("mfa_recovery_codes")
    .select("id")
    .eq("user_id", user.id)
    .eq("code_hash", codeHash)
    .is("used_at", null)
    .maybeSingle();

  if (!recoveryCode?.id) {
    return json({ error: "That recovery code is invalid or has already been used." }, 400);
  }

  const businessId = await getPrimaryBusinessId(adminClient, user.id);
  const now = new Date().toISOString();

  await adminClient
    .from("mfa_recovery_codes")
    .update({
      used_at: now,
      used_session_id: sessionId,
    })
    .eq("id", recoveryCode.id);

  await adminClient
    .from("mfa_recovery_sessions")
    .upsert(
      {
        session_id: sessionId,
        user_id: user.id,
        recovery_code_id: recoveryCode.id,
        expires_at: expiresAt,
      },
      { onConflict: "session_id" },
    );

  if (businessId) {
    await adminClient.from("audit_logs").insert({
      action: "security.mfa.recovery_code.used",
      actor_user_id: user.id,
      business_id: businessId,
      detail: {
        description: "An MFA recovery code was used to continue this session.",
        session_id: sessionId,
      },
      entity_id: user.id,
      entity_type: "profile",
      summary: "MFA recovery code used",
    });
  }

  return json({
    expiresAt,
    sessionId,
  });
});
