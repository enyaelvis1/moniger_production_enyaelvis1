import { motion } from "framer-motion";
const stats = [
  { value: "3", label: "Workspace plans" },
  { value: "2", label: "Paid tiers" },
  { value: "4", label: "Core finance workflows" },
  { value: "0", label: "Cards needed for Starter" },
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

const StatsProofSection = () => (
  <section className="landing-peel-section z-[3] bg-[#F3F4FB] px-3 py-[80px] sm:px-4 lg:px-6">
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="mx-auto max-w-[1160px] rounded-[24px] border border-[#E8E4DF] bg-white px-5 py-8 shadow-[0_2px_24px_rgba(0,0,0,0.06)] sm:px-8 sm:py-10 lg:px-16 lg:py-16"
    >
      <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:gap-12">
        <div>
          <motion.span
            variants={fadeUp}
            custom={0}
            className="mb-5 inline-block rounded-full border border-[#E8E4DF] px-[14px] py-1 text-[12px] font-semibold tracking-[0.06em] text-[#4A5568]"
          >
            EARLY RESULTS
          </motion.span>

          <motion.h2
            variants={fadeUp}
            custom={1}
            className="mb-10 max-w-[520px] whitespace-pre-line text-[32px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#0D1B2A] md:text-[36px]"
          >
            {"Businesses that switch\nnever go back to spreadsheets."}
          </motion.h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-6 sm:gap-x-10">
            {stats.map((stat, index) => (
              <motion.div key={stat.label} variants={fadeUp} custom={index + 2}>
                <p className="text-[36px] font-extrabold leading-none tracking-[-0.02em] text-[#1A3C5E] sm:text-[40px] lg:text-[48px]">
                  {stat.value}
                </p>
                <p className="mt-1 text-[14px] font-normal text-[#64748B]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div variants={fadeUp} custom={6} className="h-full">
          <article className="flex h-full flex-col justify-between rounded-[16px] bg-[#EAECF8] p-9 max-sm:p-7">
            <div className="mb-6 border-l-[3px] border-[#1A3C5E] pl-5">
              <span className="mb-3 block text-[48px] font-black leading-[0.8] text-[#D4D0CB]">&quot;</span>
              <p className="text-[18px] leading-[1.65] text-[#0D1B2A]">
                We tried three different tools before moniger.net. This is the first one our
                accountant didn&apos;t complain about by week two.
              </p>
            </div>

            <div className="mt-7 flex items-center gap-3 border-t border-[#E8E4DF] pt-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1A3C5E] text-[14px] font-bold text-white">
                CA
              </span>
              <div>
                <span className="block text-[15px] font-semibold text-[#0D1B2A]">Chidi Adeyemi</span>
                <span className="mt-0.5 block text-[13px] text-[#64748B]">
                  Finance Manager, Lagos
                </span>
              </div>
            </div>
          </article>
        </motion.div>
      </div>
    </motion.div>
  </section>
);

export default StatsProofSection;
