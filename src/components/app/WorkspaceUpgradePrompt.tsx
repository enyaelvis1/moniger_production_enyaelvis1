import { useMemo, useState } from "react";
import { ArrowRight, BadgeInfo, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { Button } from "@/components/ui/button";
import { useSubscriptionManagement } from "@/hooks/use-subscription-management";
import { usePublicPricingCatalog } from "@/hooks/use-public-pricing-catalog";
import { useToast } from "@/hooks/use-toast";
import {
  getDefaultSubscriptionBillingCycle,
  subscriptionCatalog,
  type SubscriptionPlan,
} from "@/lib/subscriptions";
import type { WorkspaceSubscription } from "@/hooks/use-workspace-subscription";

type WorkspaceUpgradePromptProps = {
  businessId?: string | null;
  currentPlan?: WorkspaceSubscription["plan"] | null;
  isCancelled?: boolean;
  isGracePeriod?: boolean;
  reason: "paid-plan-required" | "inactive-plan";
};

const upgradeBullets = [
  "Unlock reports, audit trail, and other premium workspace tools.",
  "Keep your team on a plan with stronger controls and exports.",
  "Upgrade with a secure recurring checkout and continue without interruption.",
];

const WorkspaceUpgradePrompt = ({
  businessId,
  currentPlan,
  isCancelled = false,
  isGracePeriod = false,
  reason,
}: WorkspaceUpgradePromptProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { handleUpgrade, isLoading } = useSubscriptionManagement();
  const { data: pricingCatalog } = usePublicPricingCatalog();
  const [pendingPlan, setPendingPlan] = useState<SubscriptionPlan | null>(null);

  const recommendedPlan: SubscriptionPlan = useMemo(() => {
    if (currentPlan === "business") {
      return "business";
    }

    return "growth";
  }, [currentPlan]);

  const heading =
    reason === "inactive-plan"
      ? isCancelled
        ? "Your workspace subscription is cancelled"
        : "Your workspace subscription needs attention"
      : "Upgrade your workspace to continue";

  const body =
    reason === "inactive-plan"
      ? isCancelled
        ? "Renew or upgrade your workspace subscription to restore access to premium features."
        : "Update billing to keep premium features available for your workspace."
      : "This page is available on an active paid plan. Upgrade your workspace to unlock it.";

  const catalogForPlan = (plan: SubscriptionPlan) => pricingCatalog?.[plan] ?? subscriptionCatalog[plan];
  const activePlan = currentPlan ?? "starter";

  const startUpgrade = async (plan: SubscriptionPlan) => {
    setPendingPlan(plan);

    try {
      const result = await handleUpgrade({
        billingCycle: getDefaultSubscriptionBillingCycle(plan),
        businessId: businessId ?? undefined,
        plan,
      });

      if (result.kind === "checkout") {
        window.location.assign(result.authorizationUrl);
        return;
      }

      toast({
        title: "Subscription updated",
        description: `${plan.charAt(0).toUpperCase()}${plan.slice(1)} is now active for your workspace.`,
      });
      navigate("/dashboard");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to complete subscription";
      toast({
        title: "Subscription failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setPendingPlan(null);
    }
  };

  return (
    <AppLayout>
      <div className="page-enter mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-5xl items-center px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <section className="rounded-[28px] border border-[#DCE2F2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)] backdrop-blur sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7FF] bg-[#F4F5FF] px-3 py-1 text-xs font-semibold text-[#5B67F7]">
              <Sparkles size={14} />
              Upgrade required
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-[-0.03em] text-[#10203F] sm:text-3xl">
              {heading}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5F6A88] sm:text-[15px]">
              {body}
              {currentPlan ? ` Current plan: ${currentPlan}.` : ""}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {upgradeBullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-2xl border border-[#E9ECF5] bg-[#FAFBFF] p-4 text-sm leading-6 text-[#4D5873]"
                >
                  <ShieldCheck className="mb-2 h-4 w-4 text-[#5B67F7]" />
                  {bullet}
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/pricing"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#10203F] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#1A2D57]"
              >
                Review plans
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/settings?tab=business"
                className="inline-flex h-11 items-center justify-center rounded-full border border-[#E6EAF6] bg-white px-5 text-sm font-semibold text-[#10203F] transition-colors hover:bg-[#F8FAFF]"
              >
                Open workspace settings
              </Link>
            </div>

            <div className="mt-8 rounded-[24px] border border-[#E6EAF6] bg-[#F8FAFF] p-4 sm:p-5">
              <p className="text-sm font-semibold text-[#10203F]">Upgrade without leaving this page</p>
              <p className="mt-1 text-sm leading-6 text-[#5F6A88]">
                Choose a plan below and we’ll take you straight to secure checkout.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(["growth", "business"] as const).map((plan) => {
                  const planCatalog = catalogForPlan(plan);
                  const isRecommended = plan === recommendedPlan;
                  const label = plan === "growth" ? "Upgrade to Growth" : "Upgrade to Business";
                  return (
                    <Button
                      key={plan}
                      type="button"
                      onClick={() => void startUpgrade(plan)}
                      disabled={isLoading}
                      className={`group h-auto min-h-[72px] flex-col items-start justify-center rounded-[20px] px-4 py-4 text-left shadow-none transition-transform hover:translate-y-[-1px] ${
                        isRecommended
                          ? "bg-[#10203F] text-white hover:bg-[#1A2D57]"
                          : "border border-[#E6EAF6] bg-white text-[#10203F] hover:bg-[#EEF2FF] hover:!text-[#10203F]"
                      }`}
                      variant={isRecommended ? "default" : "outline"}
                    >
                      <span className="text-sm font-semibold">{label}</span>
                      <span className={`mt-1 text-xs font-medium ${isRecommended ? "text-white/75" : "text-[#5F6A88] group-hover:!text-[#5F6A88]"}`}>
                        {planCatalog.priceLabel}
                      </span>
                      <span className={`mt-1 text-[11px] ${isRecommended ? "text-white/70" : "text-[#7C879F] group-hover:!text-[#7C879F]"}`}>
                        {pendingPlan === plan && isLoading ? "Opening checkout…" : "Secure Paystack billing"}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-[#DCE2F2] bg-gradient-to-br from-[#5B67F7] to-[#7C5CFF] p-6 text-white shadow-[0_18px_50px_rgba(16,32,63,0.10)] sm:p-8">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/75">
              <BadgeInfo size={14} />
              Plan status
            </div>
            <p className="mt-4 text-xl font-bold tracking-[-0.03em]">Current workspace plan</p>
            <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 shadow-[0_14px_30px_rgba(255,255,255,0.08)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.12em] text-white/70">Plan</p>
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Current plan
                </span>
              </div>
              <p className="mt-2 text-lg font-bold">{activePlan.toUpperCase()}</p>
              <p className="mt-1 text-sm font-semibold text-white/85">
                {catalogForPlan(activePlan).priceLabel}
              </p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {isCancelled
                  ? "This plan is cancelled and needs renewal or upgrade."
                  : isGracePeriod
                    ? "This workspace is past due. Billing needs attention."
                    : "This workspace feature requires a paid plan."}
              </p>
            </div>
            <div className="mt-4 space-y-3">
              {(["growth", "business"] as const).map((plan) => {
                const planCatalog = catalogForPlan(plan);
                const isActivePlan = currentPlan === plan;
                return (
                  <div
                    key={plan}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-all ${
                      isActivePlan
                        ? "border-white/50 bg-white/20 shadow-[0_14px_26px_rgba(255,255,255,0.12)] ring-2 ring-white/25"
                        : "border-white/15 bg-white/10"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{plan === "growth" ? "Growth" : "Business"}</p>
                        {isActivePlan ? (
                          <span className="rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-white/75">{planCatalog.priceLabel}</p>
                    </div>
                    <span className="text-xs uppercase tracking-[0.12em] text-white/65">Best for {plan === "growth" ? "growing teams" : "finance ops"}</span>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkspaceUpgradePrompt;
