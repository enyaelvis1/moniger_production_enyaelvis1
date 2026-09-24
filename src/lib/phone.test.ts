import { describe, expect, it } from "vitest";
import { filterPhoneInput, isValidPhoneNumber, normalizePhoneNumber } from "@/lib/phone";

describe("phone number validation", () => {
  it("filters letters from interactive phone input", () => {
    expect(filterPhoneInput("+234abc 801-234-5678")).toBe("+234 801-234-5678");
  });

  it("accepts formatted Nigerian and international values", () => {
    expect(isValidPhoneNumber("0801 234 5678")).toBe(true);
    expect(normalizePhoneNumber("0801 234 5678")).toBe("+2348012345678");
    expect(isValidPhoneNumber("+44 20 7946 0958")).toBe(true);
  });

  it.each([
    "abc08012345678",
    "+234+8012345678",
    "0801/234/5678",
    "(0801) 234 5678 ext 1",
  ])("rejects unsupported phone input: %s", (value) => {
    expect(isValidPhoneNumber(value)).toBe(false);
    expect(normalizePhoneNumber(value)).toBeNull();
  });

  it("rejects values outside the supported digit range", () => {
    expect(isValidPhoneNumber("+1234567")).toBe(false);
    expect(isValidPhoneNumber("+1234567890123456")).toBe(false);
  });

  it("allows optional phone fields to normalize to null when blank", () => {
    expect(normalizePhoneNumber("   ")).toBeNull();
  });
});
