import { downloadCsvFile } from "@/lib/export";

export type ImportTemplateKey = "bank_accounts" | "customers" | "opening_balances" | "vendors";

export type ImportTemplate = {
  description: string;
  filename: string;
  headers: string[];
  key: ImportTemplateKey;
  requiredHeaders: string[];
  sample: Record<string, string>;
  title: string;
};

export const importTemplates: ImportTemplate[] = [
  {
    description: "Customer name, email, phone, and billing details.",
    filename: "moniger-customers-template.csv",
    headers: ["name", "email", "phone", "business_name", "street_address", "city_state", "notes"],
    key: "customers",
    requiredHeaders: ["name"],
    sample: { name: "Ada Example", email: "ada@example.com", phone: "+2348000000000", business_name: "Example Foods", street_address: "12 Marina Road", city_state: "Lagos, NG", notes: "Primary contact" },
    title: "Customers",
  },
  {
    description: "Vendor contact and optional bank details for payables.",
    filename: "moniger-vendors-template.csv",
    headers: ["business_name", "contact_name", "email", "phone", "bank_name", "account_name", "account_number"],
    key: "vendors",
    requiredHeaders: ["business_name"],
    sample: { business_name: "Example Supplies", contact_name: "Tunde Example", email: "accounts@example.com", phone: "+2348000000000", bank_name: "Example Bank", account_name: "Example Supplies Ltd", account_number: "0123456789" },
    title: "Vendors",
  },
  {
    description: "Opening balances to review before posting into the workspace.",
    filename: "moniger-opening-balances-template.csv",
    headers: ["account_name", "account_code", "opening_balance", "currency", "as_of_date"],
    key: "opening_balances",
    requiredHeaders: ["account_name", "opening_balance", "currency"],
    sample: { account_name: "Operating account", account_code: "1000", opening_balance: "0", currency: "NGN", as_of_date: "2026-01-01" },
    title: "Opening balances",
  },
  {
    description: "One payout-destination row for incoming marketplace routing; this is not bank syncing.",
    filename: "moniger-bank-accounts-template.csv",
    headers: ["account_name", "bank_name", "account_number", "currency", "opening_balance"],
    key: "bank_accounts",
    requiredHeaders: ["account_name", "bank_name", "account_number", "currency"],
    sample: { account_name: "Main operating account", bank_name: "Example Bank", account_number: "0123456789", currency: "NGN", opening_balance: "0" },
    title: "Bank accounts",
  },
];

export const downloadImportTemplate = (template: ImportTemplate) => {
  downloadCsvFile({
    columns: template.headers.map((header) => ({ header, value: (row: Record<string, string>) => row[header] })),
    filename: template.filename,
    rows: [template.sample],
  });
};
