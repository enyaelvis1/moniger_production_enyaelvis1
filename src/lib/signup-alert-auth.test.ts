import { describe, expect, it } from "vitest";
import {
  buildSignupAlertSignaturePayload,
  isSignupAlertTimestampFresh,
  isValidSignupAlertUserId,
  signSignupAlertPayload,
  verifySignupAlertSignature,
} from "../../supabase/functions/_shared/signup-alert-auth";

describe("signup alert request authentication", () => {
  it("accepts a timestamp inside the five-minute replay window", () => {
    expect(isSignupAlertTimestampFresh({ issuedAt: 1_000, nowSeconds: 1_299 })).toBe(true);
    expect(isSignupAlertTimestampFresh({ issuedAt: 1_000, nowSeconds: 1_301 })).toBe(false);
  });

  it("rejects timestamps that are not safe integers", () => {
    expect(isSignupAlertTimestampFresh({ issuedAt: Number.NaN, nowSeconds: 1_000 })).toBe(false);
    expect(isSignupAlertTimestampFresh({ issuedAt: 1.5, nowSeconds: 1_000 })).toBe(false);
  });

  it("rejects malformed user identifiers before any privileged lookup", () => {
    expect(isValidSignupAlertUserId("not-a-user-id")).toBe(false);
    expect(isValidSignupAlertUserId("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });

  it("verifies the signed request and rejects tampering or the wrong secret", async () => {
    const payload = buildSignupAlertSignaturePayload({
      issuedAt: 1_000,
      nonce: "nonce-1",
      plan: "growth",
      userId: "user-1",
    });
    const signature = await signSignupAlertPayload(payload, "server-secret");

    await expect(verifySignupAlertSignature({ payload, providedSignature: signature, secret: "server-secret" })).resolves.toBe(true);
    await expect(verifySignupAlertSignature({ payload: `${payload}-tampered`, providedSignature: signature, secret: "server-secret" })).resolves.toBe(false);
    await expect(verifySignupAlertSignature({ payload, providedSignature: signature, secret: "wrong-secret" })).resolves.toBe(false);
    await expect(verifySignupAlertSignature({ payload, providedSignature: "", secret: "server-secret" })).resolves.toBe(false);
  });
});
