import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { containerClass } from "./landing-shared";

interface TestimonialCard {
  quote: string;
  author: string;
  title: string;
  initials: string;
}

const testimonialCards: TestimonialCard[] = [
  {
    quote: "moniger.net changed how we handle vendor payments completely. What used to take us hours on spreadsheets now takes minutes.",
    author: "Taiwo A.",
    title: "Operations Manager",
    initials: "TA",
  },
  {
    quote: "The audit trail alone is worth it. Our accountant now reviews everything in one place without calling me every week.",
    author: "Chioma O.",
    title: "Business Owner",
    initials: "CO",
  },
  {
    quote: "I send invoices in under 2 minutes now. The payment link feature means clients pay faster too.",
    author: "Emeka D.",
    title: "Freelance Consultant",
    initials: "ED",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.15, ease: [0.22, 1, 0.36, 1] },
  }),
};

const TestimonialsSection = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);

  return (
    <section
      ref={ref}
      className="landing-peel-section relative z-[6] overflow-hidden bg-[#F3F4FB] px-6 py-16 md:px-10 lg:px-12 lg:py-[100px]"
    >
      <span className="landing-peek-label z-[6] border border-[#D8DDF0] bg-[#F3F4FB] text-[#677391]">
        WHAT BUSINESSES SAY
      </span>

      <motion.div style={{ y: bgY }} className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#F0EDE8]/40 to-transparent" />
      
      <div className={containerClass + " relative z-10"}>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          className="mx-auto max-w-[720px] text-center"
        >
          <motion.h2 variants={fadeUp} custom={0} className="whitespace-pre-line text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#0D1B2A] sm:text-[40px] md:text-[48px]">
            {"Loved by businesses\nacross Nigeria"}
          </motion.h2>
        </motion.div>

        {/* Mobile: horizontal carousel with infinite scroll */}
        <div
          className="mt-10 lg:hidden overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, black 12%, black 88%, transparent 100%)",
          }}
        >
          <div className="testimonials-carousel flex w-max items-stretch gap-5">
            {[...testimonialCards, ...testimonialCards, ...testimonialCards].map(
              (card, index) => (
                <article
                  key={`${card.author}-${index}`}
                  className="testimonial-card shrink-0 w-[300px] rounded-[16px] border border-[#E8E4DF] bg-white p-7"
                >
                  <span className="block text-[48px] font-black leading-[0.8] text-[#E8E4DF]">&quot;</span>
                  <p className="mt-3 text-[16px] leading-[1.65] text-[#0D1B2A]">{card.quote}</p>
                  <div className="mt-5 border-t border-[#F0EDE8] pt-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0D1B2A] text-[14px] font-bold text-white">
                        {card.initials}
                      </span>
                      <div>
                        <p className="text-[14px] font-bold text-[#0D1B2A]">{card.author}</p>
                        <p className="mt-0.5 text-[12px] text-[#4A5568]">{card.title}</p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        </div>

        {/* Desktop: grid with stagger */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="mt-14 hidden gap-6 lg:grid lg:grid-cols-3"
        >
          {testimonialCards.map((card, i) => (
            <motion.article
              key={card.author}
              variants={fadeUp}
              custom={i}
              className="rounded-[16px] border border-[#E8E4DF] bg-white p-9"
            >
              <span className="block text-[64px] font-black leading-[0.8] text-[#E8E4DF]">&quot;</span>
              <p className="mt-4 text-[18px] leading-[1.65] text-[#0D1B2A]">{card.quote}</p>
              <div className="mt-7 border-t border-[#F0EDE8] pt-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0D1B2A] text-[14px] font-bold text-white">
                    {card.initials}
                  </span>
                  <div>
                    <p className="text-[15px] font-bold text-[#0D1B2A]">{card.author}</p>
                    <p className="mt-0.5 text-[13px] text-[#4A5568]">{card.title}</p>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
