import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "supabase/functions/workspace-email-delivery/index.ts"), "utf8");

describe("bill email rendering contract", () => {
  it("renders both HTML and plain-text bill breakdowns", () => {
    expect(source).toContain("const buildBillEmail");
    expect(source).toContain("const bodyHtml =");
    expect(source).toContain("const text = [");
    expect(source).toContain("Description");
    expect(source).toContain("Line total");
  });

  it("reports private attachment availability without exposing storage paths", () => {
    expect(source).toContain("private attachment");
    expect(source).toContain("Private attachments are not exposed by email.");
    expect(source).not.toContain("storage_path");
  });
});
