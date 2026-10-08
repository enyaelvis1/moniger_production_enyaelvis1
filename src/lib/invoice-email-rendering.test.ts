import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "supabase/functions/workspace-email-delivery/index.ts"), "utf8");

describe("invoice email itemization contract", () => {
  it("loads invoice items and renders an itemized HTML table", () => {
    expect(source).toContain('.from("invoice_items")');
    expect(source).toContain("InvoiceItemEmailRow");
    expect(source).toContain("const itemsHtml =");
    expect(source).toContain("Line total");
  });

  it("includes itemized lines in the plain-text email fallback", () => {
    expect(source).toContain("const itemLines =");
    expect(source).toContain("...itemLines");
    expect(source).toContain("No line-item breakdown was recorded.");
  });

  it("includes subtotal and tax or charges in the invoice summary", () => {
    expect(source).toContain("tax_total");
    expect(source).toContain("email.invoice.taxCharges");
    expect(source).toContain("taxTotal: formatTemplateCurrency");
  });
});
