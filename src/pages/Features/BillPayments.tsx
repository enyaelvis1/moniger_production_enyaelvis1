import { CheckCircle2, CreditCard, Shield, TrendingUp, Zap } from "lucide-react";
import { motion } from "framer-motion";
import PublicPageShell, { publicFadeUp } from "@/components/public/PublicPageShell";

const BillPaymentsPage = () => (
  <PublicPageShell
    eyebrow="Features"
    title="Smart bill payments designed for Nigerian businesses."
    description="Pay vendors directly from your moniger.net dashboard. Keep tabs on spending, approve payments, and maintain a complete audit trail of all transactions."
    highlights={[
      { label: "Payment methods", value: "5+" },
      { label: "Approval workflows", value: "Optional" },
      { label: "Audit trail", value: "Complete" },
    ]}
    cta={{ label: "Get started free", to: "/register" }}
    accent={
      <div className="rounded-[30px] border border-[#DCE2F2] bg-[#10203F] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
            <Zap size={22} className="text-[#D7E3FF]" />
            <p className="mt-4 text-lg font-bold">Pay in seconds</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/70">Initiate payments to vendors from a single dashboard. No more back-and-forth emails.</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
            <TrendingUp size={22} className="text-[#D7E3FF]" />
            <p className="mt-4 text-lg font-bold">Control spending</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/70">Set budgets, require approvals, and see exactly where your money goes.</p>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] bg-[#D7E3FF] px-5 py-4 text-[#10203F]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4154D8]">Pro tip</p>
          <p className="mt-1 text-sm font-medium">Set up payment approval workflows so multiple team members must sign off on large payments.</p>
        </div>
      </div>
    }
    aside={
      <>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-white p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
          <Shield size={22} className="text-[#4154D8]" />
          <p className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#10203F]">Secure payment processing.</p>
          <p className="mt-2 text-sm leading-[1.75] text-[#5F6A88]">
            All payments are encrypted and processed through trusted partners like Stripe and Paystack. Your money stays safe.
          </p>
        </div>
      </>
    }
  >
    <motion.section initial="hidden" animate="visible">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Features</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Pay vendors smarter. Spend wisely.</h2>
      </motion.div>
      <div className="mt-8 space-y-5">
        {[
          {
            icon: CreditCard,
            title: "Multiple Payment Methods",
            description: "Pay via bank transfer, card, or mobile money. Support for major Nigerian banks and services.",
          },
          {
            icon: Zap,
            title: "Instant Payment Processing",
            description: "Payments go through in seconds to minutes, not days. Your vendors get paid fast.",
          },
          {
            icon: CheckCircle2,
            title: "Approval Workflows",
            description: "Set approval rules. Finance managers review payments before they go out.",
          },
          {
            icon: TrendingUp,
            title: "Budget Management",
            description: "Set spending limits by department or vendor. Get alerts when approaching budget caps.",
          },
          {
            icon: Shield,
            title: "Complete Audit Trail",
            description: "Every payment is logged with who approved it, when, and why. Perfect for compliance.",
          },
        ].map((feature, index) => (
          <motion.div
            key={feature.title}
            variants={publicFadeUp}
            custom={index + 1}
            className="flex gap-6 rounded-[20px] border border-[#E6EAF6] bg-white p-6 shadow-[0_8px_24px_rgba(16,32,63,0.04)]"
          >
            <div className="mt-1 shrink-0">
              <feature.icon size={24} className="text-[#5B67F7]" />
            </div>
            <div>
              <h3 className="text-lg font-bold tracking-[-0.01em] text-[#10203F]">{feature.title}</h3>
              <p className="mt-2 text-sm leading-[1.7] text-[#5F6A88]">{feature.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>

    <motion.section initial="hidden" animate="visible" className="mt-16">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Use cases</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Built for every business scenario.</h2>
      </motion.div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {[
          {
            title: "Service Providers",
            description: "Pay contractors, freelancers, and service providers instantly. No more cash advances or manual transfers.",
          },
          {
            title: "E-Commerce",
            description: "Pay suppliers and logistics partners on time. Maintain strong relationships with fast, reliable payments.",
          },
          {
            title: "Agency & Creative",
            description: "Manage payments to vendors, freelancers, and production partners from one place.",
          },
          {
            title: "Enterprises",
            description: "Enterprise-grade approval workflows with multi-level sign-offs and spending controls.",
          },
        ].map((item, index) => (
          <motion.div
            key={item.title}
            variants={publicFadeUp}
            custom={index + 1}
            className="rounded-[20px] border border-[#E6EAF6] bg-white p-8"
          >
            <h3 className="text-lg font-bold tracking-[-0.01em] text-[#10203F]">{item.title}</h3>
            <p className="mt-2 text-sm leading-[1.7] text-[#5F6A88]">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>
  </PublicPageShell>
);

export default BillPaymentsPage;
