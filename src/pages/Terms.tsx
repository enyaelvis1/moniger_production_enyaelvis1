import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { termsDocument } from "@/lib/legal-documents";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

const TermsPage = () => (
  <div className="min-h-screen bg-[#F3F4FB]">
    <div className="mx-auto max-w-[800px] px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-2 text-sm text-[#4154D8] hover:underline mb-8">
        <ArrowLeft size={16} /> Back to home
      </Link>

      <motion.div initial="hidden" animate="visible">
        <motion.h1 variants={fadeUp} custom={0} className="text-4xl font-black text-[#0D1B2A] tracking-tight">
          {termsDocument.title}
        </motion.h1>
        <motion.p variants={fadeUp} custom={1} className="mt-4 text-sm text-[#94A3B8]">
          {termsDocument.updatedAt}
        </motion.p>

        <div className="mt-10 space-y-6">
          {termsDocument.sections.map((s, i) => (
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
