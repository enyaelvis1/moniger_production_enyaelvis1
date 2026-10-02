import { describe, expect, it } from "vitest";
import { billAttachmentSummary, calculateBillBreakdown } from "@/lib/bill-breakdown";

describe("bill breakdown", () => {
  it("calculates subtotal and total from quantity and unit price", () => {
    expect(calculateBillBreakdown([{ description: "Hosting", qty: 2, unitPrice: 1500 }, { description: "Support", qty: 1, unitPrice: 500 }], 300)).toEqual({
      items: [{ description: "Hosting", qty: 2, unitPrice: 1500 }, { description: "Support", qty: 1, unitPrice: 500 }],
      subtotal: 3500,
      taxTotal: 300,
      total: 3800,
    });
  });

  it("does not expose attachment paths in the email-facing indicator", () => {
    expect(billAttachmentSummary(1)).toBe("1 private attachment available");
    expect(billAttachmentSummary(2)).toBe("2 private attachments available");
    expect(billAttachmentSummary(0)).toBe("No attachment included");
  });
});
