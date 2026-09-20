import { CheckCircle2, Database, MessageSquare, Shield, Users } from "lucide-react";
import { motion } from "framer-motion";
import PublicPageShell, { publicFadeUp } from "@/components/public/PublicPageShell";

const VendorManagementPage = () => (
  <PublicPageShell
    eyebrow="Features"
    title="Centralized vendor management for growing teams."
    description="Keep all vendor information in one place. Track payment terms, contact details, and transaction history. No more spreadsheets or scattered emails."
    highlights={[
      { label: "Vendor limit", value: "Unlimited" },
      { label: "Custom fields", value: "5+" },
      { label: "Payment history", value: "Complete" },
    ]}
    cta={{ label: "Get started free", to: "/register" }}
    accent={
      <div className="rounded-[30px] border border-[#DCE2F2] bg-[#10203F] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
            <Users size={22} className="text-[#D7E3FF]" />
            <p className="mt-4 text-lg font-bold">One central hub</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/70">All vendor information in one place. No more hunting through emails or spreadsheets.</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
            <Database size={22} className="text-[#D7E3FF]" />
            <p className="mt-4 text-lg font-bold">Smart organization</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/70">Organize vendors by category, tier, or custom field. Find what you need in seconds.</p>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] bg-[#D7E3FF] px-5 py-4 text-[#10203F]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4154D8]">Pro tip</p>
          <p className="mt-1 text-sm font-medium">Tag vendors by service type, location, or priority so you can quickly filter and manage them.</p>
        </div>
      </div>
    }
    aside={
      <>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-white p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
          <Shield size={22} className="text-[#4154D8]" />
          <p className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#10203F]">Privacy and permissions.</p>
          <p className="mt-2 text-sm leading-[1.75] text-[#5F6A88]">
            Control who on your team can view, edit, or delete vendor information. Perfect for multi-team organizations.
          </p>
        </div>
      </>
    }
  >
    <motion.section initial="hidden" animate="visible">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Features</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Manage vendors like a pro.</h2>
      </motion.div>
      <div className="mt-8 space-y-5">
        {[
          {
            icon: Users,
            title: "Vendor Profiles",
            description: "Complete vendor information: contact details, bank account, tax ID, website, and custom notes.",
          },
          {
            icon: Database,
            title: "Unlimited Vendors",
            description: "Add as many vendors as you need. No limits. Unlimited custom fields for special requirements.",
          },
          {
            icon: MessageSquare,
            title: "Communication History",
            description: "Keep track of emails, calls, and notes with each vendor. Never lose important context.",
          },
          {
            icon: CheckCircle2,
            title: "Payment Term Management",
            description: "Store payment terms, discount codes, and invoice schedules for each vendor.",
          },
          {
            icon: Shield,
            title: "Team Permissions",
            description: "Assign roles and permissions. Control who can view, edit, or delete vendor information.",
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
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Getting started</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Set up vendor management in minutes.</h2>
      </motion.div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          {
            step: "1",
            title: "Add vendors",
            description: "Enter vendor name, contact, and payment details.",
          },
          {
            step: "2",
            title: "Organize",
            description: "Add tags, categories, and custom fields to suit your business.",
          },
          {
            step: "3",
            title: "Collaborate",
            description: "Invite team members and assign permissions to maintain order.",
          },
        ].map((item, index) => (
          <motion.div
            key={item.step}
            variants={publicFadeUp}
            custom={index + 1}
            className="rounded-[20px] border border-[#E6EAF6] bg-white p-8 text-center"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#5B67F7] text-xl font-black text-white">
              {item.step}
            </div>
            <h3 className="mt-4 text-lg font-bold tracking-[-0.01em] text-[#10203F]">{item.title}</h3>
            <p className="mt-2 text-sm leading-[1.7] text-[#5F6A88]">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </motion.section>

    <motion.section initial="hidden" animate="visible" className="mt-16">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Who benefits</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Perfect for teams with multiple vendors.</h2>
      </motion.div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {[
          {
            title: "Operations Teams",
            description: "Manage procurement, track vendor performance, and maintain relationships efficiently.",
          },
          {
            title: "Finance Teams",
            description: "Centralize vendor information for approvals, audits, and compliance tracking.",
          },
          {
            title: "Growing Businesses",
            description: "Scale your vendor management as you grow. No spreadsheet chaos.",
          },
          {
            title: "Enterprises",
            description: "Multi-vendor strategies with team collaboration and granular permission controls.",
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

export default VendorManagementPage;
