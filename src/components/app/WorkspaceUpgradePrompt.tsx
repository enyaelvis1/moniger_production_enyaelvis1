import { useMemo, useState } from "react";
import { ArrowRight, BadgeInfo, Check, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
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
      <div className="page-enter mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#E5E7FF] bg-[#F4F5FF] px-3 py-1 text-xs font-semibold text-[#5B67F7]">
              <Sparkles size={14} />
              Premium workspace feature
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-[#10203F] sm:text-4xl">{heading}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5F6A88] sm:text-[15px]">
              {body}{currentPlan ? ` Your current plan is ${currentPlan}.` : ""}
            </p>
          </div>
          <Link to="/settings?tab=business" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCE2F2] bg-white px-4 text-sm font-semibold text-[#10203F] shadow-sm transition-colors hover:bg-[#F8FAFF]">
            Workspace settings <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-3xl border border-[#DCE2F2] bg-white p-5 shadow-[0_16px_45px_rgba(16,32,63,0.06)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#EDF0F7] pb-5">
              <div>
                <p className="text-lg font-bold tracking-[-0.02em] text-[#10203F]">Choose the right plan for your team</p>
                <p className="mt-1 text-sm text-[#6B7693]">Upgrade securely with recurring Paystack billing.</p>
              </div>
              <BadgeInfo className="mt-1 hidden h-5 w-5 text-[#5B67F7] sm:block" />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {(["growth", "business"] as const).map((plan) => {
                const planCatalog = catalogForPlan(plan);
                const isRecommended = plan === recommendedPlan;
                const label = plan === "growth" ? "Growth" : "Business";
                return (
                  <div key={plan} className={`relative flex flex-col rounded-2xl border p-5 transition-shadow hover:shadow-[0_12px_28px_rgba(16,32,63,0.08)] ${isRecommended ? "border-[#5B67F7] ring-2 ring-[#5B67F7]/10" : "border-[#E1E6F2]"}`}>
                    {isRecommended ? <span className="absolute -top-3 left-4 rounded-full bg-[#5B67F7] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white">Recommended</span> : null}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-bold text-[#10203F]">{label}</p>
                        <p className="mt-1 text-sm text-[#6B7693]">{plan === "growth" ? "For growing teams" : "For finance operations"}</p>
                      </div>
                      <ShieldCheck className="h-5 w-5 text-[#5B67F7]" />
                    </div>
                    <p className="mt-5 text-2xl font-bold tracking-[-0.03em] text-[#10203F]">{planCatalog.priceLabel}</p>
                    <div className="mt-5 space-y-2 border-t border-[#EDF0F7] pt-4 text-sm text-[#4D5873]">
                      {upgradeBullets.slice(0, plan === "business" ? 3 : 2).map((bullet) => (
                        <p key={bullet} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22A06B]" />{bullet}</p>
                      ))}
                    </div>
                    <Button type="button" onClick={() => void startUpgrade(plan)} disabled={isLoading} className={`mt-6 h-11 w-full rounded-xl text-sm font-semibold shadow-none ${isRecommended ? "bg-[#10203F] hover:bg-[#1A2D57]" : "border-[#DCE2F2] bg-white text-[#10203F] hover:bg-[#F4F6FF] hover:text-[#10203F]"}`} variant={isRecommended ? "default" : "outline"}>
                      {pendingPlan === plan && isLoading ? "Opening checkout…" : `Upgrade to ${label}`} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <Link to="/pricing" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[#5B67F7] hover:text-[#4653D8]">Compare all plan details <ArrowRight size={15} /></Link>
          </section>

          <aside className="h-fit rounded-3xl border border-[#DCE2F2] bg-[#10203F] p-5 text-white shadow-[0_16px_45px_rgba(16,32,63,0.12)] sm:p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/60"><BadgeInfo size={14} /> Plan status</div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.07] p-4">
              <div className="flex items-center justify-between gap-3"><p className="text-xs uppercase tracking-[0.12em] text-white/55">Current plan</p><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/75">{activePlan}</span></div>
              <p className="mt-3 text-2xl font-bold">{catalogForPlan(activePlan).priceLabel}</p>
              <p className="mt-2 text-sm leading-6 text-white/65">{isCancelled ? "Cancelled — renew to restore access." : isGracePeriod ? "Past due — billing needs attention." : "Premium features are not included on this plan."}</p>
            </div>
            <div className="mt-5 space-y-3 text-sm text-white/70">
              <p className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#71E0B0]" /> Secure recurring billing</p>
              <p className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#71E0B0]" /> Upgrade takes effect after confirmation</p>
              <p className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-[#71E0B0]" /> Cancel or manage from settings</p>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
};

export default WorkspaceUpgradePrompt;
