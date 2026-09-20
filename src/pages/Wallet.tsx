import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, CheckCircle2, Copy, Download, Landmark, Loader2, RotateCcw, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useSettingsData, useWorkspaceWalletData } from "@/hooks/use-settings-data";
import { useWorkspaceWalletFundingMutations, useWorkspaceWalletFundingSessions } from "@/hooks/use-wallet-funding";
import { useWorkspacePayoutHistory } from "@/hooks/use-workspace-payouts";
import { useToast } from "@/hooks/use-toast";
import { waitForUiFrame } from "@/lib/async";
import { createExportFileName, downloadCsvFile } from "@/lib/export";
import {
  cancelWorkspaceBillPayout,
  approveWorkspaceBillPayout,
  getWorkspacePayoutErrorMessage,
  rescheduleWorkspaceBillPayout,
} from "@/lib/workspace-payout-execution";
import { getWorkspaceWalletFundingErrorMessage } from "@/lib/workspace-wallet-funding";

const getFundingStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case "initialized":
      return "Pending";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
};

const getFundingStatusBadgeClassName = (status: string | null | undefined) => {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "initialized":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "cancelled":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
};

const getPayoutStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case "pending_approval":
      return "Awaiting approval";
    case "reserved":
      return "Reserved in wallet";
    case "submitted":
      return "Submitted to provider";
    case "processing":
      return "Processing at provider";
    case "completed":
      return "Transfer settled";
    case "failed":
      return "Transfer failed";
    case "cancelled":
      return "Cancelled";
    case "reversed":
      return "Reversed by provider";
    default:
      return "Unknown";
  }
};

const getPayoutBookkeepingLabel = (status: string | null | undefined) => {
  switch (status) {
    case "pending_approval":
    case "reserved":
    case "submitted":
    case "processing":
      return "Bookkeeping: reserved";
    case "completed":
      return "Bookkeeping: paid";
    case "failed":
      return "Bookkeeping: released";
    case "reversed":
      return "Bookkeeping: reversed";
    case "cancelled":
      return "Bookkeeping: cancelled";
    default:
      return "Bookkeeping: unknown";
  }
};

const getPayoutTransferLabel = (status: string | null | undefined) => {
  switch (status) {
    case "pending_approval":
    case "reserved":
      return "Transfer: not sent yet";
    case "submitted":
      return "Transfer: pending";
    case "processing":
      return "Transfer: processing";
    case "completed":
      return "Transfer: successful";
    case "failed":
      return "Transfer: failed";
    case "reversed":
      return "Transfer: reversed";
    case "cancelled":
      return "Transfer: cancelled";
    default:
      return "Transfer: unknown";
  }
};

const getPayoutStatusBadgeClassName = (status: string | null | undefined) => {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending_approval":
    case "reserved":
    case "submitted":
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
    case "reversed":
    case "cancelled":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
};

const toDateTimeLocalValue = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMinutes = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offsetMinutes * 60_000);
  return localDate.toISOString().slice(0, 16);
};

const WalletPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { formatCurrency, formatDateTime } = useLocalization();
  const { toast } = useToast();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const workspaceWalletQuery = useWorkspaceWalletData(businessId);
  const walletFundingQuery = useWorkspaceWalletFundingSessions(businessId);
  const payoutHistoryQuery = useWorkspacePayoutHistory(businessId);
  const walletFundingMutations = useWorkspaceWalletFundingMutations(businessId);
  const [fundWorkspaceDialogOpen, setFundWorkspaceDialogOpen] = useState(false);
  const [fundAmount, setFundAmount] = useState("10000");
  const [payerName, setPayerName] = useState(
    typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : user?.email ?? "",
  );
  const [payoutActionTarget, setPayoutActionTarget] = useState<null | {
    id: string;
    scheduledFor: string | null;
  }>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [recentFundingSuccess, setRecentFundingSuccess] = useState<{
    amount: number;
    currency: string;
    reference: string;
    statusMessage: string;
  } | null>(null);
  const [recentPayoutConfirmation, setRecentPayoutConfirmation] = useState<{
    amount: number;
    billNumber: string | null;
    completedAt: string | null;
    currency: string;
    payoutId: string;
    providerReference: string | null;
    recipientBankCode: string | null;
    recipientBankName: string | null;
    statusLabel: string;
    vendorName: string | null;
  } | null>(null);
  const [isExportingHistory, setIsExportingHistory] = useState(false);

  const walletCurrency = workspaceWalletQuery.data?.currency ?? settingsQuery.data?.business?.default_currency ?? "NGN";
  const walletAvailableBalance = formatCurrency(workspaceWalletQuery.data?.available_balance ?? 0, walletCurrency);
  const walletReservedBalance = formatCurrency(workspaceWalletQuery.data?.reserved_balance ?? 0, walletCurrency);
  const walletBalance = formatCurrency(workspaceWalletQuery.data?.balance ?? 0, walletCurrency);
  const walletLastFundedAt = workspaceWalletQuery.data?.last_funded_at
    ? formatDateTime(workspaceWalletQuery.data.last_funded_at)
    : "Not funded yet";
  const walletStatus = workspaceWalletQuery.isLoading
    ? "Loading balance"
    : workspaceWalletQuery.data
      ? "Wallet ready"
      : "Awaiting wallet row";
  const parsedFundAmount = Number(fundAmount);
  const fundingHistory = useMemo(() => walletFundingQuery.data ?? [], [walletFundingQuery.data]);
  const payoutHistory = useMemo(() => payoutHistoryQuery.data ?? [], [payoutHistoryQuery.data]);
  const isFundingBusy = walletFundingMutations.initializeFunding.isPending;
  const fundingHistoryEmpty = walletFundingQuery.isLoading ? false : fundingHistory.length === 0;
  const payoutHistoryEmpty = payoutHistoryQuery.isLoading ? false : payoutHistory.length === 0;
  const canApprovePayouts = settingsQuery.data?.membership?.role === "owner" || settingsQuery.data?.membership?.role === "admin";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedSuccess = window.sessionStorage.getItem("walletFundingSuccess");
    if (!storedSuccess) {
      return;
    }

    window.sessionStorage.removeItem("walletFundingSuccess");

    try {
      const parsedSuccess = JSON.parse(storedSuccess) as {
        amount?: unknown;
        currency?: unknown;
        reference?: unknown;
        statusMessage?: unknown;
      };

      if (
        typeof parsedSuccess.amount === "number" &&
        typeof parsedSuccess.currency === "string" &&
        typeof parsedSuccess.reference === "string" &&
        typeof parsedSuccess.statusMessage === "string"
      ) {
        setRecentFundingSuccess({
          amount: parsedSuccess.amount,
          currency: parsedSuccess.currency,
          reference: parsedSuccess.reference,
          statusMessage: parsedSuccess.statusMessage,
        });
      }
    } catch {
      window.sessionStorage.removeItem("walletFundingSuccess");
    }
  }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get("fund") !== "1") {
      return;
    }

    setFundWorkspaceDialogOpen(true);
    navigate("/wallet", { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const latestCompletedPayout = payoutHistory.find((payout) => payout.status === "completed" && payout.completedAt);
    if (!latestCompletedPayout) {
      return;
    }

    const acknowledgementKey = `workspacePayoutConfirmationSeen:${latestCompletedPayout.id}`;
    if (window.sessionStorage.getItem(acknowledgementKey) === "true") {
      return;
    }

    setRecentPayoutConfirmation((currentConfirmation) => {
      if (currentConfirmation?.payoutId === latestCompletedPayout.id) {
        return currentConfirmation;
      }

      return {
        amount: latestCompletedPayout.amount,
        billNumber: latestCompletedPayout.billNumber,
        completedAt: latestCompletedPayout.completedAt,
        currency: latestCompletedPayout.currency,
        payoutId: latestCompletedPayout.id,
        providerReference: latestCompletedPayout.providerReference,
        recipientBankCode: latestCompletedPayout.recipientBankCode,
        recipientBankName: latestCompletedPayout.recipientBankName,
        statusLabel: getPayoutStatusLabel(latestCompletedPayout.status),
        vendorName: latestCompletedPayout.vendorName,
      };
    });
  }, [payoutHistory]);

  const openRescheduleDialog = (payoutId: string, scheduledFor: string | null) => {
    setPayoutActionTarget({ id: payoutId, scheduledFor });
    setRescheduleAt(toDateTimeLocalValue(scheduledFor));
  };

  const closeRescheduleDialog = () => {
    setPayoutActionTarget(null);
    setRescheduleAt("");
  };

  const handleStartFunding = async () => {
    if (!businessId) {
      toast({
        title: "Workspace not found",
        description: "We could not find a workspace to fund.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(parsedFundAmount) || parsedFundAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Enter a funding amount greater than zero.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await walletFundingMutations.initializeFunding.mutateAsync({
        amount: parsedFundAmount,
        businessId,
        payerName: payerName.trim() || null,
        returnUrl: typeof window !== "undefined" ? window.location.origin : null,
      });

      toast({
        title: "Funding session created",
        description: "Redirecting you to the payment provider now.",
      });
      setFundWorkspaceDialogOpen(false);
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      toast({
        title: "Unable to start wallet funding",
        description: getWorkspaceWalletFundingErrorMessage(error, "We couldn't start wallet funding right now. Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleCancelScheduledPayout = async (payoutId: string) => {
    if (!businessId) {
      toast({
        title: "Unable to cancel payout",
        description: "We could not find the workspace for this payout.",
        variant: "destructive",
      });
      return;
    }

    try {
      await cancelWorkspaceBillPayout({
        businessId,
        payoutId,
      });

      await payoutHistoryQuery.refetch();
      await workspaceWalletQuery.refetch();

      toast({
        title: "Payout cancelled",
        description: "The reserved funds were released back to the wallet.",
      });
    } catch (error) {
      toast({
        title: "Unable to cancel payout",
        description: getWorkspacePayoutErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleRescheduleScheduledPayout = async () => {
    if (!businessId || !payoutActionTarget) {
      toast({
        title: "Unable to reschedule payout",
        description: "Please select a payout first.",
        variant: "destructive",
      });
      return;
    }

    if (!rescheduleAt) {
      toast({
        title: "Unable to reschedule payout",
        description: "Choose a future date and time.",
        variant: "destructive",
      });
      return;
    }

    const scheduledFor = new Date(rescheduleAt);
    if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() <= Date.now()) {
      toast({
        title: "Unable to reschedule payout",
        description: "Choose a future date and time.",
        variant: "destructive",
      });
      return;
    }

    try {
      await rescheduleWorkspaceBillPayout({
        businessId,
        payoutId: payoutActionTarget.id,
        scheduledFor: scheduledFor.toISOString(),
      });

      await payoutHistoryQuery.refetch();

      toast({
        title: "Payout rescheduled",
        description: "The payout will run at the new scheduled time.",
      });

      closeRescheduleDialog();
    } catch (error) {
      toast({
        title: "Unable to reschedule payout",
        description: getWorkspacePayoutErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleApprovePayout = async (payoutId: string) => {
    if (!businessId) {
      toast({
        title: "Unable to approve payout",
        description: "We could not find the workspace for this payout.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await approveWorkspaceBillPayout({
        businessId,
        payoutId,
      });

      await payoutHistoryQuery.refetch();
      await workspaceWalletQuery.refetch();

      toast({
        title: "Payout approved",
        description:
          result.payoutStatus === "reserved"
            ? "The payout is approved and waiting for its scheduled execution time."
            : "The payout was approved and submitted for transfer.",
      });
    } catch (error) {
      toast({
        title: "Unable to approve payout",
        description: getWorkspacePayoutErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleCopyPayoutConfirmation = async () => {
    if (!recentPayoutConfirmation || typeof window === "undefined" || !window.navigator.clipboard) {
      return;
    }

    const summary = [
      "Payout confirmation",
      `Amount: ${formatCurrency(recentPayoutConfirmation.amount, recentPayoutConfirmation.currency)}`,
      `Bill: ${recentPayoutConfirmation.billNumber || "Unknown bill"}`,
      `Vendor: ${recentPayoutConfirmation.vendorName || "Unknown vendor"}`,
      `Bank: ${recentPayoutConfirmation.recipientBankName || "Unknown bank"}${
        recentPayoutConfirmation.recipientBankCode ? ` (${recentPayoutConfirmation.recipientBankCode})` : ""
      }`,
      `Reference: ${recentPayoutConfirmation.providerReference || recentPayoutConfirmation.payoutId}`,
      `Settled: ${recentPayoutConfirmation.completedAt ? formatDateTime(recentPayoutConfirmation.completedAt) : "Unknown"}`,
      `Status: ${recentPayoutConfirmation.statusLabel}`,
    ].join("\n");

    try {
      await window.navigator.clipboard.writeText(summary);
      toast({
        title: "Confirmation copied",
        description: "The payout confirmation summary has been copied to your clipboard.",
      });
    } catch {
      toast({
        title: "Unable to copy confirmation",
        description: "Your browser blocked clipboard access. Please try again or select the text manually.",
        variant: "destructive",
      });
    }
  };

  const handleExportHistoryCsv = async () => {
    const hasFundingHistory = fundingHistory.length > 0;
    const hasPayoutHistory = payoutHistory.length > 0;

    if (!hasFundingHistory && !hasPayoutHistory) {
      toast({
        title: "No wallet activity yet",
        description: "Add funding or payout activity first, then export the wallet history.",
      });
      return;
    }

    setIsExportingHistory(true);
    await waitForUiFrame();

    try {
      const rows = [
        ...fundingHistory.map((session) => ({
          createdAt: session.created_at,
          completedAt: session.completed_at || "",
          counterparty: session.payer_name || session.payer_email || "",
          currency: session.currency,
          detail: "Wallet funding",
          reference: session.provider_reference || session.id,
          section: "Funding history",
          status: session.status,
          statusDetails: session.failure_reason || "",
          amount: formatCurrency(session.amount, session.currency),
          bank: "",
        })),
        ...payoutHistory.map((payout) => ({
          createdAt: payout.createdAt,
          completedAt: payout.completedAt || "",
          counterparty: payout.vendorName || "",
          currency: payout.currency,
          detail: payout.billNumber ? `Bill ${payout.billNumber}` : "Bill payout",
          reference: payout.providerReference || payout.id,
          section: "Outgoing payouts",
          status: payout.status,
          statusDetails: payout.failureReason || "",
          amount: formatCurrency(payout.amount, payout.currency),
          bank: payout.recipientBankName
            ? `${payout.recipientBankName}${payout.recipientBankCode ? ` (${payout.recipientBankCode})` : ""}`
            : "",
        })),
      ];

      downloadCsvFile({
        columns: [
          { header: "Section", value: (row) => row.section },
          { header: "Detail", value: (row) => row.detail },
          { header: "Amount", value: (row) => row.amount },
          { header: "Currency", value: (row) => row.currency },
          { header: "Status", value: (row) => row.status },
          { header: "Reference", value: (row) => row.reference },
          { header: "Counterparty", value: (row) => row.counterparty },
          { header: "Bank", value: (row) => row.bank },
          { header: "Created At", value: (row) => row.createdAt },
          { header: "Completed At", value: (row) => row.completedAt },
          { header: "Status Details", value: (row) => row.statusDetails },
        ],
        filename: `${createExportFileName(`${settingsQuery.data?.business?.name ?? "wallet"}-history`)}.csv`,
        rows,
      });

      toast({
        title: "Wallet history exported",
        description: "Your funding and payout history CSV has been prepared for download.",
      });
    } catch {
      toast({
        title: "Unable to export wallet history",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsExportingHistory(false);
    }
  };

  const handleDismissPayoutConfirmation = () => {
    if (typeof window === "undefined" || !recentPayoutConfirmation) {
      setRecentPayoutConfirmation(null);
      return;
    }

    window.sessionStorage.setItem(`workspacePayoutConfirmationSeen:${recentPayoutConfirmation.payoutId}`, "true");
    setRecentPayoutConfirmation(null);
  };

  return (
    <AppLayout>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <p className="text-sm text-muted-foreground">Workspace funding</p>
            </div>
            <h2 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
              Available funding for outgoing payouts
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              This page shows the platform-managed funding balance available for outgoing payouts and lets workspace owners and
              admins start a secure top-up session.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
            <Badge variant="outline">{walletStatus}</Badge>
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" onClick={() => void handleExportHistoryCsv()} disabled={isExportingHistory}>
                {isExportingHistory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export CSV
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/settings?tab=business")}>
                Back to settings
              </Button>
            </div>
          </div>
        </div>

        {recentFundingSuccess ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-900">Funding successful</p>
                  <p className="text-sm text-emerald-800">
                    {formatCurrency(recentFundingSuccess.amount, recentFundingSuccess.currency)} was added to your workspace funding balance.
                  </p>
                  <p className="text-xs text-emerald-700">
                    Reference {recentFundingSuccess.reference} · {recentFundingSuccess.statusMessage}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
                onClick={() => setRecentFundingSuccess(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        {recentPayoutConfirmation ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />
                <div className="space-y-1">
                  <p className="font-semibold text-emerald-900">Payout completed</p>
                  <p className="text-sm text-emerald-800">
                    {formatCurrency(recentPayoutConfirmation.amount, recentPayoutConfirmation.currency)} was sent to{" "}
                    {recentPayoutConfirmation.vendorName || "the vendor"}.
                  </p>
                  <p className="text-xs text-emerald-700">
                    Reference {recentPayoutConfirmation.providerReference || recentPayoutConfirmation.payoutId} ·{" "}
                    {recentPayoutConfirmation.recipientBankName || "Unknown bank"}
                    {recentPayoutConfirmation.recipientBankCode ? ` (${recentPayoutConfirmation.recipientBankCode})` : ""}
                    {recentPayoutConfirmation.completedAt ? ` · Settled ${formatDateTime(recentPayoutConfirmation.completedAt)}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
                  onClick={() => void handleCopyPayoutConfirmation()}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-emerald-800 hover:bg-emerald-100 hover:text-emerald-950"
                  onClick={handleDismissPayoutConfirmation}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {workspaceWalletQuery.error ? (
          <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            We could not load the workspace wallet yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total funded</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{walletBalance}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reserved</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{walletReservedBalance}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Available</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{walletAvailableBalance}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Last funded</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{walletLastFundedAt}</p>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Funding workflow</p>
              <h3 className="text-base font-semibold text-foreground">Start a workspace top-up</h3>
              <p className="text-sm text-muted-foreground">
                Funds are credited only after Paystack confirms the transaction and the webhook settles the workspace funding balance.
              </p>
            </div>
            <Button
              type="button"
              className="w-full sm:w-auto"
              onClick={() => setFundWorkspaceDialogOpen(true)}
              disabled={!settingsQuery.data?.business}
            >
              Fund workspace
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Funding history</p>
              <h3 className="text-base font-semibold text-foreground">Recent top-up sessions</h3>
              <p className="text-sm text-muted-foreground">
                Only verified successes credit the workspace balance. Failed or pending sessions stay visible for auditability.
              </p>
            </div>
            <Badge variant="outline">{walletFundingQuery.isLoading ? "Loading" : `${fundingHistory.length} sessions`}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {walletFundingQuery.error ? (
              <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                We could not load workspace funding history yet.
              </div>
            ) : fundingHistoryEmpty ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                No funding sessions have been recorded yet.
              </div>
            ) : (
              fundingHistory.map((session) => (
                <div key={session.id} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{formatCurrency(session.amount, session.currency)}</p>
                        <Badge variant="outline" className={getFundingStatusBadgeClassName(session.status)}>
                          {getFundingStatusLabel(session.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Reference {session.provider_reference} · {session.payer_name || session.payer_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDateTime(session.created_at)}
                        {session.completed_at ? ` · Completed ${formatDateTime(session.completed_at)}` : ""}
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setFundWorkspaceDialogOpen(true)}>
                      Fund again
                    </Button>
                  </div>
                  {session.failure_reason ? (
                    <p className="mt-3 text-sm text-destructive">{session.failure_reason}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-background p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Outgoing payouts</p>
              <h3 className="text-base font-semibold text-foreground">Recent bill payout requests</h3>
              <p className="text-sm text-muted-foreground">
                These records show payout requests created from `Pay now` or `Schedule Payment`, including approval
                holds, reserved, submitted, failed, completed, and scheduled execution states.
              </p>
            </div>
            <Badge variant="outline">{payoutHistoryQuery.isLoading ? "Loading" : `${payoutHistory.length} payouts`}</Badge>
          </div>

          <div className="mt-5 space-y-3">
            {payoutHistoryQuery.error ? (
              <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                We could not load payout history yet.
              </div>
            ) : payoutHistoryEmpty ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                No payout requests have been recorded yet.
              </div>
            ) : (
              payoutHistory.map((payout) => (
                <div key={payout.id} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{formatCurrency(payout.amount, payout.currency)}</p>
                        <Badge variant="outline" className={getPayoutStatusBadgeClassName(payout.status)}>
                          {getPayoutStatusLabel(payout.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {payout.billNumber ? `Bill ${payout.billNumber}` : "Bill payout"} · {payout.vendorName || "Unknown vendor"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getPayoutBookkeepingLabel(payout.status)} · {getPayoutTransferLabel(payout.status)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {payout.recipientBankName ? `${payout.recipientBankName}${payout.recipientBankCode ? ` (${payout.recipientBankCode})` : ""}` : "Bank not set"}
                        {payout.providerReference ? ` · Reference ${payout.providerReference}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDateTime(payout.createdAt)}
                        {payout.scheduledFor ? ` · Scheduled ${formatDateTime(payout.scheduledFor)}` : ""}
                        {payout.submittedAt ? ` · Submitted ${formatDateTime(payout.submittedAt)}` : ""}
                        {payout.lastAttemptAt ? ` · Last attempt ${formatDateTime(payout.lastAttemptAt)}` : ""}
                        {payout.nextRetryAt ? ` · Retry at ${formatDateTime(payout.nextRetryAt)}` : ""}
                        {payout.completedAt ? ` · Completed ${formatDateTime(payout.completedAt)}` : ""}
                        {payout.cancelledAt ? ` · Cancelled ${formatDateTime(payout.cancelledAt)}` : ""}
                      </p>
                    </div>
                    {payout.status === "pending_approval" && canApprovePayouts ? (
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      <Button type="button" variant="outline" size="sm" onClick={() => void handleApprovePayout(payout.id)}>
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                        </Button>
                      </div>
                    ) : payout.status === "reserved" && payout.scheduledFor ? (
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      <Button
                        type="button"
                        variant="outline"
                          size="sm"
                          onClick={() => openRescheduleDialog(payout.id, payout.scheduledFor)}
                        >
                          <CalendarClock className="h-4 w-4" />
                          Reschedule
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleCancelScheduledPayout(payout.id)}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                  {payout.nextRetryAt ? (
                    <p className="mt-3 text-sm text-amber-700">
                      The payout hit a temporary provider issue. We’ll retry automatically.
                    </p>
                  ) : payout.failureReason ? (
                    <p className="mt-3 text-sm text-destructive">{payout.failureReason}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={Boolean(payoutActionTarget)}
        onOpenChange={(open) => {
          if (!open) {
            closeRescheduleDialog();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule payout</DialogTitle>
            <DialogDescription>Choose a new future date and time for this reserved payout.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout-reschedule-at">Execute at</Label>
              <Input
                id="payout-reschedule-at"
                type="datetime-local"
                value={rescheduleAt}
                onChange={(event) => setRescheduleAt(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeRescheduleDialog}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleRescheduleScheduledPayout()}>
                <RotateCcw className="h-4 w-4" />
                Save new time
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={fundWorkspaceDialogOpen} onOpenChange={setFundWorkspaceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Fund workspace</DialogTitle>
            <DialogDescription>
              Enter the amount you want to add, then continue to the secure provider checkout.
            </DialogDescription>
          </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="wallet-funding-amount">Amount</Label>
              <Input
                id="wallet-funding-amount"
                inputMode="decimal"
                value={fundAmount}
                onChange={(event) => setFundAmount(event.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="10000"
                disabled={isFundingBusy}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wallet-funding-payer-name">Payer name</Label>
              <Input
                id="wallet-funding-payer-name"
                value={payerName}
                onChange={(event) => setPayerName(event.target.value)}
                placeholder="Optional"
                disabled={isFundingBusy}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              Current wallet status:{" "}
              <span className="font-medium text-foreground">
                {workspaceWalletQuery.data ? "Wallet record available" : "Wallet record still loading"}
              </span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setFundWorkspaceDialogOpen(false)} disabled={isFundingBusy}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleStartFunding()} disabled={isFundingBusy}>
                {isFundingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continue to checkout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default WalletPage;
