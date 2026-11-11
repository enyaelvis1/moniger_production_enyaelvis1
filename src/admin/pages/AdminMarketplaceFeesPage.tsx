import { useEffect, useState } from "react";
import { Info, Percent } from "lucide-react";
import { AdminBadge, AdminPageHeader, AdminSectionCard } from "@/admin/components/AdminUi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAdminGlobalMarketplaceFee } from "@/hooks/use-workspace-payout-routing";

type FeeForm = {
  currency: string;
  flatAmount: string;
  percentage: string;
  mode: "flat" | "percentage";
};

const AdminMarketplaceFeesPage = () => {
  const { toast } = useToast();
  const globalFee = useAdminGlobalMarketplaceFee();
  const [form, setForm] = useState<FeeForm>({ currency: "NGN", flatAmount: "", percentage: "", mode: "percentage" });

  useEffect(() => {
    const fee = globalFee.query.data?.globalFee;
    if (!fee) return;
    setForm({
      currency: fee.currency,
      flatAmount: String(fee.flat_amount ?? ""),
      percentage: fee.percentage_basis_points === null ? "" : String(fee.percentage_basis_points / 100),
      mode: fee.fee_mode,
    });
  }, [globalFee.query.data?.globalFee]);

  const saveFee = async (enabled: boolean) => {
    const currency = form.currency.trim().toUpperCase();
    const percentage = Number(form.percentage);
    const flatAmount = Number(form.flatAmount);
    if (!/^[A-Z]{3}$/.test(currency)
      || (form.mode === "percentage" && (!Number.isInteger(percentage) || percentage < 0 || percentage > 100))
      || (form.mode === "flat" && (!Number.isFinite(flatAmount) || flatAmount < 0))) {
      toast({
        title: "Check the fee details",
        description: "Enter a three-letter currency and a non-negative flat fee or whole-number percentage from 0 to 100.",
        variant: "destructive",
      });
      return;
    }

    try {
      await globalFee.mutation.mutateAsync({
        currency,
        feeMode: form.mode,
        flatAmount: form.mode === "flat" ? flatAmount : 0,
        percentageBasisPoints: form.mode === "percentage" ? percentage * 100 : undefined,
        enabled,
      });
      toast({
        title: enabled ? "Platform fee saved" : "Platform fee disabled",
        description: enabled
          ? "This is the default for workspaces without a ready workspace-specific fee override."
          : "Workspaces without a ready override cannot send invoices or accept routed payments until a default is enabled.",
      });
    } catch (error) {
      toast({
        title: "Unable to save the platform fee",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const fee = globalFee.query.data?.globalFee;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Marketplace Fees"
        subtitle="Set Moniger’s default fee for incoming customer invoice payments across all workspaces."
      />

      <AdminSectionCard title="Platform-wide default fee" titleAction={(
        <AdminBadge tone={fee?.status === "active" ? "success" : "warning"}>
          {fee?.status === "active" ? "Default active" : "No active default"}
        </AdminBadge>
      )}>
        {globalFee.query.isLoading ? (
          <p className="text-sm text-white/50">Loading platform fee…</p>
        ) : globalFee.query.error ? (
          <p role="alert" className="text-sm text-red-300">
            {globalFee.query.error instanceof Error ? globalFee.query.error.message : "Unable to load the platform fee."}
          </p>
        ) : (
          <>
            <div className="rounded-lg border border-[#3B82F6]/20 bg-[#3B82F6]/[0.07] p-4 text-sm text-white/70">
              <p className="flex items-start gap-2 font-medium text-[#BFDBFE]">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                This fee is used when a workspace has no ready workspace-specific fee override.
              </p>
              <p className="mt-2 pl-6 text-white/55">
                Receiving funds still requires a Paystack-verified workspace subaccount. Changes apply to new invoice checkouts; completed payments are unchanged.
              </p>
            </div>

            {fee ? (
              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="text-white/45">Current default</span>
                <strong className="text-[#F1F5F9]">
                  {fee.fee_mode === "percentage"
                    ? `${((fee.percentage_basis_points ?? 0) / 100).toFixed(2).replace(/\.00$/, "")}%`
                    : `${fee.currency} ${Number(fee.flat_amount).toFixed(2)}`}
                </strong>
                <span className="text-white/45">{fee.currency}</span>
                <span className="text-xs text-white/35">Updated {new Date(fee.updated_at).toLocaleString()}</span>
              </div>
            ) : (
              <p className="mt-5 text-sm text-amber-200">No default is configured. Workspaces without a ready override cannot send invoices.</p>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="marketplace-fee-mode" className="text-white/80">Fee type</Label>
                <Select value={form.mode} onValueChange={(mode) => setForm((current) => ({ ...current, mode: mode as FeeForm["mode"] }))}>
                  <SelectTrigger id="marketplace-fee-mode" className="mt-2 border-white/10 bg-[#111927] text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="flat">Flat fee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="marketplace-fee-currency" className="text-white/80">Currency</Label>
                <Input
                  id="marketplace-fee-currency"
                  value={form.currency}
                  maxLength={3}
                  onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  className="mt-2 border-white/10 bg-[#111927] text-white"
                />
              </div>
              <div>
                <Label htmlFor="marketplace-fee-value" className="text-white/80">{form.mode === "percentage" ? "Fee percentage" : "Fee amount"}</Label>
                <div className="relative mt-2">
                  {form.mode === "percentage" ? <Percent size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" aria-hidden="true" /> : null}
                  <Input
                    id="marketplace-fee-value"
                    type="number"
                    min="0"
                    step={form.mode === "percentage" ? "1" : "0.01"}
                    max={form.mode === "percentage" ? "100" : undefined}
                    value={form.mode === "percentage" ? form.percentage : form.flatAmount}
                    onChange={(event) => setForm((current) => current.mode === "percentage"
                      ? { ...current, percentage: event.target.value }
                      : { ...current, flatAmount: event.target.value })}
                    className={`border-white/10 bg-[#111927] text-white ${form.mode === "percentage" ? "pl-9" : ""}`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {fee?.status === "active" ? (
                <Button
                  variant="ghost"
                  disabled={globalFee.mutation.isPending}
                  onClick={() => void saveFee(false)}
                  className="border border-white/10 bg-white/5 text-white hover:bg-white/10"
                >
                  Disable default
                </Button>
              ) : null}
              <Button
                disabled={globalFee.mutation.isPending}
                onClick={() => void saveFee(true)}
                className="bg-[#3B82F6] text-white hover:bg-[#2563EB]"
              >
                {globalFee.mutation.isPending ? "Saving…" : "Save platform fee"}
              </Button>
            </div>
          </>
        )}
      </AdminSectionCard>
    </div>
  );
};

export default AdminMarketplaceFeesPage;
