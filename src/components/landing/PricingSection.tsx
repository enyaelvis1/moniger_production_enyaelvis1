import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { buttonClass, containerClass } from "./landing-shared";
import { useSubscriptionManagement } from "@/hooks/use-subscription-management";
import { usePublicPricingCatalog } from "@/hooks/use-public-pricing-catalog";
import { useSupabaseSession } from "@/hooks/use-supabase-session";
import { useToast } from "@/hooks/use-toast";
import {
  createSubscriptionIntentPath,
  getDefaultSubscriptionBillingCycle,
  subscriptionCatalog,
  type SubscriptionPlan,
  type WorkspaceSubscriptionActionResult,
} from "@/lib/subscriptions";

const pricingPlans = [
  { name: "Starter", plan: "starter" },
  { name: "Growth", plan: "growth" },
  { name: "Business", plan: "business" },
] as const;

const isAuthSubscriptionError = (message: string) => {
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("signed in") ||
    normalizedMessage.includes("active session") ||
    normalizedMessage.includes("authentication") ||
    normalizedMessage.includes("unauthorized");
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

const PricingSection = () => {
  const { session } = useSupabaseSession();
  const navigate = useNavigate();
  const { handleSubscribe, isLoading } = useSubscriptionManagement();
  const { data: pricingCatalog } = usePublicPricingCatalog();
  const { toast } = useToast();
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);

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

  return (
    <section
      id="pricing"
      className="landing-peel-section relative z-[7] bg-[#EAECF8] px-6 py-16 md:px-10 lg:px-12 lg:py-[100px]"
    >
      <span className="landing-peek-label z-[7] border border-[#D8DDF0] bg-[#EAECF8] text-[#677391]">
        PRICING
      </span>

      <div className={containerClass}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mx-auto max-w-[680px] text-center"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#0D1B2A] sm:text-[40px] md:text-[48px]">
            Simple pricing. Start free.
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="mt-4 text-[16px] leading-[1.7] text-[#4A5568] md:text-[18px]">
            Starter activates immediately. Paid plans now redirect through secure Paystack billing.
          </motion.p>
        </motion.div>

        <div className="mt-10 flex flex-col gap-5 lg:hidden">
          {pricingPlans.map((plan, i) => {
            const catalogEntry = pricingCatalog?.[plan.plan] ?? subscriptionCatalog[plan.plan];

            return (
              <motion.article
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative rounded-[16px] border border-[#E8E4DF] border-t-[3px] border-t-[#0D1B2A] bg-white p-7"
              >
                <div>
                  <p className="text-[18px] font-semibold text-[#0D1B2A]">{plan.name}</p>
                  <p className="mt-3 text-[40px] font-black leading-none tracking-[-0.02em] text-[#0D1B2A]">{catalogEntry.priceLabel}</p>
                  <p className="mt-3 text-[14px] leading-[1.7] text-[#4A5568]">{catalogEntry.description}</p>
                  <div className="my-6 border-t border-[#E8E4DF]" />
                  <div className="space-y-3">
                    {catalogEntry.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3">
                        <CheckCircle2 size={16} className="text-[#16A34A]" />
                        <span className="text-[14px] text-[#0D1B2A]">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGetStarted(plan.plan, plan.name)}
                    disabled={isLoading || subscribingTo === plan.name}
                    className={cn(buttonClass("primary"), "mt-7 flex w-full")}
                  >
                    {subscribingTo === plan.name && isLoading
                      ? "Processing..."
                      : plan.plan === "starter"
                        ? "Start Free"
                        : "Subscribe now"}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 hidden gap-6 lg:grid lg:grid-cols-3"
        >
          {pricingPlans.map((plan, i) => {
            const catalogEntry = pricingCatalog?.[plan.plan] ?? subscriptionCatalog[plan.plan];

            return (
              <motion.article
                key={plan.name}
                variants={fadeUp}
                custom={i}
                className="relative rounded-[16px] border border-[#E8E4DF] border-t-[3px] border-t-[#0D1B2A] bg-white p-8"
              >
                <div>
                  <p className="text-[20px] font-semibold text-[#0D1B2A]">{plan.name}</p>
                  <p className="mt-4 text-[52px] font-black leading-none tracking-[-0.02em] text-[#0D1B2A] md:text-[56px]">{catalogEntry.priceLabel}</p>
                  <p className="mt-3 text-[16px] leading-[1.7] text-[#4A5568]">{catalogEntry.description}</p>
                  <div className="my-8 border-t border-[#E8E4DF]" />
                  <div className="space-y-4">
                    {catalogEntry.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-[#16A34A]" />
                        <span className="text-[16px] text-[#0D1B2A]">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGetStarted(plan.plan, plan.name)}
                    disabled={isLoading || subscribingTo === plan.name}
                    className={cn(buttonClass("primary"), "mt-8 flex w-full")}
                  >
                    {subscribingTo === plan.name && isLoading
                      ? "Processing..."
                      : plan.plan === "starter"
                        ? "Start Free"
                        : "Subscribe now"}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
