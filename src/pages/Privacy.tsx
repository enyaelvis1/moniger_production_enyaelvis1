import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const sections = [
  { title: "Information We Collect", content: "We collect information you provide directly, including your name, email address, business information, and financial data necessary to provide our services. We also collect usage data and device information automatically." },
  { title: "How We Use Your Information", content: "We use your information to provide and improve our services, process transactions, send notifications, and ensure the security of your account. We never sell your personal data to third parties." },
  { title: "Data Security", content: "We use security controls including encrypted connections, access boundaries, and multi-factor authentication support to protect your data. Sensitive financial workflows are handled through server-side verification and audited operations." },
  { title: "NDPR Compliance", content: "As a Nigerian platform, we fully comply with the Nigeria Data Protection Regulation (NDPR). You have the right to access, correct, and delete your personal data at any time." },
  { title: "Data Retention", content: "We retain your data for as long as your account is active. Upon account deletion, we remove your personal data within 30 days, except where retention is required by Nigerian financial regulations." },
  { title: "Cookies", content: "We use essential cookies for authentication and session management. We do not use third-party tracking cookies. You can manage cookie preferences in your browser settings." },
  { title: "Changes to This Policy", content: "We may update this policy from time to time. We will notify you of any material changes via email or in-app notification." },
  { title: "Contact Us", content: "If you have questions about this privacy policy, contact us at hello@moniger.net or +234 913 170 1391." },
];

const PrivacyPage = () => (
  <div className="min-h-screen bg-[#F3F4FB]">
    <div className="mx-auto max-w-[800px] px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#4154D8] hover:underline mb-8">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} custom={0} className="text-4xl font-black text-[#0D1B2A] tracking-tight">
          Privacy Policy
        </motion.h1>
        <motion.p variants={fadeUp} custom={1} className="mt-4 text-sm text-[#94A3B8]">
          Last updated: March 2026
        </motion.p>
        <motion.p variants={fadeUp} custom={2} className="mt-4 text-base leading-relaxed text-[#64748B]">
          At moniger.net, we take your privacy seriously. This policy describes how we collect, use, and protect your personal information.
        </motion.p>

        <div className="mt-10 space-y-6">
          {sections.map((s, i) => (
            <motion.div key={s.title} variants={fadeUp} custom={i + 3} className="rounded-2xl border border-[#E0DFF0] bg-white p-6">
              <h2 className="text-lg font-semibold text-[#0D1B2A]">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">{s.content}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </div>
);

export default PrivacyPage;
