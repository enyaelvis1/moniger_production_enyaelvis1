import { Clock3, Headphones, Mail, MessageSquare, PhoneCall, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import PublicPageShell, { PublicInfoCard, publicFadeUp } from "@/components/public/PublicPageShell";

const supportChannels = [
  {
    icon: Mail,
    title: "Email Support",
    description: "Best for billing questions, onboarding help, and account follow-up that needs context and screenshots.",
  },
  {
    icon: MessageSquare,
    title: "Product Questions",
    description: "Use this path when you need help understanding a workflow like approvals, invoices, or payment links.",
  },
  {
    icon: ShieldAlert,
    title: "Urgent Security Reports",
    description: "Escalate suspicious activity, access concerns, or account-protection issues immediately.",
  },
];

const SupportPage = () => (
  <PublicPageShell
    eyebrow="Support"
    title="Support that moves problems forward."
    description="We designed support around real business urgency. Whether you need a quick clarification or a higher-touch handoff, the right route is clear from the start."
    highlights={[
      { label: "Response window", value: "<24 hrs" },
      { label: "Support paths", value: "3" },
      { label: "Security escalation", value: "Priority" },
    ]}
    cta={{ label: "Open workspace", to: "/login" }}
    accent={
      <div className="rounded-[30px] border border-[#DCE2F2] bg-white p-6 shadow-[0_28px_80px_rgba(16,32,63,0.14)]">
        <div className="rounded-[24px] bg-[linear-gradient(160deg,#10203F_0%,#1B325C_100%)] p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Headphones size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/55">Support desk</p>
              <p className="text-lg font-bold">How we triage incoming requests</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[
              "Access and security issues go first",
              "Payment and billing issues stay prioritized",
              "How-to guidance is grouped by workflow",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    }
    aside={
      <>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-white p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#66718E]">Direct contact</p>
          <div className="mt-5 space-y-4 text-sm text-[#5F6A88]">
            <div className="flex items-start gap-3 rounded-2xl bg-[#F6F8FF] px-4 py-4">
              <Mail size={18} className="mt-0.5 text-[#4154D8]" />
              <div>
                <p className="font-semibold text-[#10203F]">admin@moniger.net</p>
                <p className="mt-1">For general support and onboarding help.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#F6F8FF] px-4 py-4">
              <PhoneCall size={18} className="mt-0.5 text-[#4154D8]" />
              <div>
                <p className="font-semibold text-[#10203F]">+234 913 170 1391</p>
                <p className="mt-1">For urgent business-critical follow-up.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-[#FFF7ED] p-6">
          <Clock3 size={22} className="text-[#C46A14]" />
          <p className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#10203F]">Fastest route to resolution</p>
          <p className="mt-2 text-sm leading-[1.75] text-[#6C5A41]">
            Include your workspace email, the page you were on, and what outcome you expected. That usually removes one full back-and-forth.
          </p>
        </div>
      </>
    }
  >
    <motion.section initial="hidden" animate="visible">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Choose your route</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Pick the channel that matches the issue.</h2>
      </motion.div>
      <div className="mt-8 grid gap-5">
        {supportChannels.map((item, index) => (
          <motion.div key={item.title} variants={publicFadeUp} custom={index + 1}>
            <PublicInfoCard {...item} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  </PublicPageShell>
);

export default SupportPage;
