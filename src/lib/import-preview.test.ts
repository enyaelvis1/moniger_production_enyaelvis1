import { describe, expect, it } from "vitest";
import { importTemplates } from "@/lib/import-templates";
import { parseCsvPreview } from "@/lib/import-preview";

describe("CSV import preview", () => {
  it("parses quoted values and validates required columns", () => {
    const result = parseCsvPreview('name,email\n"Ada, Example",ada@example.com', importTemplates[0]);
    expect(result.errors).toEqual([]);
    expect(result.preview?.rows[0].name).toBe("Ada, Example");
  });

  it("reports missing columns and row values before import", () => {
    const template = importTemplates.find((item) => item.key === "vendors")!;
    expect(parseCsvPreview("email\naccounts@example.com", template).errors[0]).toContain("Missing required column");
    expect(parseCsvPreview("business_name\n,", template).errors[0]).toContain("Row 2: business_name is required");
  });
});
