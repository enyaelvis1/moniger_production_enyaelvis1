export type PrivacyPreferenceKey =
  | "analytics_opt_in"
  | "product_updates_opt_in"
  | "include_contact_details_in_exports"
  | "include_audit_log_in_exports";

export type PrivacyPreferenceState = Record<PrivacyPreferenceKey, boolean>;

export type WorkspaceExportSnapshot = {
  auditLogs?: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  teamMembers?: Array<Record<string, unknown>>;
  vendors: Array<Record<string, unknown>>;
};

export const defaultPrivacyPreferences: PrivacyPreferenceState = {
  analytics_opt_in: false,
  include_audit_log_in_exports: true,
  include_contact_details_in_exports: true,
  product_updates_opt_in: true,
};

const sanitizeCustomerForExport = (customer: Record<string, unknown>) => ({
  ...customer,
  billing_address: null,
  email: null,
  phone: null,
});

const sanitizeVendorForExport = (vendor: Record<string, unknown>) => ({
  ...vendor,
  account_name: null,
  account_number: null,
  bank_name: null,
  bank_id: null,
  contact_name: null,
  email: null,
  phone: null,
});

const sanitizeTeamMemberForExport = (member: Record<string, unknown>) => ({
  ...member,
  avatar_url: null,
  email: null,
  full_name: null,
  invited_by: null,
  user_id: null,
});

export const sanitizeWorkspaceExportSnapshot = (
  snapshot: WorkspaceExportSnapshot,
  preferences: PrivacyPreferenceState,
): WorkspaceExportSnapshot => ({
  ...snapshot,
  auditLogs: preferences.include_audit_log_in_exports ? snapshot.auditLogs ?? [] : [],
  customers: preferences.include_contact_details_in_exports
    ? snapshot.customers
    : snapshot.customers.map(sanitizeCustomerForExport),
  teamMembers: preferences.include_contact_details_in_exports
    ? snapshot.teamMembers ?? []
    : (snapshot.teamMembers ?? []).map(sanitizeTeamMemberForExport),
  vendors: preferences.include_contact_details_in_exports
    ? snapshot.vendors
    : snapshot.vendors.map(sanitizeVendorForExport),
});
