import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  Plus,
  Send,
  Settings,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { format as formatDashboardDate } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { EmptyState } from "@/components/app/EmptyState";
import AppLayout from "@/components/app/AppLayout";
import OnboardingChecklist from "@/components/app/OnboardingChecklist";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useOperationsData, type ActivityModule } from "@/hooks/use-operations-data";
import { useSettingsData, useWorkspaceWalletData } from "@/hooks/use-settings-data";
import { getFriendlyErrorMessage } from "@/lib/error-handling";
import { getDefaultSubscriptionBillingCycle, isSubscriptionPlan, type SubscriptionPlan } from "@/lib/subscriptions";
import {
  clearEmailConfirmationReminder,
  hasEmailConfirmationReminderPending,
} from "@/lib/email-confirmation-reminder";
import { initializeWorkspaceSubscriptionCheckout } from "@/lib/workspace-subscriptions";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (index: number) => ({
    opacity: 1,
    transition: { delay: index * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    y: 0,
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: index * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  }),
};

const MotionCard = motion(Card);

const activityStyles: Record<ActivityModule, { bg: string; color: string; icon: typeof FileText }> = {
  Bills: { bg: "bg-[#FEF3F2]", color: "text-[#F97066]", icon: CreditCard },
  Customers: { bg: "bg-[#ECFDF3]", color: "text-[#16A34A]", icon: CheckCircle },
  Invoices: { bg: "bg-[#EEEDF8]", color: "text-[#5B67F7]", icon: FileText },
  Payments: { bg: "bg-[#F0FDF4]", color: "text-[#16A34A]", icon: TrendingUp },
  System: { bg: "bg-muted", color: "text-muted-foreground", icon: Clock },
  Vendors: { bg: "bg-[#EDE9FE]", color: "text-[#7C3AED]", icon: Building2 },
  Workspace: { bg: "bg-[#FEF9EE]", color: "text-[#F59E0B]", icon: Settings },
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const DashboardSkeleton = () => (
    <div className="min-w-0 space-y-8">
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-white/50 bg-white/75 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-card/70 sm:p-6"
          >
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-3 h-3 w-28" />
        </div>
      ))}
    </div>
          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-white/50 bg-white/75 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-card/70 sm:p-6"
        >
          <Skeleton className="mb-5 h-5 w-32" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((__, rowIndex) => (
              <div key={rowIndex} className="rounded-xl bg-[#F3F4FB] p-3 dark:bg-muted/30">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [showEmailConfirmationReminder, setShowEmailConfirmationReminder] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { formatCurrency, t } = useLocalization();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const operationsQuery = useOperationsData(businessId);
  const workspaceWalletQuery = useWorkspaceWalletData(businessId);
  const currency = settingsQuery.data?.business?.default_currency ?? "NGN";
  const dashboard = operationsQuery.data?.dashboard;
  const walletCurrency = workspaceWalletQuery.data?.currency ?? currency;
  const walletAvailableBalance = formatCurrency(workspaceWalletQuery.data?.available_balance ?? 0, walletCurrency);
  const walletReservedBalance = formatCurrency(workspaceWalletQuery.data?.reserved_balance ?? 0, walletCurrency);
  const walletBalanceValue = workspaceWalletQuery.isLoading ? "Loading..." : walletAvailableBalance;
  const handleRetryWorkspaceWallet = () => {
    void workspaceWalletQuery.refetch();
  };
  const handleRetryOperations = () => {
    void operationsQuery.refetch();
  };

  const isSettingsLoading = settingsQuery.isLoading && !settingsQuery.data;
  const isOperationsLoading = operationsQuery.isLoading && !operationsQuery.data;
  const emailConfirmed = searchParams.get("email_confirmed") === "1";
  const signupPlan = searchParams.get("signup_plan");
  const pendingSignupPlan: SubscriptionPlan | null = isSubscriptionPlan(signupPlan) && signupPlan !== "starter" ? signupPlan : null;
  useEffect(() => {
    if (!user?.id) {
      setShowEmailConfirmationReminder(false);
      return;
    }

    if (emailConfirmed) {
      clearEmailConfirmationReminder(user.id);
      setShowEmailConfirmationReminder(false);
      return;
    }

    setShowEmailConfirmationReminder(hasEmailConfirmationReminderPending(user.id));
  }, [emailConfirmed, user?.id]);
  const startPendingSignupPayment = async () => {
    if (!pendingSignupPlan || isPaymentLoading) {
      return;
    }

    setIsPaymentLoading(true);
    setPaymentError(null);

    try {
      const checkoutResult = await initializeWorkspaceSubscriptionCheckout({
        billingCycle: getDefaultSubscriptionBillingCycle(pendingSignupPlan),
        plan: pendingSignupPlan,
      });

      if (checkoutResult.kind === "checkout") {
        window.location.assign(checkoutResult.authorizationUrl);
        return;
      }

      navigate("/dashboard", { replace: true });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : "We could not start payment. Please try again.");
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const summaryCards = [
    {
      accent: "from-[#5B67F7] to-[#7C85FF]",
      icon: FileText,
      iconBg: "bg-[#EEEDF8]",
      iconColor: "text-[#5B67F7]",
      label: t("dashboard.summary.totalReceivable"),
      sub: `${dashboard?.openInvoices ?? 0} invoices still outstanding`,
      value: formatCurrency(dashboard?.totalReceivable ?? 0, currency),
    },
    {
      accent: "from-[#0EA5E9] to-[#38BDF8]",
      icon: Settings,
      iconBg: "bg-[#E0F2FE]",
      iconColor: "text-[#0284C7]",
      label: "Funding balance",
      sub:
        workspaceWalletQuery.error
          ? "Funding data could not be loaded"
          : workspaceWalletQuery.data
            ? `Reserved: ${walletReservedBalance}`
            : "Workspace funding row is loading",
      subColor: "text-[#0284C7]",
      value: walletBalanceValue,
    },
    {
      accent: "from-[#F97066] to-[#FCA5A1]",
      icon: CreditCard,
      iconBg: "bg-[#FEF3F2]",
      iconColor: "text-[#F97066]",
      label: t("dashboard.summary.totalPayable"),
      sub: `${dashboard?.dueThisWeekCount ?? 0} bills due this week`,
      value: formatCurrency(dashboard?.totalPayable ?? 0, currency),
    },
    {
      accent: "from-[#16A34A] to-[#4ADE80]",
      icon: TrendingUp,
      iconBg: "bg-[#F0FDF4]",
      iconColor: "text-[#16A34A]",
      label: t("dashboard.summary.collectedThisMonth"),
      sub:
        (dashboard?.confirmedReceivablePaymentsThisMonth ?? 0) > 0
          ? `${dashboard?.confirmedReceivablePaymentsThisMonth ?? 0} confirmed receivable payments this month`
          : "Waiting for confirmed receivable payments this month",
      subColor: "text-[#16A34A]",
      value: formatCurrency(dashboard?.collectedThisMonth ?? 0, currency),
    },
    {
      accent: "from-[#F59E0B] to-[#FCD34D]",
      icon: AlertTriangle,
      iconBg: "bg-[#FEF9EE]",
      iconColor: "text-[#F59E0B]",
      label: t("dashboard.summary.overdueItems"),
      sub: (dashboard?.overdueCount ?? 0) > 0 ? "Needs attention across invoices and bills" : "No overdue records right now",
      value: String(dashboard?.overdueCount ?? 0),
    },
  ];
  const quickActions = [
    { gradient: "from-[#5B67F7] to-[#7C85FF]", href: "/invoices", icon: FileText, label: t("dashboard.quickActions.newInvoice") },
    { gradient: "from-[#F97066] to-[#FCA5A1]", href: "/bills", icon: CreditCard, label: t("dashboard.quickActions.payBill") },
    { gradient: "from-[#16A34A] to-[#4ADE80]", href: "/vendors", icon: Building2, label: t("dashboard.quickActions.addVendor") },
  ] as const;
  const mobileSummaryCards = summaryCards.filter((card) => card.label !== "Funding balance");
  const mobileSummaryGroups = [
    mobileSummaryCards.slice(0, 2),
    mobileSummaryCards.slice(2, 4),
  ].filter((group) => group.length > 0);

  return (
    <AppLayout>
      {showEmailConfirmationReminder ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-950 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Please confirm your email</p>
            <p className="mt-1 text-sm leading-6 text-amber-900/80 dark:text-amber-100/80">
              Confirm your email to keep your Moniger account secure. You can continue using your dashboard for now.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              clearEmailConfirmationReminder(user?.id);
              setShowEmailConfirmationReminder(false);
            }}
            className="shrink-0 rounded-full border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-white dark:border-amber-400/40 dark:bg-transparent dark:text-amber-100"
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {isSettingsLoading || isOperationsLoading ? (
        <DashboardSkeleton />
      ) : (
        <motion.div initial="hidden" animate="visible" className="min-w-0 space-y-8">
          {emailConfirmed ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
              <div>
                <p className="font-semibold">Email confirmed successfully</p>
                <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-100/80">
                  Welcome to Moniger. Your workspace dashboard is ready.
                </p>
              </div>
            </div>
          ) : null}
          {pendingSignupPlan ? (
            <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] px-5 py-5 text-[#172554] shadow-sm dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-100">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">Complete your {pendingSignupPlan === "business" ? "Business" : "Growth"} plan setup</p>
                  <p className="mt-1 text-sm leading-6 text-indigo-900/80 dark:text-indigo-100/80">
                    Your email is confirmed. Continue to secure Paystack checkout to activate your workspace plan.
                  </p>
                </div>
                <Button type="button" onClick={() => void startPendingSignupPayment()} disabled={isPaymentLoading} className="shrink-0">
                  {isPaymentLoading ? "Preparing payment…" : "Continue to payment"}
                  {!isPaymentLoading ? <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" /> : null}
                </Button>
              </div>
              {paymentError ? <p className="mt-3 text-sm text-red-700 dark:text-red-200">{paymentError}</p> : null}
            </div>
          ) : null}
          {settingsQuery.error ? (
            <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{getErrorMessage(settingsQuery.error, "We could not load your workspace.")}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void settingsQuery.refetch()}
                  className="h-8 rounded-full border-[#F8C9C9] bg-white text-[#B42318] hover:bg-[#FEF2F2]"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          {operationsQuery.error ? (
            <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{getErrorMessage(operationsQuery.error, "We could not load the dashboard right now.")}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRetryOperations}
                  className="h-8 rounded-full border-[#F8C9C9] bg-white text-[#B42318] hover:bg-[#FEF2F2]"
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : null}

          {!businessId ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              Your workspace is still being prepared. Dashboard insights will appear here once the business record is available.
            </div>
          ) : null}

          {businessId && operationsQuery.data ? (
            <OnboardingChecklist
              businessId={businessId}
              businessReady={Boolean(settingsQuery.data?.business?.name?.trim())}
              customerCount={operationsQuery.data.reports.totalCustomers}
              vendorCount={operationsQuery.data.reports.totalVendors}
              invoiceCount={operationsQuery.data.reports.totalInvoices}
              billCount={operationsQuery.data.reports.totalBills}
              userId={user?.id ?? ""}
            />
          ) : null}

          <motion.div
            custom={0}
            variants={fadeUp}
            className="md:hidden overflow-hidden rounded-[32px] border border-white/30 bg-gradient-to-br from-[#5B67F7] via-[#6677FF] to-[#8B5CF6] p-4 text-white shadow-[0_18px_40px_rgba(91,103,247,0.24)]"
          >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium backdrop-blur">
                  <Wallet size={14} aria-hidden="true" />
                  Funding balance
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{walletBalanceValue}</p>
                  <p className="mt-1 text-sm text-white/80">Available for outgoing payouts</p>
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                <Settings size={18} className="text-white" aria-hidden="true" />
              </div>
              </div>
              {workspaceWalletQuery.error ? (
                <div className="mt-4 rounded-2xl border border-white/25 bg-white/10 px-3 py-2 text-xs text-white/90">
                  <div className="flex items-center justify-between gap-3">
                    <span>{getErrorMessage(workspaceWalletQuery.error, "Funding data could not be loaded.")}</span>
                    <button
                      type="button"
                      onClick={handleRetryWorkspaceWallet}
                      className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[#4F46E5] shadow-sm transition-transform active:scale-[0.98]"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => navigate("/wallet?fund=1")}
                className="rounded-2xl bg-white px-3 py-2.5 text-sm font-semibold text-[#4F46E5] shadow-sm transition-transform active:scale-[0.98]"
              >
                Fund workspace
              </button>
              <button
                type="button"
                onClick={() => navigate("/bills")}
                className="rounded-2xl border border-white/30 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white backdrop-blur transition-transform active:scale-[0.98]"
              >
                Pay bill
              </button>
            </div>
          </motion.div>

          <div className="hidden min-w-0 md:grid grid-cols-2 gap-3 xl:grid-cols-5">
            {summaryCards.map((card, index) => (
              <MotionCard
                key={card.label}
                custom={index}
                variants={scaleIn}
                whileHover={{ transition: { duration: 0.2 }, y: -4 }}
                className={`group relative flex h-full min-h-[152px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:min-h-[176px] sm:p-5 ${
                  card.label === "Funding balance" ? "col-span-2 sm:col-span-1" : ""
                }`}
              >
                <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0 space-y-1">
                    <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#64748B] dark:text-muted-foreground sm:text-xs">
                      {card.label}
                    </span>
                    <p className={`hidden text-xs ${card.subColor || "text-[#94A3B8] dark:text-muted-foreground"} sm:block`}>
                      {card.sub}
                    </p>
                  </div>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl sm:h-10 sm:w-10 ${card.iconBg}`}>
                    <card.icon size={18} className={card.iconColor} aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-auto flex flex-col gap-1 pt-4 sm:mt-3 sm:block sm:pt-0">
                  <p className="text-lg font-bold leading-none text-[#0D1B2A] dark:text-foreground sm:text-2xl">{card.value}</p>
                  <p className={`text-[11px] ${card.subColor || "text-[#94A3B8] dark:text-muted-foreground"} sm:hidden`}>
                    {card.sub}
                  </p>
                </div>
              </MotionCard>
            ))}
          </div>

          <div className="space-y-3 md:hidden">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold text-[#0D1B2A]">Quick metrics</p>
                <p className="text-xs text-[#94A3B8]">Swipe to see more cards</p>
              </div>
              <div className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-medium text-[#5B67F7] shadow-sm backdrop-blur">
                Swipe →
              </div>
            </div>

            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mobileSummaryGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="min-w-full snap-start">
                  <div className="grid auto-rows-fr grid-cols-2 items-stretch gap-3">
                    {group.map((card, index) => (
                      <MotionCard
                        key={card.label}
                        custom={index + 1}
                        variants={scaleIn}
                        whileTap={{ scale: 0.99 }}
                        className="group relative flex h-full min-h-[168px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-transform hover:shadow-md"
                      >
                        <div className={`absolute left-0 right-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748B] dark:text-muted-foreground">
                              {card.label}
                            </span>
                            <p className={`text-[11px] leading-snug ${card.subColor || "text-[#94A3B8] dark:text-muted-foreground"}`}>
                              {card.sub}
                            </p>
                          </div>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${card.iconBg}`}>
                            <card.icon size={16} className={card.iconColor} aria-hidden="true" />
                          </div>
                        </div>
                        <p className="mt-auto pt-4 text-[1.15rem] font-bold leading-none text-[#0D1B2A] dark:text-foreground">
                          {card.value}
                        </p>
                      </MotionCard>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 md:hidden">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-semibold text-[#0D1B2A]">More insights</p>
                <p className="text-xs text-[#94A3B8]">Swipe through the dashboard sections</p>
              </div>
              <div className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-medium text-[#5B67F7] shadow-sm backdrop-blur">
                Swipe →
              </div>
            </div>

            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="min-w-[92%] snap-start">
                <motion.div
                  custom={4}
                  variants={fadeUp}
                  className="flex h-[340px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">Due This Week</h3>
                      <p className="text-xs text-[#94A3B8] dark:text-muted-foreground">Bills that need attention soon</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs font-medium text-[#5B67F7] hover:bg-[#5B67F7]/10"
                      onClick={() => navigate("/bills")}
                    >
                      Open bills
                    </Button>
                  </div>

                  {dashboard && dashboard.dueThisWeek.length > 0 ? (
                    <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {dashboard.dueThisWeek.slice(0, 3).map((bill) => (
                        <div
                          key={bill.billNumber}
                          className="rounded-2xl border border-white/70 bg-white/82 p-3 shadow-sm dark:border-white/10 dark:bg-white/5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[#0D1B2A] dark:text-foreground">{bill.vendorName}</p>
                              <p className="text-xs text-[#94A3B8] dark:text-muted-foreground">
                                {bill.billNumber} • Due {formatDashboardDate(new Date(`${bill.dueDate}T00:00:00`), "MMM d, yyyy")}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-[#0D1B2A] dark:text-foreground">
                              {formatCurrency(bill.amount, currency)}
                            </span>
                          </div>
                        </div>
                      ))}
                      {dashboard.dueThisWeek.length > 3 ? (
                        <p className="pt-1 text-center text-[11px] text-[#94A3B8]">
                          +{dashboard.dueThisWeek.length - 3} more bills
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-white/70 bg-white/70 px-5 py-6 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#5B67F7] shadow-sm">
                        <CreditCard size={18} aria-hidden="true" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-[#0D1B2A] dark:text-foreground">No bills due this week</p>
                      <p className="mt-1 max-w-[220px] text-xs leading-5 text-[#94A3B8] dark:text-muted-foreground">
                        You're caught up on scheduled payments.
                      </p>
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="min-w-[92%] snap-start">
                <motion.div
                  custom={5}
                  variants={fadeUp}
                  className="flex h-[340px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">Recent Activity</h3>
                      <p className="text-xs text-[#94A3B8] dark:text-muted-foreground">Latest actions in the workspace</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-full px-3 text-xs font-medium text-[#5B67F7] hover:bg-[#5B67F7]/10"
                      onClick={() => navigate("/audit-trail")}
                    >
                      View all
                    </Button>
                  </div>

                  {dashboard && dashboard.recentActivity.length > 0 ? (
                    <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {dashboard.recentActivity.slice(0, 4).map((item) => {
                        const style = activityStyles[item.module];
                        const Icon = style.icon;
                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 rounded-2xl border border-white/70 bg-white/82 p-3 shadow-sm dark:border-white/10 dark:bg-white/5"
                          >
                            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${style.bg}`}>
                              <Icon size={14} className={style.color} aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium leading-snug text-[#0D1B2A] dark:text-foreground">{item.action}</p>
                              <p className="mt-0.5 text-xs leading-snug text-[#94A3B8] dark:text-muted-foreground">
                                {item.detail || item.relativeTime}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {dashboard.recentActivity.length > 4 ? (
                        <p className="pt-1 text-center text-[11px] text-[#94A3B8]">
                          +{dashboard.recentActivity.length - 4} more items
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-[28px] border border-dashed border-white/70 bg-white/70 px-5 py-6 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#5B67F7] shadow-sm">
                        <Clock size={18} aria-hidden="true" />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-[#0D1B2A] dark:text-foreground">No recent activity yet</p>
                      <p className="mt-1 max-w-[220px] text-xs leading-5 text-[#94A3B8] dark:text-muted-foreground">
                        New invoices, bills, and payments will appear here.
                      </p>
                    </div>
                  )}
                </motion.div>
              </div>

              <div className="min-w-[92%] snap-start">
                <motion.div
                  custom={5.5}
                  variants={fadeUp}
                  className="flex h-[340px] flex-col overflow-hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">Confirmed collections</h3>
                      <p className="text-xs text-[#94A3B8] dark:text-muted-foreground">Paystack-settled invoice payments</p>
                    </div>
                  </div>

                  <div className="mt-4 grid flex-1 grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/80 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#16A34A]">Paystack this month</p>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-[#16A34A]">Collections</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-[#0D1B2A] dark:text-foreground">
                        {formatCurrency(dashboard?.paystackCollectedThisMonth ?? 0, currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#D9EAFB]/50 bg-[#EEF7FF]/80 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-[#5B67F7]/20 dark:bg-[#5B67F7]/10">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] uppercase tracking-wide text-[#5B67F7]">Confirmed payments</p>
                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-[#5B67F7]">Count</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-[#0D1B2A] dark:text-foreground">
                        {dashboard?.confirmedReceivablePaymentsThisMonth ?? 0}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <div className="hidden min-w-0 grid gap-6 lg:grid-cols-2 md:grid">
            <motion.div
              custom={4}
              variants={fadeUp}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">
                  {t("dashboard.titles.dueThisWeek")}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs font-medium text-[#5B67F7] hover:bg-[#5B67F7]/10"
                  onClick={handleRetryOperations}
                >
                  Retry
                </Button>
              </div>
              {dashboard && dashboard.dueThisWeek.length > 0 ? (
                <div className="space-y-2">
                  {dashboard.dueThisWeek.map((bill, index) => (
                    <motion.div
                      key={bill.billNumber}
                      custom={index}
                      variants={fadeUp}
                      className="flex flex-col gap-3 rounded-2xl bg-white/70 p-3.5 transition-colors hover:bg-white/90 dark:bg-white/5 dark:hover:bg-white/10 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0D1B2A] dark:text-foreground">{bill.vendorName}</p>
                        <p className="text-xs text-[#94A3B8] dark:text-muted-foreground">
                          {bill.billNumber} • Due {formatDashboardDate(new Date(`${bill.dueDate}T00:00:00`), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-start">
                        <span className="text-sm font-semibold text-[#0D1B2A] dark:text-foreground">
                          {formatCurrency(bill.amount, currency)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs font-medium text-[#5B67F7] hover:bg-[#5B67F7]/10"
                          onClick={() => navigate("/bills")}
                        >
                          Open
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t("dashboard.empty.dueThisWeekTitle")}
                  description={t("dashboard.empty.dueThisWeekDescription")}
                  icon={CreditCard}
                  actions={[{ label: "Review bills", onClick: () => navigate("/bills"), variant: "outline" }]}
                />
              )}
            </motion.div>

            <motion.div
              custom={5}
              variants={fadeUp}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">{t("dashboard.recentActivity")}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs font-medium text-[#5B67F7] hover:bg-[#5B67F7]/10"
                  onClick={handleRetryOperations}
                >
                  Retry
                </Button>
              </div>
              {dashboard && dashboard.recentActivity.length > 0 ? (
                <div className="space-y-1">
                  {dashboard.recentActivity.map((item, index) => {
                    const style = activityStyles[item.module];
                    const Icon = style.icon;
                    return (
                      <motion.div
                        key={item.id}
                        custom={index}
                        variants={fadeUp}
                        className="flex items-start gap-3 rounded-2xl p-2.5 transition-colors hover:bg-white/80 dark:hover:bg-white/5"
                      >
                        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.bg}`}>
                          <Icon size={14} className={style.color} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm leading-snug text-[#0D1B2A] dark:text-foreground">{item.action}</p>
                          <p className="mt-0.5 text-xs text-[#94A3B8] dark:text-muted-foreground">
                            {item.detail || item.relativeTime}
                          </p>
                        </div>
                        <span className="ml-auto whitespace-nowrap text-xs text-[#94A3B8] dark:text-muted-foreground">
                          {item.relativeTime}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  title={t("dashboard.empty.recentActivityTitle")}
                  description={t("dashboard.empty.recentActivityDescription")}
                  icon={Clock}
                  actions={[{ label: "Create an invoice", onClick: () => navigate("/invoices") }]}
                />
              )}
            </motion.div>
          </div>

          <div className="md:hidden">
            <motion.div
              custom={5.5}
              variants={fadeUp}
              className="rounded-xl border border-border/60 bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">Quick actions</h3>
                  <p className="text-xs text-[#94A3B8] dark:text-muted-foreground">Start common workspace tasks</p>
                </div>
                <div className="rounded-full border border-white/60 bg-white/70 px-3 py-1 text-[11px] font-medium text-[#5B67F7] shadow-sm backdrop-blur">
                  3 actions
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={() => navigate(action.href)}
                      className="flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-[24px] border border-white/70 bg-white/85 px-2 py-3 text-center shadow-sm transition-transform active:scale-[0.99] dark:border-white/10 dark:bg-white/5"
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${action.gradient} shadow-sm`}>
                        <action.icon size={20} className="text-white" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold leading-tight text-[#0D1B2A] dark:text-foreground">
                          {action.label}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>

          <motion.div
            custom={5.5}
            variants={fadeUp}
            className="hidden rounded-xl border border-border/60 bg-card p-4 shadow-sm sm:p-6 md:block"
          >
            <div className="min-w-0">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                <h3 className="text-base font-semibold text-[#0D1B2A] dark:text-foreground">Confirmed online collections</h3>
                <p className="mt-1 text-sm text-[#94A3B8] dark:text-muted-foreground">
                  Paystack-settled invoice payments are folded into dashboard totals automatically.
                </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 self-start rounded-full px-3 text-xs font-medium text-[#5B67F7] hover:bg-[#5B67F7]/10"
                  onClick={handleRetryOperations}
                >
                  Retry
                </Button>
              </div>
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-200/40 bg-emerald-50/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="text-xs uppercase tracking-wide text-[#16A34A]">Paystack this month</p>
                  <p className="mt-1 text-lg font-semibold text-[#0D1B2A] dark:text-foreground">
                    {formatCurrency(dashboard?.paystackCollectedThisMonth ?? 0, currency)}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#D9EAFB]/50 bg-[#EEF7FF]/70 px-4 py-3 shadow-sm backdrop-blur-sm dark:border-[#5B67F7]/20 dark:bg-[#5B67F7]/10">
                  <p className="text-xs uppercase tracking-wide text-[#5B67F7]">Confirmed payments</p>
                  <p className="mt-1 text-lg font-semibold text-[#0D1B2A] dark:text-foreground">
                    {dashboard?.confirmedReceivablePaymentsThisMonth ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="hidden gap-4 sm:grid-cols-3 md:grid">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.label}
                custom={index + 6}
                variants={scaleIn}
                whileHover={{ transition: { duration: 0.2 }, y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(action.href)}
                className="group flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 text-left shadow-sm transition-all hover:border-[#5B67F7]/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2 sm:p-5"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} shadow-sm`}>
                  <action.icon size={20} className="text-white" aria-hidden="true" />
                </div>
                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-[#94A3B8]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[#0D1B2A] dark:text-foreground">{action.label}</span>
                </div>
                <ArrowRight
                  size={14}
                  className="ml-auto text-[#94A3B8] opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100"
                  aria-hidden="true"
                />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AppLayout>
  );
};

export default Dashboard;
