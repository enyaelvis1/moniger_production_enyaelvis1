import { useDeferredValue, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminSupportResponse,
} from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSectionCard,
} from "@/admin/components/AdminUi";

const AdminSupportPage = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [passwordEmail, setPasswordEmail] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [payoutReference, setPayoutReference] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const deferredSearch = useDeferredValue(search);
  const lookupQuery = useAdminConsoleQuery<AdminSupportResponse>("support.lookup", { search: deferredSearch }, Boolean(deferredSearch));
  const payoutRows = lookupQuery.data?.payouts ?? [];
  const payoutAuditRows = lookupQuery.data?.payoutAudits ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Support Lookup"
        subtitle="Fast search for businesses, users, invoices, and platform support actions."
      />

      <AdminSectionCard title="What this page is for">
        <div className="space-y-2 text-sm text-white/60">
          <p>Use Support Lookup to investigate workspace issues quickly without going into the subscriber dashboard directly.</p>
          <p>Search helps you locate businesses, users, and invoices, while the quick actions are for controlled admin support work like password resets, payment reference lookup, and business notices.</p>
          <p>Quick actions are restricted to admin users and are intended to leave an audit trail for sensitive support intervention.</p>
        </div>
      </AdminSectionCard>

      <div className="rounded-xl border border-white/10 bg-[#161E2E] p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, business name, invoice number, or payment reference..."
            className="h-[52px] rounded-xl border-white/10 bg-[#161E2E] pl-12 text-[15px] text-[#F1F5F9] placeholder:text-white/35 focus-visible:ring-[#3B82F6]"
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <AdminSectionCard title="Businesses">
            <div className="space-y-3">
              {(lookupQuery.data?.businesses ?? []).map((business) => (
                <div key={business.businessId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <p className="font-medium text-[#F1F5F9]">{business.businessName}</p>
                  <p className="text-sm text-white/45">{business.ownerEmail}</p>
                  <div className="mt-2 flex gap-2">
                    <AdminBadge tone="neutral">{business.plan}</AdminBadge>
                    <AdminBadge tone={business.status === "active" ? "success" : business.status === "pending" ? "warning" : "danger"}>{business.status}</AdminBadge>
                  </div>
                </div>
              ))}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Users">
            <div className="space-y-3">
              {(lookupQuery.data?.users ?? []).map((user) => (
                <div key={user.userId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <p className="font-medium text-[#F1F5F9]">{user.fullName ?? user.email}</p>
                  <p className="text-sm text-white/45">{user.email}</p>
                  <p className="mt-2 text-xs text-white/35">{user.workspaces.join(", ")}</p>
                </div>
              ))}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Invoices">
            <div className="space-y-3">
              {(lookupQuery.data?.invoices ?? []).map((invoice) => (
                <div key={invoice.invoiceId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#F1F5F9]">{invoice.invoiceNumber}</p>
                      <p className="text-sm text-white/45">{invoice.businessName}</p>
                    </div>
                    <AdminBadge tone="neutral">{invoice.status}</AdminBadge>
                  </div>
                </div>
              ))}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Payouts">
            <div className="space-y-3">
              {payoutRows.map((payout) => (
                <div key={payout.payoutId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#F1F5F9]">{payout.billNumber ?? "Bill payout"}</p>
                      <p className="text-sm text-white/45">
                        {payout.vendorName ?? "Unknown vendor"} · {payout.businessName}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminBadge tone={payout.status === "completed" ? "success" : payout.status === "failed" || payout.status === "reversed" ? "danger" : "warning"}>
                        {payout.status}
                      </AdminBadge>
                      <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
                        {payout.amount.toLocaleString("en-NG", { style: "currency", currency: payout.currency })}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-white/35">
                    <p>Reference: {payout.providerReference ?? "Not submitted yet"}</p>
                    <p>
                      Bank: {payout.bankName ?? "Not set"}
                      {payout.recipientBankCode ? ` (${payout.recipientBankCode})` : ""}
                    </p>
                    <p>
                      Submitted: {payout.submittedAt ?? "Not yet"} · Completed: {payout.completedAt ?? "Not yet"} · Failed:{" "}
                      {payout.failureReason ?? "None"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Payout Audit">
            <div className="space-y-3">
              {payoutAuditRows.map((row) => (
                <div key={String(row.id)} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <div className="flex items-center gap-2">
                    <AdminBadge tone="info">PAYOUT</AdminBadge>
                    <AdminBadge tone="neutral">{row.action}</AdminBadge>
                    {row.businessName ? <AdminBadge tone="neutral">{row.businessName}</AdminBadge> : null}
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#F1F5F9]">{row.summary}</p>
                  <p className="mt-1 text-xs text-white/35">{formatAdminDateTime(row.createdAt)}</p>
                </div>
              ))}
            </div>
          </AdminSectionCard>
        </div>

        <AdminSectionCard title="Quick Actions">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
              <p className="text-sm font-medium text-[#F1F5F9]">Reset a user's password</p>
              <Input value={passwordEmail} onChange={(event) => setPasswordEmail(event.target.value)} placeholder="user@company.com" className="mt-3 border-white/10 bg-[#161E2E] text-white placeholder:text-white/30" />
              <Button
                className="mt-3 bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                onClick={async () => {
                  const result = await invokeAdminConsole<{ message?: string }>("support.quickAction", { email: passwordEmail, type: "reset_password" });
                  toast({
                    title: "Password reset sent",
                    description: result.message ?? `Password reset email sent to ${passwordEmail}.`,
                  });
                  setPasswordEmail("");
                }}
              >
                Send
              </Button>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
              <p className="text-sm font-medium text-[#F1F5F9]">Look up a payment</p>
              <Input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="PAY-1001" className="mt-3 border-white/10 bg-[#161E2E] text-white placeholder:text-white/30" />
              <Button
                className="mt-3 bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                onClick={async () => {
                  const result = await invokeAdminConsole<{ rows: unknown[] }>("support.quickAction", { reference: paymentReference, type: "lookup_payment" });
                  toast({ title: "Payment lookup complete", description: `${result.rows.length} matching payment records found.` });
                }}
              >
                Find
              </Button>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
              <p className="text-sm font-medium text-[#F1F5F9]">Look up a payout</p>
              <Input value={payoutReference} onChange={(event) => setPayoutReference(event.target.value)} placeholder="PAYOUT-REF" className="mt-3 border-white/10 bg-[#161E2E] text-white placeholder:text-white/30" />
              <Button
                className="mt-3 bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                onClick={async () => {
                  const result = await invokeAdminConsole<{ rows: unknown[] }>("support.quickAction", { reference: payoutReference, type: "lookup_payout" });
                  toast({ title: "Payout lookup complete", description: `${result.rows.length} matching payout records found.` });
                }}
              >
                Find
              </Button>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
              <p className="text-sm font-medium text-[#F1F5F9]">Send a notice to a business</p>
              <Input value={businessId} onChange={(event) => setBusinessId(event.target.value)} placeholder="Business ID" className="mt-3 border-white/10 bg-[#161E2E] text-white placeholder:text-white/30" />
              <Textarea value={noticeMessage} onChange={(event) => setNoticeMessage(event.target.value)} placeholder="Write the support message..." className="mt-3 min-h-[100px] border-white/10 bg-[#161E2E] text-white placeholder:text-white/30" />
              <Button
                className="mt-3 bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                onClick={async () => {
                  await invokeAdminConsole("support.quickAction", {
                    businessId,
                    message: noticeMessage,
                    type: "send_notice",
                  });
                  toast({ title: "Notice sent", description: "The message was added to notifications for that business." });
                }}
              >
                Send
              </Button>
            </div>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  );
};

export default AdminSupportPage;
