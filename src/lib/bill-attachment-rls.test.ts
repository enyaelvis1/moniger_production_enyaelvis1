import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261002100000_add_bill_attachments.sql"), "utf8");
const lineItemMigration = readFileSync(join(process.cwd(), "supabase/migrations/20261002120000_add_bill_line_items.sql"), "utf8");

describe("bill private-data authorization contract", () => {
  it("requires workspace membership and paid feature access for attachment reads", () => {
    expect(migration).toContain("public.is_business_member((storage.foldername(name))[1]::uuid)");
    expect(migration).toContain("public.has_workspace_feature_access((storage.foldername(name))[1]::uuid, 'billAttachments')");
    expect(migration).toContain("bucket_id = 'bill-attachments'");
  });

  it("binds bill items to the same workspace as their bill", () => {
    expect(lineItemMigration).toContain("bills.business_id = bill_items.business_id");
    expect(lineItemMigration).toContain("public.has_workspace_feature_access(business_id, 'bills')");
    expect(lineItemMigration).toContain("alter table public.bill_items enable row level security");
  });
});
