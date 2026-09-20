export type AuthenticatorAssuranceLevel = "aal1" | "aal2" | null;

export type MfaFactorStatus = "unverified" | "verified";

export type AppAuthMethod = {
  method: string;
  verifiedAt: string | null;
};

export type AppMfaFactor = {
  createdAt: string;
  factorType: string;
  friendlyName: string | null;
  id: string;
  lastChallengedAt: string | null;
  status: MfaFactorStatus;
  updatedAt: string;
};

export type AppMfaState = {
  authMethods: AppAuthMethod[];
  currentLevel: AuthenticatorAssuranceLevel;
  factors: AppMfaFactor[];
  isEnabled: boolean;
  isRequired: boolean;
  nextLevel: AuthenticatorAssuranceLevel;
  preferredFactorId: string | null;
  verifiedFactors: AppMfaFactor[];
};

type RawMfaFactor = {
  created_at: string;
  factor_type: string;
  friendly_name?: string;
  id: string;
  last_challenged_at?: string;
  status: MfaFactorStatus;
  updated_at: string;
};

type RawAuthMethod =
  | string
  | {
      method: string;
      timestamp?: number;
    };

export const createEmptyMfaState = (): AppMfaState => ({
  authMethods: [],
  currentLevel: null,
  factors: [],
  isEnabled: false,
  isRequired: false,
  nextLevel: null,
  preferredFactorId: null,
  verifiedFactors: [],
});

export const mapMfaFactor = (factor: RawMfaFactor): AppMfaFactor => ({
  createdAt: factor.created_at,
  factorType: factor.factor_type,
  friendlyName: factor.friendly_name ?? null,
  id: factor.id,
  lastChallengedAt: factor.last_challenged_at ?? null,
  status: factor.status,
  updatedAt: factor.updated_at,
});

export const mapAuthMethod = (method: RawAuthMethod): AppAuthMethod => {
  if (typeof method === "string") {
    return {
      method,
      verifiedAt: null,
    };
  }

  return {
    method: method.method,
    verifiedAt: typeof method.timestamp === "number" ? new Date(method.timestamp * 1000).toISOString() : null,
  };
};

export const buildMfaState = ({
  currentAuthenticationMethods,
  currentLevel,
  factors,
  nextLevel,
}: {
  currentAuthenticationMethods?: RawAuthMethod[];
  currentLevel: AuthenticatorAssuranceLevel;
  factors: RawMfaFactor[];
  nextLevel: AuthenticatorAssuranceLevel;
}): AppMfaState => {
  const authMethods = (currentAuthenticationMethods ?? []).map(mapAuthMethod);
  const mappedFactors = factors.map(mapMfaFactor);
  const verifiedFactors = mappedFactors
    .filter((factor) => factor.status === "verified")
    .sort((leftFactor, rightFactor) => rightFactor.updatedAt.localeCompare(leftFactor.updatedAt));
  const isEnabled = verifiedFactors.length > 0;
  const isRequired =
    currentLevel !== null &&
    nextLevel !== null &&
    currentLevel !== nextLevel &&
    nextLevel === "aal2" &&
    verifiedFactors.length > 0;

  return {
    authMethods,
    currentLevel,
    factors: mappedFactors,
    isEnabled,
    isRequired,
    nextLevel,
    preferredFactorId: verifiedFactors[0]?.id ?? null,
    verifiedFactors,
  };
};

export const validateTotpCode = (value: string) =>
  /^\d{6}$/.test(value.trim()) ? null : "Enter the 6-digit code from your authenticator app.";
