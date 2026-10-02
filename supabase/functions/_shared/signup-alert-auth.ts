export const SIGNUP_ALERT_MAX_CLOCK_SKEW_SECONDS = 300;

export const isValidSignupAlertUserId = (userId: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);

export const buildSignupAlertSignaturePayload = ({
  issuedAt,
  nonce,
  plan,
  userId,
}: {
  issuedAt: number;
  nonce: string;
  plan: string;
  userId: string;
}) => `${plan}|${userId}|${issuedAt}|${nonce}`;

export const isSignupAlertTimestampFresh = ({
  nowSeconds = Math.floor(Date.now() / 1000),
  issuedAt,
}: {
  nowSeconds?: number;
  issuedAt: number;
}) => Number.isSafeInteger(issuedAt)
  && Math.abs(nowSeconds - issuedAt) <= SIGNUP_ALERT_MAX_CLOCK_SKEW_SECONDS;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const signSignupAlertPayload = async (payload: string, secret: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  return toHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
};

export const verifySignupAlertSignature = async ({
  payload,
  providedSignature,
  secret,
}: {
  payload: string;
  providedSignature: string;
  secret: string;
}) => {
  if (!/^[a-f0-9]{64}$/i.test(providedSignature)) return false;
  const expectedSignature = await signSignupAlertPayload(payload, secret);
  let differences = expectedSignature.length ^ providedSignature.length;
  for (let index = 0; index < expectedSignature.length; index += 1) {
    differences |= expectedSignature.charCodeAt(index) ^ (providedSignature.charCodeAt(index) || 0);
  }
  return differences === 0;
};
