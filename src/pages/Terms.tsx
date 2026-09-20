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
  { title: "Acceptance of Terms", content: "By accessing and using moniger.net, you agree to be bound by these Terms of Service. If you do not agree, please do not use our platform." },
  { title: "Description of Service", content: "moniger.net provides a cloud-based financial management platform including invoicing, bill payments, vendor management, and financial reporting. We are not a licensed financial institution - payment processing is provided by supported third-party providers, including Paystack." },
  { title: "Account Responsibilities", content: "You are responsible for maintaining the confidentiality of your account credentials. You must notify us immediately of any unauthorized access. You must provide accurate and complete information during registration." },
  { title: "Acceptable Use", content: "You agree not to use moniger.net for any illegal activities, money laundering, or fraud. You must comply with all applicable Nigerian laws and regulations, including AML/KYC requirements." },
  { title: "Payment Terms", content: "Our Starter plan is free and activates without paid checkout. Growth and Business require a successful Paystack recurring checkout before the paid subscription becomes active. We do not currently advertise a paid-plan trial. Paid plans are billed monthly or annually in Nigerian Naira (NGN) unless otherwise stated. Cancellation, failed-payment handling, and refunds are subject to the applicable subscription terms and support review." },
  { title: "Data Ownership", content: "You retain ownership of all data you upload to moniger.net. We do not claim any intellectual property rights over your content. You grant us a limited license to process your data as needed to provide our services." },
  { title: "Limitation of Liability", content: "moniger.net is provided 'as is' without warranties. We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform." },
  { title: "Termination", content: "We may suspend or terminate your account if you violate these terms. You may close your account at any time through Settings. Upon termination, your data will be retained for 30 days before deletion." },
  { title: "Governing Law", content: "These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in the courts of Lagos State." },
];

const TermsPage = () => (
  <div className="min-h-screen bg-[#F3F4FB]">
    <div className="mx-auto max-w-[800px] px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#4154D8] hover:underline mb-8">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} custom={0} className="text-4xl font-black text-[#0D1B2A] tracking-tight">
          Terms of Service
        </motion.h1>
        <motion.p variants={fadeUp} custom={1} className="mt-4 text-sm text-[#94A3B8]">
          Last updated: March 2026
        </motion.p>

        <div className="mt-10 space-y-6">
          {sections.map((s, i) => (
            <motion.div key={s.title} variants={fadeUp} custom={i + 2} className="rounded-2xl border border-[#E0DFF0] bg-white p-6">
              <h2 className="text-lg font-semibold text-[#0D1B2A]">{s.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#64748B]">{s.content}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  </div>
);

export default TermsPage;
