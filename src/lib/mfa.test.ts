import { describe, expect, it } from "vitest";
import { buildMfaState, createEmptyMfaState, mapAuthMethod, validateTotpCode } from "@/lib/mfa";

describe("mfa helpers", () => {
  it("returns an empty MFA state by default", () => {
    expect(createEmptyMfaState()).toEqual({
      authMethods: [],
      currentLevel: null,
      factors: [],
      isEnabled: false,
      isRequired: false,
      nextLevel: null,
      preferredFactorId: null,
      verifiedFactors: [],
    });
  });

  it("marks MFA as required when the session is still at aal1 and a verified factor exists", () => {
    const mfaState = buildMfaState({
      currentLevel: "aal1",
      factors: [
        {
          created_at: "2026-04-13T09:00:00.000Z",
          factor_type: "totp",
          friendly_name: "Primary phone",
          id: "factor-1",
          status: "verified",
          updated_at: "2026-04-13T09:30:00.000Z",
        },
      ],
      currentAuthenticationMethods: [{ method: "password", timestamp: 1713000600 }],
      nextLevel: "aal2",
    });

    expect(mfaState.authMethods).toEqual([
      {
        method: "password",
        verifiedAt: "2024-04-13T09:30:00.000Z",
      },
    ]);
    expect(mfaState.isEnabled).toBe(true);
    expect(mfaState.isRequired).toBe(true);
    expect(mfaState.preferredFactorId).toBe("factor-1");
  });

  it("maps string and timestamped auth methods", () => {
    expect(mapAuthMethod("password")).toEqual({
      method: "password",
      verifiedAt: null,
    });
    expect(mapAuthMethod({ method: "totp", timestamp: 1713000600 })).toEqual({
      method: "totp",
      verifiedAt: "2024-04-13T09:30:00.000Z",
    });
  });

  it("validates six-digit TOTP codes", () => {
    expect(validateTotpCode("123456")).toBeNull();
    expect(validateTotpCode(" 123456 ")).toBeNull();
    expect(validateTotpCode("abc")).toBe("Enter the 6-digit code from your authenticator app.");
  });
});
