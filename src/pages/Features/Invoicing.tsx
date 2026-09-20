import { CheckCircle2, Clock, FileText, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import PublicPageShell, { publicFadeUp } from "@/components/public/PublicPageShell";

const InvoicingPage = () => (
  <PublicPageShell
    eyebrow="Features"
    title="Professional invoicing built for speed and clarity."
    description="Create, customize, and send invoices in seconds. Automatic payment reminders, late fees, and real-time tracking keep you on top of every naira."
    highlights={[
      { label: "Setup time", value: "<1 min" },
      { label: "Invoice templates", value: "5 included" },
      { label: "Automatic reminders", value: "Yes" },
    ]}
    cta={{ label: "Get started free", to: "/register" }}
    accent={
      <div className="rounded-[30px] border border-[#DCE2F2] bg-[#10203F] p-6 text-white shadow-[0_28px_80px_rgba(16,32,63,0.18)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
            <Zap size={22} className="text-[#D7E3FF]" />
            <p className="mt-4 text-lg font-bold">Send in seconds</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/70">Create professional invoices from a template and send instantly to your clients.</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
            <Clock size={22} className="text-[#D7E3FF]" />
            <p className="mt-4 text-lg font-bold">Never miss payment</p>
            <p className="mt-2 text-sm leading-[1.7] text-white/70">Set automatic reminders for overdue invoices and track payment status in real-time.</p>
          </div>
        </div>
        <div className="mt-4 rounded-[22px] bg-[#D7E3FF] px-5 py-4 text-[#10203F]">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4154D8]">Pro tip</p>
          <p className="mt-1 text-sm font-medium">Customize your invoice with your logo, colors, and payment terms for a professional look.</p>
        </div>
      </div>
    }
    aside={
      <>
        <div className="rounded-[24px] border border-[#DCE2F2] bg-white p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)]">
          <Shield size={22} className="text-[#4154D8]" />
          <p className="mt-4 text-lg font-bold tracking-[-0.02em] text-[#10203F]">Bank-grade security built in.</p>
          <p className="mt-2 text-sm leading-[1.75] text-[#5F6A88]">
            Every invoice is encrypted and stored securely. You control who sees what, and audit trails capture every action.
          </p>
        </div>
      </>
    }
  >
    <motion.section initial="hidden" animate="visible">
      <motion.div variants={publicFadeUp} custom={0}>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Features</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Everything you need to get paid on time.</h2>
      </motion.div>
      <div className="mt-8 space-y-5">
        {[
          {
            icon: FileText,
            title: "Professional Templates",
            description: "5 professionally designed invoice templates. Customize with your branding, payment terms, and due dates.",
          },
          {
            icon: Clock,
            title: "Automatic Reminders",
            description: "Set automatic payment reminders. Clients get gentle nudges before and after payment is due.",
          },
          {
            icon: Zap,
            title: "Instant Delivery",
            description: "Send invoices directly from moniger.net or via email. Recipients get a secure payment link.",
          },
          {
            icon: Shield,
            title: "Payment Tracking",
            description: "Know exactly when invoices are viewed and paid. Real-time notifications keep you informed.",
          },
          {
            icon: CheckCircle2,
            title: "Late Fee Configuration",
            description: "Set up automatic late fees and penalties. Apply them only when truly needed.",
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
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#66718E]">Get started</p>
        <h2 className="mt-3 text-[30px] font-black tracking-[-0.03em] text-[#10203F]">Three steps to your first invoice.</h2>
      </motion.div>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {[
          {
            step: "1",
            title: "Sign up",
            description: "Create your account in under 2 minutes. No credit card required.",
          },
          {
            step: "2",
            title: "Add client",
            description: "Add your first client's details—name, email, and invoice preferences.",
          },
          {
            step: "3",
            title: "Send invoice",
            description: "Select a template, add items, and send. Your client gets a payment link.",
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
  </PublicPageShell>
);

export default InvoicingPage;
