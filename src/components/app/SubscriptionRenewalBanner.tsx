import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CalendarClock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { WorkspaceSubscription } from "@/hooks/use-workspace-subscription";

const getRemainingParts = (renewalAt: string, now: number) => {
  const remainingMs = Math.max(0, new Date(renewalAt).getTime() - now);
  const totalHours = Math.floor(remainingMs / (60 * 60 * 1000));
  return {
    days: Math.floor(totalHours / 24),
    hours: totalHours % 24,
  };
};

const getTrialDurationLabel = (subscription: WorkspaceSubscription) => {
  if (!subscription.trialStartedAt || !subscription.trialEndsAt) return "Growth";
  const durationMinutes = Math.max(1, Math.round((new Date(subscription.trialEndsAt).getTime() - new Date(subscription.trialStartedAt).getTime()) / (60 * 1000)));
  return durationMinutes >= 1440
    ? `${Math.round(durationMinutes / 1440)}-day Growth`
    : `${durationMinutes}-minute Growth`;
};

export const SubscriptionRenewalBanner = ({
  isStartingTrial = false,
  onStartTrial,
  subscription,
}: {
  isStartingTrial?: boolean;
  onStartTrial?: () => void;
  subscription: WorkspaceSubscription;
}) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const renewalAt = subscription.nextRenewalAt;
  const remaining = useMemo(
    () => (renewalAt ? getRemainingParts(renewalAt, now) : null),
    [now, renewalAt],
  );

  if (subscription.plan === "starter") {
    return (
      <section aria-label="Subscription status" className="mb-4 rounded-2xl border border-[#CBD5E1] bg-white/80 px-4 py-4 text-[#334155] shadow-sm dark:border-white/10 dark:bg-card/70 dark:text-slate-200">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Starter plan</p>
            <p className="mt-1 text-sm leading-6 opacity-80">Start the configured Growth trial with paid workspace features, then choose whether to continue with a subscription.</p>
          </div>
          <button type="button" onClick={onStartTrial} disabled={!onStartTrial || isStartingTrial} className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-[#5B67F7] px-4 text-sm font-semibold text-white hover:bg-[#4A56E0] disabled:cursor-not-allowed disabled:opacity-60">{isStartingTrial ? "Starting trial…" : "Start Growth trial"}</button>
        </div>
      </section>
    );
  }

  if (!renewalAt) {
    return (
      <section aria-label="Subscription status" className="mb-4 rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-4 text-[#92400E] shadow-sm">
        <p className="font-semibold">Renewal date pending</p>
        <p className="mt-1 text-sm leading-6 opacity-90">Your {subscription.plan} subscription does not have a confirmed renewal date yet. Review billing settings to continue.</p>
        <Link to="/settings?tab=business" className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-white/85 px-4 text-sm font-semibold text-[#10203F] hover:bg-white">Manage subscription</Link>
      </section>
    );
  }

  if (!["active", "trial"].includes(subscription.status)) {
    return null;
  }

  const renewalDate = new Date(renewalAt).toLocaleDateString("en-NG", { dateStyle: "medium" });
  const isDueSoon = remaining ? remaining.days < 14 : false;
  const isDueToday = remaining ? remaining.days === 0 : false;

  return (
    <section
      aria-label="Subscription renewal status"
      className={`mb-4 rounded-2xl border px-4 py-4 shadow-sm ${
        isDueToday
          ? "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
          : isDueSoon
            ? "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
            : "border-[#C7D2FE] bg-[#EEF2FF] text-[#1E3A8A]"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {isDueToday ? <AlertCircle className="mt-0.5 shrink-0" size={20} /> : <CalendarClock className="mt-0.5 shrink-0" size={20} />}
          <div>
            <p className="font-semibold">
              {subscription.status === "trial" ? `Your ${getTrialDurationLabel(subscription)} trial` : isDueToday ? "Your subscription renews today" : `Your ${subscription.plan} subscription renews soon`}
            </p>
            <p className="mt-1 text-sm leading-6 opacity-90">
              {remaining ? `${remaining.days} day${remaining.days === 1 ? "" : "s"} and ${remaining.hours} hour${remaining.hours === 1 ? "" : "s"} remaining` : "Renewal date unavailable"} · {renewalDate}
            </p>
          </div>
        </div>
        <Link
          to="/subscription"
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-white/85 px-4 text-sm font-semibold text-[#10203F] transition-colors hover:bg-white"
        >
          Manage subscription
        </Link>
      </div>
      {subscription.cancelAtPeriodEnd ? (
        <p className="mt-3 flex items-center gap-2 text-sm opacity-90">
          <CheckCircle2 size={16} /> Renewal is cancelled; access continues until the date above.
        </p>
      ) : null}
    </section>
  );
};
