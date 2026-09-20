import { ArrowRight, CheckCircle2, Circle, Download } from "lucide-react";
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { downloadImportTemplate, importTemplates } from "@/lib/import-templates";
import { parseCsvPreview, type CsvPreview } from "@/lib/import-preview";
import { useCustomerMutations, useVendorMutations } from "@/hooks/use-directory-data";
import { upsertWorkspacePayoutAccount } from "@/lib/workspace-payout-routing";

type OnboardingChecklistProps = {
  businessReady: boolean;
  businessId: string;
  customerCount: number;
  vendorCount: number;
  invoiceCount: number;
  billCount: number;
  userId: string;
};

const OnboardingChecklist = ({ businessId, businessReady, customerCount, vendorCount, invoiceCount, billCount, userId }: OnboardingChecklistProps) => {
  const navigate = useNavigate();
  const customerMutations = useCustomerMutations(businessId, userId);
  const vendorMutations = useVendorMutations(businessId, userId);
  const payoutDestinationMutation = useMutation({
    mutationFn: (row: Record<string, string>) => upsertWorkspacePayoutAccount(businessId, {
      accountName: row.account_name,
      accountNumber: row.account_number,
      bankName: row.bank_name,
      currency: row.currency || "NGN",
      syncProvider: false,
    }),
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(importTemplates[0].key);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const selectedTemplate = importTemplates.find((template) => template.key === selectedTemplateKey) ?? importTemplates[0];
  const items = [
    { complete: businessReady, description: "Add your business name and operating details.", label: "Complete workspace profile", to: "/settings?tab=profile" },
    { complete: customerCount > 0, description: "Create the customer records you will bill.", label: "Add your first customer", to: "/customers" },
    { complete: vendorCount > 0, description: "Add vendors for your payable workflows.", label: "Add your first vendor", to: "/vendors" },
    { complete: invoiceCount > 0, description: "Issue an invoice and start tracking receivables.", label: "Create your first invoice", to: "/invoices" },
    { complete: billCount > 0, description: "Record a bill and review the payable path.", label: "Record your first bill", to: "/bills" },
    { complete: false, description: "Review the payout destination before routing incoming funds.", label: "Review payout routing", to: "/marketplace-routing" },
  ];
  const roleGuidance = [
    { label: "Owner / Admin", description: "Workspace control, team access, billing, and payout-routing decisions." },
    { label: "Accountant", description: "Invoices, bills, customers, vendors, reports, and reconciliation work." },
    { label: "Accounts receivable", description: "Use the Accountant role for customer records, invoices, and incoming payment follow-up." },
    { label: "Accounts payable", description: "Use the Accountant role for vendors, bills, approvals, and payable review." },
  ];
  const completedCount = items.filter((item) => item.complete).length;
  const progress = Math.round((completedCount / items.length) * 100);
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const result = parseCsvPreview(await file.text(), selectedTemplate);
    setPreview(result.preview);
    setPreviewErrors(result.errors);
    setImportStatus(null);
  };
  const importRows = async () => {
    if (!preview || previewErrors.length > 0 || !["bank_accounts", "customers", "vendors"].includes(selectedTemplate.key)) return;
    setImportStatus(null);
    try {
      if (selectedTemplate.key === "bank_accounts") {
        if (preview.rows.length !== 1) throw new Error("Only one payout destination can be saved for this workspace. Keep one row in the file.");
        await payoutDestinationMutation.mutateAsync(preview.rows[0]);
      } else if (selectedTemplate.key === "customers") {
        for (const row of preview.rows) {
          await customerMutations.createCustomer.mutateAsync({
            business_name: row.business_name || null,
            city_state: row.city_state || null,
            email: row.email || null,
            name: row.name,
            notes: row.notes || null,
            phone: row.phone || null,
            street_address: row.street_address || null,
          });
        }
      } else {
        for (const row of preview.rows) {
          await vendorMutations.createVendor.mutateAsync({
            account_name: row.account_name || null,
            account_number: row.account_number || null,
            bank_name: row.bank_name || null,
            business_name: row.business_name,
            contact_name: row.contact_name || null,
            email: row.email || null,
            phone: row.phone || null,
          });
        }
      }
      setImportStatus(selectedTemplate.key === "bank_accounts" ? "Payout destination saved as a draft for review." : `${preview.rows.length} ${selectedTemplate.title.toLowerCase()} imported successfully.`);
      setPreview(null);
    } catch (error) {
      setImportStatus(error instanceof Error ? `Import stopped: ${error.message}` : "Import stopped. Review the records and try again.");
    }
  };
  const isImporting = customerMutations.createCustomer.isPending || vendorMutations.createVendor.isPending || payoutDestinationMutation.isPending;

  return (
    <section className="rounded-3xl border border-[#DCE2F2] bg-white/80 p-5 shadow-[0_12px_32px_rgba(91,103,247,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-card/70 sm:p-6" aria-labelledby="onboarding-checklist-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Workspace setup</p>
          <h2 id="onboarding-checklist-title" className="mt-2 text-xl font-bold tracking-[-0.03em] text-[#0D1B2A] dark:text-foreground">Build your operating foundation</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-[#64748B] dark:text-muted-foreground">Follow the setup path at your pace. You can leave and resume these steps whenever you need.</p>
        </div>
        <div className="min-w-[112px] rounded-2xl bg-[#EEF2FF] px-3 py-2 text-center text-[#4154D8]">
          <p className="text-2xl font-black">{completedCount}/{items.length}</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">complete</p>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#E8ECF8]" role="progressbar" aria-label="Workspace onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <div className="h-full rounded-full bg-[#5B67F7] transition-[width]" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <button key={item.label} type="button" onClick={() => navigate(item.to)} className="group flex items-start gap-3 rounded-2xl border border-[#E7EAF3] bg-white px-4 py-3 text-left transition-colors hover:border-[#B9C4FF] hover:bg-[#F8F9FF] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
            {item.complete ? <CheckCircle2 className="mt-0.5 shrink-0 text-[#16A34A]" size={19} aria-hidden="true" /> : <Circle className="mt-0.5 shrink-0 text-[#9AA5BF]" size={19} aria-hidden="true" />}
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${item.complete ? "text-[#526174] line-through dark:text-muted-foreground" : "text-[#0D1B2A] dark:text-foreground"}`}>{item.label}</span>
              <span className="mt-0.5 block text-xs leading-5 text-[#7D89A5] dark:text-muted-foreground">{item.description}</span>
            </span>
            <ArrowRight className="mt-1 shrink-0 text-[#A0AAC1] transition-transform group-hover:translate-x-0.5" size={16} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div className="mt-6 border-t border-[#E7EAF3] pt-5 dark:border-white/10">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0D1B2A] dark:text-foreground">Prepare your data</p>
            <p className="mt-1 text-xs leading-5 text-[#7D89A5] dark:text-muted-foreground">Download a template, fill it in, and keep it ready for the validated import flow. Bank files configure one payout destination only; they do not connect transaction syncing.</p>
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#7D89A5]">Templates only</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {importTemplates.map((template) => (
            <button key={template.key} type="button" onClick={() => downloadImportTemplate(template)} className="flex items-center gap-2 rounded-xl border border-[#E7EAF3] bg-[#F8F9FF] px-3 py-2 text-left text-xs font-semibold text-[#4154D8] transition-colors hover:border-[#B9C4FF] hover:bg-[#EEF2FF] dark:border-white/10 dark:bg-white/5 dark:text-[#AFC2FF] dark:hover:bg-white/10">
              <Download size={14} aria-hidden="true" />
              <span className="min-w-0 truncate">{template.title}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-[#E7EAF3] bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-xs font-semibold text-[#4154D8] dark:text-[#AFC2FF]">
              Preview template
              <select value={selectedTemplateKey} onChange={(event) => { setSelectedTemplateKey(event.target.value as typeof selectedTemplateKey); setPreview(null); setPreviewErrors([]); }} className="ml-2 rounded-lg border border-[#DCE2F2] bg-white px-2 py-1 text-xs font-medium text-[#10203F] dark:border-white/10 dark:bg-[#111927] dark:text-white">
                {importTemplates.map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}
              </select>
            </label>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-full border border-[#DCE2F2] px-3 py-2 text-xs font-semibold text-[#4154D8] hover:bg-[#F5F6FF] dark:border-white/10 dark:text-[#AFC2FF] dark:hover:bg-white/10">Choose CSV to preview</button>
          </div>
          {previewErrors.length > 0 ? <div className="mt-3 space-y-1 rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-3 py-2 text-xs text-[#B42318]">{previewErrors.slice(0, 5).map((error) => <p key={error}>{error}</p>)}</div> : null}
          {preview ? <div className="mt-3 overflow-x-auto rounded-xl border border-[#E7EAF3] dark:border-white/10"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-[#F8F9FF] dark:bg-white/5"><tr>{preview.headers.map((header) => <th key={header} className="px-3 py-2 font-semibold text-[#526174] dark:text-muted-foreground">{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 5).map((row, index) => <tr key={index} className="border-t border-[#E7EAF3] dark:border-white/10">{preview.headers.map((header) => <td key={header} className="max-w-[180px] truncate px-3 py-2 text-[#33415C] dark:text-foreground">{row[header]}</td>)}</tr>)}</tbody></table><div className="flex flex-col gap-2 border-t border-[#E7EAF3] px-3 py-2 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] text-[#7D89A5]">Showing up to 5 of {preview.rows.length} parsed rows.</p>{["bank_accounts", "customers", "vendors"].includes(selectedTemplate.key) ? <button type="button" disabled={isImporting || previewErrors.length > 0} onClick={() => void importRows()} className="rounded-full bg-[#5B67F7] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{isImporting ? "Saving..." : selectedTemplate.key === "bank_accounts" ? "Save payout destination" : `Import ${preview.rows.length} rows`}</button> : <span className="text-[11px] font-medium text-[#7D89A5]">Preview only until posting is available</span>}</div></div> : null}
          {importStatus ? <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${importStatus.startsWith("Import stopped") ? "bg-[#FEF2F2] text-[#B42318]" : "bg-[#ECFDF3] text-[#166534]"}`} role="status">{importStatus}</p> : null}
        </div>
      </div>
      <div className="mt-6 border-t border-[#E7EAF3] pt-5 dark:border-white/10">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#0D1B2A] dark:text-foreground">Plan team responsibilities</p>
            <p className="mt-1 text-xs leading-5 text-[#7D89A5] dark:text-muted-foreground">Moniger currently provides Owner, Admin, Accountant, and Viewer roles. Accounts receivable and payable are workflow responsibilities assigned through the Accountant role.</p>
          </div>
          <button type="button" onClick={() => navigate("/team")} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#4154D8] hover:underline dark:text-[#AFC2FF]">Manage team <ArrowRight size={13} aria-hidden="true" /></button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {roleGuidance.map((role) => <div key={role.label} className="rounded-xl border border-[#E7EAF3] bg-[#F8F9FF] px-3 py-2 dark:border-white/10 dark:bg-white/5"><p className="text-xs font-semibold text-[#33415C] dark:text-foreground">{role.label}</p><p className="mt-1 text-[11px] leading-5 text-[#7D89A5] dark:text-muted-foreground">{role.description}</p></div>)}
        </div>
      </div>
    </section>
  );
};

export default OnboardingChecklist;
