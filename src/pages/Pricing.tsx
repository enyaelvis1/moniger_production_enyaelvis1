import { CheckCircle2, Layers3, Rocket } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import PublicPageShell, { publicFadeUp } from "@/components/public/PublicPageShell";
import { cn } from "@/lib/utils";
import { useSubscriptionManagement } from "@/hooks/use-subscription-management";
import { usePublicPricingCatalog } from "@/hooks/use-public-pricing-catalog";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
import { useToast } from "@/hooks/use-toast";
import {
  createSubscriptionIntentPath,
  getDefaultSubscriptionBillingCycle,
  isSubscriptionBillingCycle,
  isSubscriptionPlan,
  subscriptionCatalog,
  type SubscriptionBillingCycle,
  type SubscriptionPlan,
  type WorkspaceSubscriptionActionResult,
} from "@/lib/subscriptions";

const plans = [
  { name: "Starter", plan: "starter", tone: "bg-white" },
  { name: "Growth", plan: "growth", tone: "bg-[#F8F8FC]" },
  { name: "Business", plan: "business", tone: "bg-[#F3F7F9]" },
] as const;

const isAuthSubscriptionError = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("signed in") ||
    normalizedMessage.includes("active session") ||
    normalizedMessage.includes("authentication") ||
    normalizedMessage.includes("unauthorized");
};

const isWorkspaceProvisioningError = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("business workspace is required") ||
    normalizedMessage.includes("workspace is required");
};

const PricingPage = () => {
  const { session } = useSupabaseSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { handleSubscribe, isLoading } = useSubscriptionManagement();
  const { data: pricingCatalog } = usePublicPricingCatalog();
  const { toast } = useToast();
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [autoSubscribeRetryCount, setAutoSubscribeRetryCount] = useState(0);
  const attemptedIntentRef = useRef<string | null>(null);

  const pendingPlan = searchParams.get("subscribe");
  const pendingBillingCycle = searchParams.get("billingCycle");
  const autoSubscribePlan = isSubscriptionPlan(pendingPlan) ? pendingPlan : null;
  const autoSubscribeBillingCycle: SubscriptionBillingCycle = isSubscriptionBillingCycle(pendingBillingCycle)
    ? pendingBillingCycle
    : autoSubscribePlan
      ? getDefaultSubscriptionBillingCycle(autoSubscribePlan)
      : "monthly";

  const handleSubscriptionResult = ({
    plan,
    planName,
    result,
  }: {
    plan: SubscriptionPlan;
    planName: string;
    result: WorkspaceSubscriptionActionResult;
  }) => {
    if (result.kind === "checkout") {
      window.location.assign(result.authorizationUrl);
      return;
    }

    toast({
      title: "Subscription updated",
      description:
        plan === "starter"
          ? `${planName} is now active for your workspace.`
          : `${planName} is active and ready in your workspace.`,
    });

    navigate("/dashboard");
  };

  const handleGetStarted = async (plan: SubscriptionPlan, planName: string) => {
    setSubscribingTo(planName);
    const billingCycle = getDefaultSubscriptionBillingCycle(plan);
    const subscriptionIntentPath = createSubscriptionIntentPath({
      billingCycle,
      plan,
    });

    if (!session) {
      navigate(`/register?next=${encodeURIComponent(subscriptionIntentPath)}`);
      setSubscribingTo(null);
      return;
    }

    try {
      const result = await handleSubscribe({
        billingCycle,
        plan,
      });

      handleSubscriptionResult({
        plan,
        planName,
        result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to complete subscription";

      if (isAuthSubscriptionError(errorMessage)) {
        toast({
          title: "Sign in required",
          description: "Sign in again to continue with this subscription.",
          variant: "destructive",
        });
        navigate(`/login?next=${encodeURIComponent(subscriptionIntentPath)}`);
      } else {
        toast({
          title: "Subscription failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    } finally {
      setSubscribingTo(null);
    }
  };

  useEffect(() => {
    if (!session || !autoSubscribePlan) {
      return;
    }

    const intentKey = `${autoSubscribePlan}:${autoSubscribeBillingCycle}:${autoSubscribeRetryCount}`;
    if (attemptedIntentRef.current === intentKey || isLoading) {
      return;
    }

    attemptedIntentRef.current = intentKey;
    let active = true;
    let retryTimeoutId: number | null = null;

    const applyPendingSubscription = async () => {
      try {
        const result = await handleSubscribe({
          billingCycle: autoSubscribeBillingCycle,
          plan: autoSubscribePlan,
        });

        if (!active) {
          return;
        }

        if (result.kind === "checkout") {
          window.location.assign(result.authorizationUrl);
          return;
        }

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("billingCycle");
        nextParams.delete("subscribe");
        setSearchParams(nextParams, { replace: true });
        toast({
          title: "Subscription ready",
          description: `${autoSubscribePlan.charAt(0).toUpperCase()}${autoSubscribePlan.slice(1)} is now active for your workspace.`,
        });
        navigate("/dashboard", { replace: true });
      } catch (error) {
        if (!active) {
          return;
        }

        const errorMessage = error instanceof Error ? error.message : "Unable to complete subscription";

        if (isWorkspaceProvisioningError(errorMessage) && autoSubscribeRetryCount < 2) {
          retryTimeoutId = window.setTimeout(() => {
            setAutoSubscribeRetryCount((currentCount) => currentCount + 1);
          }, 1200);
          return;
        }

        toast({
          title: "Subscription failed",
          description: errorMessage,
          variant: "destructive",
        });
      }
    };

    void applyPendingSubscription();

    return () => {
      active = false;
      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }
    };
  }, [
    autoSubscribeBillingCycle,
    autoSubscribePlan,
    autoSubscribeRetryCount,
    handleSubscribe,
    isLoading,
    navigate,
    searchParams,
    session,
    setSearchParams,
    toast,
  ]);

  return (
    <PublicPageShell
      eyebrow="Pricing"
      title="Straightforward pricing for teams growing into better finance operations."
      description="Start free, get your workflows in shape, and move into a real recurring workspace subscription when your team is ready."
      contentClassName="max-w-[1420px]"
      highlights={[
        { label: "Starter setup", value: "<2 min" },
        { label: "Paid checkout", value: "Paystack" },
        { label: "Growth path", value: "Built in" },
      ]}
      cta={{ label: "Create free account", to: "/register" }}
      accent={(
        <div className="rounded-[30px] border border-[#DCE2F2] bg-[#10203F] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
              <Rocket size={22} className="text-[#D7E3FF]" />
              <p className="mt-4 text-lg font-bold">Start lean</p>
              <p className="mt-2 text-sm leading-[1.7] text-white/70">Send invoices, track payments, and establish a reliable operating rhythm.</p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
              <Layers3 size={22} className="text-[#D7E3FF]" />
              <p className="mt-4 text-lg font-bold">Scale with confidence</p>
              <p className="mt-2 text-sm leading-[1.7] text-white/70">Paid plans now launch through a real Paystack recurring checkout instead of a placeholder upgrade action.</p>
            </div>
          </div>
          <div className="mt-4 rounded-[22px] bg-[#D7E3FF] px-5 py-4 text-[#10203F]">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4154D8]">Subscription flow</p>
            <p className="mt-1 text-sm font-medium">Starter activates immediately. Growth and Business redirect to secure Paystack billing.</p>
          </div>
        </div>
      )}
    >
      {session ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[22px] border border-[#DCE2F2] bg-white/90 px-4 py-3 shadow-[0_16px_40px_rgba(16,32,63,0.05)]">
          <p className="text-sm font-medium text-[#10203F]">You’re signed in. You can return to your workspace anytime.</p>
          <div className="ml-auto flex flex-wrap gap-2">
            <Link
              to="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#10203F] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1A2D57]"
            >
              Back to dashboard
            </Link>
            <Link
              to="/settings?tab=profile"
              className="inline-flex h-10 items-center justify-center rounded-full border border-[#DCE2F2] bg-white px-4 text-sm font-semibold text-[#10203F] transition-colors hover:bg-[#F8FAFF]"
            >
              Open settings
            </Link>
          </div>
        </div>
      ) : null}

      <motion.section initial="hidden" animate="visible">
        <motion.div variants={publicFadeUp} custom={0}>
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Plans</p>
          <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Choose the maturity stage that fits your team.</h2>
        </motion.div>
        <motion.div
          variants={publicFadeUp}
          custom={1}
          className="mt-6 rounded-[24px] border border-[#DCE2F2] bg-white px-5 py-5 shadow-[0_18px_50px_rgba(16,32,63,0.06)] md:flex md:items-start md:gap-4"
        >
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4154D8]">
            <Layers3 size={22} />
          </div>
          <div className="mt-4 md:mt-0">
            <p className="text-lg font-bold tracking-[-0.02em] text-[#10203F]">Every plan starts with a clean foundation.</p>
            <p className="mt-2 text-sm leading-[1.75] text-[#5F6A88]">
              Use Starter without a card, then move into Paystack-backed recurring billing when the business needs deeper controls.
            </p>
          </div>
        </motion.div>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {plans.map((planEntry, index) => {
            const catalogEntry = pricingCatalog?.[planEntry.plan] ?? subscriptionCatalog[planEntry.plan];
            const ctaLabel = planEntry.plan === "starter" ? "Start free" : "Subscribe now";

            return (
              <motion.article
                key={planEntry.name}
                variants={publicFadeUp}
                custom={index + 1}
                className={cn(
                  "flex h-full flex-col rounded-[28px] border border-[#DCE2F2] p-7 shadow-[0_18px_50px_rgba(16,32,63,0.06)] ring-2 ring-[#10203F]/10",
                  planEntry.tone,
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-[24px] font-black tracking-[-0.03em] text-[#10203F]">{planEntry.name}</h3>
                </div>
                <div className="mt-4 min-h-[152px]">
                  <p className="text-[42px] font-black tracking-[-0.04em] text-[#10203F] sm:text-[46px]">
                    {catalogEntry.priceLabel}
                  </p>
                  <p className="mt-3 text-sm leading-[1.75] text-[#5F6A88]">{catalogEntry.description}</p>
                </div>
                <div className="mt-6 flex flex-1 flex-col space-y-3 border-t border-[#E6EAF6] pt-6">
                  {catalogEntry.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#1E8A4C]" />
                      <span className="text-sm leading-[1.7] text-[#33415C]">{feature}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => handleGetStarted(planEntry.plan, planEntry.name)}
                  disabled={isLoading || subscribingTo === planEntry.name}
                  className="mt-8 flex min-h-[60px] w-full items-center justify-center rounded-full bg-[#5B67F7] px-5 py-2.5 text-center font-bold text-white transition-colors hover:bg-[#4A56E0] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {subscribingTo === planEntry.name && isLoading
                    ? "Processing..."
                    : ctaLabel}
                </button>
              </motion.article>
            );
          })}
        </div>
      </motion.section>
    </PublicPageShell>
  );
};

export default PricingPage;
