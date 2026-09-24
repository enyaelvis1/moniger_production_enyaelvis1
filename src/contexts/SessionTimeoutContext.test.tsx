import { beforeEach, describe, expect, it } from "vitest";
import { readStoredSessionTimeoutMinutes } from "@/contexts/SessionTimeoutContext";

describe("session timeout preference", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults a fresh browser to 20 minutes", () => {
    expect(readStoredSessionTimeoutMinutes()).toBe(20);
  });

  it("preserves a deliberate test or user override", () => {
    window.localStorage.setItem("moniger-session-timeout-minutes", "1");
    expect(readStoredSessionTimeoutMinutes()).toBe(1);
  });
});
