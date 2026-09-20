import { describe, expect, it } from "vitest";
import { importTemplates } from "@/lib/import-templates";

describe("import templates", () => {
  it("covers the four onboarding import starting points", () => {
    expect(importTemplates.map((template) => template.key)).toEqual([
      "customers",
      "vendors",
      "opening_balances",
      "bank_accounts",
    ]);
  });

  it("provides a sample value for every declared column", () => {
    for (const template of importTemplates) {
      expect(template.headers.every((header) => header in template.sample)).toBe(true);
    }
  });
});
