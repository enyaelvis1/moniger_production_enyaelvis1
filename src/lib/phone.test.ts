import { describe, expect, it } from "vitest";
import { filterPhoneInput, isValidPhoneNumber, limitPhoneInput, normalizePhoneNumber } from "@/lib/phone";

describe("phone number validation", () => {
  it("filters letters from interactive phone input", () => {
    expect(filterPhoneInput("+234abc 801-234-5678")).toBe("+234 801-234-5678");
  });

  it("limits interactive input to the supported Nigerian digit count", () => {
    expect(limitPhoneInput("0801 234 5678 9")).toBe("0801 234 5678 ");
    expect(limitPhoneInput("+234 801 234 5678 9")).toBe("+234 801 234 5678 ");
  });

  it("accepts only correctly sized Nigerian values", () => {
    expect(isValidPhoneNumber("0801 234 5678")).toBe(true);
    expect(normalizePhoneNumber("0801 234 5678")).toBe("+2348012345678");
    expect(isValidPhoneNumber("+234 801 234 5678")).toBe(true);
    expect(isValidPhoneNumber("+44 20 7946 0958")).toBe(false);
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

  it("rejects values that are shorter or longer than the Nigerian format", () => {
    expect(isValidPhoneNumber("0801234567")).toBe(false);
    expect(isValidPhoneNumber("080123456789")).toBe(false);
    expect(isValidPhoneNumber("+23480123456789")).toBe(false);
    expect(isValidPhoneNumber("+234801234567")).toBe(false);
  });

  it("allows optional phone fields to normalize to null when blank", () => {
    expect(normalizePhoneNumber("   ")).toBeNull();
  });
});
