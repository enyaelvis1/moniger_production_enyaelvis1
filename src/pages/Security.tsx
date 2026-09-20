import { Eye, KeyRound, Lock, ScanSearch, Shield, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import PublicPageShell, { PublicInfoCard, publicFadeUp } from "@/components/public/PublicPageShell";

const controls = [
  {
    icon: Lock,
    title: "Bank-grade transport security",
    description: "Sensitive data is protected in transit, with secure handling built into the product foundation.",
  },
  {
    icon: KeyRound,
    title: "Stronger sign-in controls",
    description: "Multi-factor authentication and recovery paths reduce the risk of weak or compromised access.",
  },
  {
    icon: Eye,
    title: "Role-aware workspace access",
    description: "Owners, admins, and accountants can be scoped around the jobs they actually need to do.",
  },
  {
    icon: ScanSearch,
    title: "Audit visibility",
    description: "Every critical action can be reviewed later, helping teams explain who changed what and when.",
  },
];

const SecurityPage = () => (
  <PublicPageShell
    eyebrow="Security"
    title="Controls your finance team can actually trust."
    description="Security on moniger.net is not decorative copy. It is meant to support approvals, access boundaries, payment confidence, and clean audit visibility for real businesses."
    highlights={[
      { label: "MFA support", value: "Yes" },
      { label: "Audit visibility", value: "End-to-end" },
      { label: "Approvals model", value: "Role-based" },
    ]}
    cta={{ label: "Explore the workspace", to: "/register" }}
    accent={
      <div className="rounded-[30px] border border-[#DCE2F2] bg-[linear-gradient(160deg,#0D1B2A_0%,#183050_100%)] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
              <Shield size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-white/55">Security posture</p>
              <p className="text-lg font-bold">Built for visibility, not guesswork.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3">
            {[
              "Role-scoped access for team members",
              "Approval checkpoints before money moves",
              "Auditable activity history for operational review",
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/86">
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
          <ShieldCheck size={22} className="text-[#4154D8]" />
          <p className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#10203F]">What this page communicates</p>
          <p className="mt-2 text-sm leading-[1.75] text-[#5F6A88]">
            This route now gives the landing experience a real destination for security-minded buyers instead of only a homepage section anchor.
          </p>
        </div>
      </>
    }
  >
    <motion.section initial="hidden" animate="visible">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Core protection areas</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Security language should map to actual operational controls.</h2>
      </motion.div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {controls.map((item, index) => (
          <motion.div key={item.title} variants={publicFadeUp} custom={index + 1}>
            <PublicInfoCard {...item} />
          </motion.div>
        ))}
      </div>
    </motion.section>
  </PublicPageShell>
);

export default SecurityPage;
