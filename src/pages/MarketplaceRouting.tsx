import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Landmark, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useBanksList } from "@/hooks/use-directory-data";
import { useSettingsData } from "@/hooks/use-settings-data";
import { getFriendlyErrorMessage } from "@/lib/error-handling";
import {
  useWorkspacePayoutRoutingConfig,
  useWorkspacePayoutRoutingMutations,
} from "@/hooks/use-workspace-payout-routing";
import { useToast } from "@/hooks/use-toast";
import { validateWorkspacePayoutAccountInput } from "@/lib/workspace-payout-routing-validation";

type PayoutRoutingFormState = {
  accountName: string;
  accountNumber: string;
  bankId: string;
  countryCode: string;
  currency: string;
  providerSettlementBankCode: string;
};

const normalizeOptionalText = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const getRoutingStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending_verification":
      return "Pending verification";
    case "pending_provider_sync":
      return "Needs admin re-sync";
    case "ready":
      return "Ready";
    case "draft":
      return "Draft";
    case "errored":
      return "Needs attention";
    case "disabled":
      return "Disabled";
    default:
      return "Not configured";
  }
};

const getRoutingStatusBadgeClassName = (status: string | null | undefined) => {
  switch (status) {
    case "verified":
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending_verification":
    case "pending_provider_sync":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "errored":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "draft":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
};

const MarketplaceRoutingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const banksQuery = useBanksList();

  const canManagePayoutRouting =
    Boolean(settingsQuery.data?.business) &&
    (settingsQuery.data?.membership?.role === "owner" ||
      settingsQuery.data?.membership?.role === "admin" ||
      settingsQuery.data?.business?.owner_user_id === user?.id);

  const payoutRoutingQuery = useWorkspacePayoutRoutingConfig(canManagePayoutRouting ? businessId : undefined);
  const payoutRoutingMutations = useWorkspacePayoutRoutingMutations(canManagePayoutRouting ? businessId : undefined);

  const [payoutRoutingForm, setPayoutRoutingForm] = useState<PayoutRoutingFormState>({
    accountName: "",
    accountNumber: "",
    bankId: "",
    countryCode: "NG",
    currency: "NGN",
    providerSettlementBankCode: "",
  });
  const [hydrationKey, setHydrationKey] = useState("");

  const businessCurrency = settingsQuery.data?.business?.default_currency ?? "NGN";
  const payoutAccountConfig = payoutRoutingQuery.data?.payoutAccount ?? null;
  const payoutRoutingBankOptions = (banksQuery.data ?? []).filter((bank) => bank.is_active);
  const isBusy =
    payoutRoutingQuery.isLoading ||
    payoutRoutingMutations.upsertPayoutAccount.isPending ||
    banksQuery.isLoading ||
    !settingsQuery.data?.business;

  const snapshotKey = useMemo(
    () =>
      [
        businessId ?? "missing",
        payoutAccountConfig?.updatedAt ?? "missing",
        payoutAccountConfig?.accountName ?? "",
        payoutAccountConfig?.bankId ?? "",
        payoutAccountConfig?.countryCode ?? "",
        payoutAccountConfig?.currency ?? "",
        payoutAccountConfig?.providerSettlementBankCode ?? "",
      ].join("|"),
    [
      businessId,
      payoutAccountConfig?.accountName,
      payoutAccountConfig?.bankId,
      payoutAccountConfig?.countryCode,
      payoutAccountConfig?.currency,
      payoutAccountConfig?.providerSettlementBankCode,
      payoutAccountConfig?.updatedAt,
    ],
  );

  useEffect(() => {
    if (snapshotKey === hydrationKey) {
      return;
    }

    setPayoutRoutingForm({
      accountName: payoutAccountConfig?.accountName ?? "",
      accountNumber: "",
      bankId: payoutAccountConfig?.bankId ?? "",
      countryCode: payoutAccountConfig?.countryCode ?? "NG",
      currency: payoutAccountConfig?.currency ?? businessCurrency,
      providerSettlementBankCode: payoutAccountConfig?.providerSettlementBankCode ?? "",
    });
    setHydrationKey(snapshotKey);
  }, [businessCurrency, hydrationKey, payoutAccountConfig, snapshotKey]);

  const handlePayoutRoutingSave = async (syncProvider: boolean) => {
    if (!businessId || !canManagePayoutRouting) {
      toast({
        title: "Workspace access required",
        description: "Only workspace owners and admins can manage payout routing.",
        variant: "destructive",
      });
      return;
    }

    const validation = validateWorkspacePayoutAccountInput({
      accountName: payoutRoutingForm.accountName,
      accountNumber: payoutRoutingForm.accountNumber,
      bankId: payoutRoutingForm.bankId,
      countryCode: payoutRoutingForm.countryCode,
      currency: payoutRoutingForm.currency,
      syncProvider,
    });

    if (!validation.ok) {
      toast({
        title: validation.error.title,
        description: validation.error.description,
        variant: "destructive",
      });
      return;
    }

    const selectedBank = banksQuery.data?.find((bank) => bank.id === payoutRoutingForm.bankId) ?? null;

    try {
      const result = await payoutRoutingMutations.upsertPayoutAccount.mutateAsync({
        accountName: validation.normalized.accountName,
        accountNumber: validation.normalized.accountNumber,
        bankId: validation.normalized.bankId,
        bankName: selectedBank?.name ?? null,
        countryCode: validation.normalized.countryCode,
        currency: validation.normalized.currency,
        providerSettlementBankCode: normalizeOptionalText(payoutRoutingForm.providerSettlementBankCode),
        syncProvider,
      });

      if (result.sync?.resolvedAccountName) {
        setPayoutRoutingForm((current) => ({
          ...current,
          accountName: result.sync?.resolvedAccountName ?? current.accountName,
          accountNumber: "",
          providerSettlementBankCode: result.sync?.resolvedBankCode ?? current.providerSettlementBankCode,
        }));
      } else {
        setPayoutRoutingForm((current) => ({
          ...current,
          accountNumber: "",
        }));
      }

      toast({
        title: result.sync?.status === "failed" ? "Payout routing saved with sync issue" : "Payout routing updated",
        description:
          result.sync?.message ??
          (syncProvider ? "The payout account was saved and synced with Paystack." : "The payout account draft was saved."),
        variant: result.sync?.status === "failed" ? "destructive" : "default",
      });
    } catch (error) {
      toast({
        title: "Unable to save payout routing",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Marketplace routing</p>
            </div>
            <h2 className="text-2xl font-semibold text-foreground">Route incoming customer payments to the right destination</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This page manages incoming customer payment routing through Paystack subaccounts and split configuration. It does not
              control outgoing vendor payouts.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <Badge variant="outline" className={getRoutingStatusBadgeClassName(payoutAccountConfig?.status)}>
              {getRoutingStatusLabel(payoutAccountConfig?.status)}
            </Badge>
            <Button type="button" variant="outline" onClick={() => navigate("/settings?tab=business")}>
              Back to settings
            </Button>
          </div>
        </div>

        {!settingsQuery.data?.business ? (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            You need a workspace before routing can be configured.
          </div>
        ) : !canManagePayoutRouting ? (
          <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Only workspace owners and admins can view or update payout routing.
          </div>
        ) : payoutRoutingQuery.error ? (
          <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(payoutRoutingQuery.error, "We could not load payout routing yet.")}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Payout destination</p>
                <p className="mt-2 text-base font-semibold text-foreground">{payoutAccountConfig?.bankName ?? "Not set"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{payoutAccountConfig?.providerSubaccountCode ?? "Not synced"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Routing currency</p>
                <p className="mt-2 text-base font-semibold text-foreground">{payoutAccountConfig?.currency ?? businessCurrency}</p>
                <p className="mt-1 text-sm text-muted-foreground">Used for routed invoice checkout setup</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sync state</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {payoutRoutingQuery.data?.splitConfig?.status === "ready" ? "Ready for new checkouts" : "Setup required"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Moniger fee rule and routing sync status</p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-primary" />
                    <p className="text-sm text-muted-foreground">Payout destination</p>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">Save the bank account that should receive routed payments</h3>
                  <p className="text-sm text-muted-foreground">
                    If the payout destination changes, a platform admin may need to re-save the fee rule before new invoice checkouts
                    use the updated bank account.
                  </p>
                </div>
                <Badge variant="outline" className={getRoutingStatusBadgeClassName(payoutAccountConfig?.status)}>
                  {getRoutingStatusLabel(payoutAccountConfig?.status)}
                </Badge>
              </div>

              {payoutAccountConfig?.accountNumberLast4 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  Saved account ends with {payoutAccountConfig.accountNumberLast4}. Re-enter the full number below whenever you want
                  to resync or change it.
                </p>
              ) : null}

              {payoutAccountConfig?.lastSyncError ? (
                <div className="mt-4 rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                  {payoutAccountConfig.lastSyncError}
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label>Bank</Label>
                  <Select
                    value={payoutRoutingForm.bankId}
                    onValueChange={(value) => setPayoutRoutingForm((current) => ({ ...current, bankId: value }))}
                    disabled={isBusy}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={banksQuery.isLoading ? "Loading banks..." : "Select a bank"} />
                    </SelectTrigger>
                    <SelectContent>
                      {payoutRoutingBankOptions.map((bankOption) => (
                        <SelectItem key={bankOption.id} value={bankOption.id}>
                          {bankOption.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="payout-account-number">Account Number</Label>
                    <Input
                      id="payout-account-number"
                      value={payoutRoutingForm.accountNumber}
                      onChange={(event) =>
                        setPayoutRoutingForm((current) => ({
                          ...current,
                          accountNumber: event.target.value.replace(/\D/g, ""),
                        }))
                      }
                      placeholder="0123456789"
                      inputMode="numeric"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout-account-name">Account Name</Label>
                    <Input
                      id="payout-account-name"
                      value={payoutRoutingForm.accountName}
                      onChange={(event) =>
                        setPayoutRoutingForm((current) => ({ ...current, accountName: event.target.value }))
                      }
                      placeholder="Resolved automatically when syncing"
                      disabled={isBusy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout-currency">Routing Currency</Label>
                    <Input
                      id="payout-currency"
                      value={payoutRoutingForm.currency}
                      onChange={(event) =>
                        setPayoutRoutingForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))
                      }
                      maxLength={3}
                      disabled={isBusy}
                    />
                    <p className="text-xs text-muted-foreground">Use a 3-letter currency code like NGN.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payout-bank-code">Paystack Bank Code</Label>
                    <Input
                      id="payout-bank-code"
                      value={payoutRoutingForm.providerSettlementBankCode}
                      onChange={(event) =>
                        setPayoutRoutingForm((current) => ({
                          ...current,
                          providerSettlementBankCode: event.target.value,
                        }))
                      }
                      placeholder="Optional manual override"
                      disabled={isBusy}
                    />
                    <p className="text-xs text-muted-foreground">Optional. Add this only when you need to override Paystack bank-code lookup.</p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Live Paystack sync currently supports NG and GH account resolution. For those countries, use the full 10-digit bank
                  account number.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => void handlePayoutRoutingSave(false)} disabled={isBusy}>
                    {payoutRoutingMutations.upsertPayoutAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handlePayoutRoutingSave(true)}
                    disabled={isBusy}
                    className="bg-primary text-primary-foreground"
                  >
                    {payoutRoutingMutations.upsertPayoutAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & Sync Paystack
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Once the payout destination above is healthy and the platform admin has configured a fee rule, new Paystack invoice
              checkouts for this workspace will automatically include the right routing payload.
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MarketplaceRoutingPage;
