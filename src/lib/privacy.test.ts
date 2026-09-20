import { describe, expect, it } from "vitest";
import { defaultPrivacyPreferences, sanitizeWorkspaceExportSnapshot } from "@/lib/privacy";

describe("privacy helpers", () => {
  it("exposes the expected default privacy preferences", () => {
    expect(defaultPrivacyPreferences).toEqual({
      analytics_opt_in: false,
      include_audit_log_in_exports: true,
      include_contact_details_in_exports: true,
      product_updates_opt_in: true,
    });
  });

  it("removes sensitive contact fields and audit logs when export privacy toggles disable them", () => {
    const sanitized = sanitizeWorkspaceExportSnapshot(
      {
        auditLogs: [{ id: 1, summary: "Invoice updated" }],
        customers: [{ billing_address: "Lagos", email: "customer@example.com", name: "Acme", phone: "+234" }],
        teamMembers: [{ email: "owner@example.com", full_name: "Owner Name", invited_by: "admin-1", user_id: "user-1" }],
        vendors: [
          {
            account_name: "Jane Doe",
            account_number: "0123456789",
            bank_id: "bank-1",
            bank_name: "Moniger Bank",
            business_name: "Vendor Co",
            contact_name: "Jane",
            email: "vendor@example.com",
            phone: "+234",
          },
        ],
      },
      {
        ...defaultPrivacyPreferences,
        include_audit_log_in_exports: false,
        include_contact_details_in_exports: false,
      },
    );

    expect(sanitized.auditLogs).toEqual([]);
    expect(sanitized.customers[0]).toMatchObject({
      billing_address: null,
      email: null,
      phone: null,
    });
    expect(sanitized.teamMembers?.[0]).toMatchObject({
      email: null,
      full_name: null,
      invited_by: null,
      user_id: null,
    });
    expect(sanitized.vendors[0]).toMatchObject({
      account_name: null,
      account_number: null,
      bank_id: null,
      bank_name: null,
      contact_name: null,
      email: null,
      phone: null,
    });
  });
});
