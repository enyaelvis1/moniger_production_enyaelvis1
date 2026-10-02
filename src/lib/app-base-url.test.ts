import { describe, expect, it } from "vitest";
import { normalizeConfiguredAppBaseUrl } from "../../supabase/functions/_shared/app-base-url";

describe("normalizeConfiguredAppBaseUrl", () => {
  it.each([
    ["https://moniger.net/", "https://moniger.net"],
    ["http://localhost:8080/", "http://localhost:8080"],
  ])("accepts approved URL %s", (value, expected) => {
    expect(normalizeConfiguredAppBaseUrl(value)).toBe(expected);
  });

  it.each([
    "",
    "javascript:alert(1)",
    "http://evil.example",
    "https://moniger.net/?next=https://evil.example",
    "https://user:password@moniger.net",
    "https://moniger.net/#fragment",
  ])("rejects unsafe URL %s", (value) => {
    expect(() => normalizeConfiguredAppBaseUrl(value)).toThrow();
  });
});
