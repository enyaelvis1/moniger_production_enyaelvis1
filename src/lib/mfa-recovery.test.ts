import { describe, expect, it, vi } from "vitest";
import {
  createRecoveryCode,
  formatRecoveryCode,
  getSessionIdFromAccessToken,
  normalizeRecoveryCode,
  validateRecoveryCode,
} from "@/lib/mfa-recovery";

describe("mfa recovery helpers", () => {
  it("normalizes and formats recovery codes", () => {
    expect(normalizeRecoveryCode("ab cd-1234 ef56")).toBe("ABCD1234EF56");
    expect(formatRecoveryCode("abcd1234ef56")).toBe("ABCD-1234-EF56");
  });

  it("validates 12-character recovery codes", () => {
    expect(validateRecoveryCode("ABCD-1234-EF56")).toBeNull();
    expect(validateRecoveryCode("short-code")).toBe("Enter one of your 12-character backup recovery codes.");
  });

  it("creates display-formatted recovery codes", () => {
    const getRandomValuesMock = vi.fn((values: Uint32Array) => {
      values.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      return values;
    });
    const originalCrypto = globalThis.crypto;

    vi.stubGlobal("crypto", {
      ...originalCrypto,
      getRandomValues: getRandomValuesMock,
    });

    expect(createRecoveryCode()).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

    vi.stubGlobal("crypto", originalCrypto);
  });

  it("reads the session id from an access token payload", () => {
    const payload = btoa(JSON.stringify({ session_id: "session-123" }))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const token = `header.${payload}.signature`;

    expect(getSessionIdFromAccessToken(token)).toBe("session-123");
  });
});
