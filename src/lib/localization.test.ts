import {
  formatCurrencyValue,
  formatDateOnlyValue,
  formatNumberValue,
  isSupportedLanguage,
  isSupportedLocale,
  translate,
} from "@/lib/localization";

describe("localization helpers", () => {
  it("translates keys with interpolation", () => {
    expect(translate("fr", "search.empty.noMatchesDescription", { query: "ABC-123" })).toContain("ABC-123");
  });

  it("recognizes supported language and locale values", () => {
    expect(isSupportedLanguage("en")).toBe(true);
    expect(isSupportedLanguage("de")).toBe(false);
    expect(isSupportedLocale("fr-FR")).toBe(true);
    expect(isSupportedLocale("de-DE")).toBe(false);
  });

  it("formats currency with locale-sensitive output", () => {
    const formatted = formatCurrencyValue(1234.5, { currency: "USD", locale: "en-US" });
    expect(formatted).toContain("$");
  });

  it("formats numbers and dates without throwing", () => {
    expect(formatNumberValue(12500.42, { locale: "fr-FR" })).toBeTruthy();
    expect(formatDateOnlyValue("2026-04-14T00:00:00.000Z", { locale: "en-NG", timezone: "Africa/Lagos" })).toBeTruthy();
  });
});
