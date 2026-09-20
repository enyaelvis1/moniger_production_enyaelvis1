const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const recoveryCodeLength = 12;

export const normalizeRecoveryCode = (value: string) => value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

export const formatRecoveryCode = (value: string) => {
  const normalized = normalizeRecoveryCode(value);
  return normalized.replace(/(.{4})(?=.)/g, "$1-");
};

export const validateRecoveryCode = (value: string) =>
  normalizeRecoveryCode(value).length === recoveryCodeLength
    ? null
    : "Enter one of your 12-character backup recovery codes.";

export const createRecoveryCode = () => {
  const values = new Uint32Array(recoveryCodeLength);
  crypto.getRandomValues(values);

  const rawCode = Array.from(values, (value) => recoveryAlphabet[value % recoveryAlphabet.length]).join("");
  return formatRecoveryCode(rawCode);
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
};

export const getJwtPayload = (token: string) => {
  try {
    const [, payloadSegment] = token.split(".");

    if (!payloadSegment) {
      return null;
    }

    return JSON.parse(decodeBase64Url(payloadSegment)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const getSessionIdFromAccessToken = (token: string) => {
  const payload = getJwtPayload(token);
  return payload && typeof payload.session_id === "string" ? payload.session_id : null;
};
