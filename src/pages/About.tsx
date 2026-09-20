import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Globe, Users, Target } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] },
  }),
};

const values = [
  { icon: Shield, title: "Security First", desc: "Access controls, server-side verification, and audit visibility support safer finance operations." },
  { icon: Globe, title: "Built for Nigeria", desc: "Designed for Nigerian businesses with local workflows and Paystack payment integrations." },
  { icon: Users, title: "Customer Obsessed", desc: "Every feature is built from real feedback from Nigerian business owners." },
  { icon: Target, title: "Simplicity", desc: "Complex financial workflows made intuitive — no accounting degree required." },
];

const AboutPage = () => (
  <div className="min-h-screen bg-[#F3F4FB]">
    <div className="mx-auto max-w-[800px] px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#4154D8] hover:underline mb-8">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} custom={0} className="text-4xl font-black text-[#0D1B2A] tracking-tight">
          About moniger.net
        </motion.h1>
        <motion.p variants={fadeUp} custom={1} className="mt-4 text-lg leading-relaxed text-[#64748B]">
          moniger.net is a financial management platform built specifically for Nigerian businesses. We help companies manage invoices, bills, payments, and cash flow — all in one place, with practical security controls.
        </motion.p>

        <motion.h2 variants={fadeUp} custom={2} className="mt-12 text-2xl font-bold text-[#0D1B2A]">
          Our Mission
        </motion.h2>
        <motion.p variants={fadeUp} custom={3} className="mt-3 text-base leading-relaxed text-[#64748B]">
          To give every Nigerian business financial clarity and control, eliminating the chaos of spreadsheets, manual reconciliation, and fragmented payment systems.
        </motion.p>

        <motion.h2 variants={fadeUp} custom={4} className="mt-12 text-2xl font-bold text-[#0D1B2A]">
          Our Values
        </motion.h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {values.map((v, i) => (
            <motion.div key={v.title} variants={fadeUp} custom={i + 5} className="rounded-2xl border border-[#E0DFF0] bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEEDF8]">
                <v.icon size={20} className="text-[#5B67F7]" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[#0D1B2A]">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{v.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div variants={fadeUp} custom={9} className="mt-12 rounded-2xl bg-gradient-to-br from-[#5B67F7] to-[#4A56E0] p-8 text-white">
          <h3 className="text-xl font-bold">Want to learn more?</h3>
          <p className="mt-2 text-sm text-white/70">Get in touch with our team — we'd love to hear from you.</p>
          <Link to="/contact" className="mt-4 inline-flex items-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-[#5B67F7]">
            Contact Us
          </Link>
        </motion.div>
      </motion.div>
    </div>
  </div>
);

export default AboutPage;
