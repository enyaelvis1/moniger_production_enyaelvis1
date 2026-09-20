import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  AnimatedStatValue,
  NAIRA,
  StatusPill,
  ToggleSwitch,
  containerClass,
} from "./landing-shared";

const darkStats = [
  { value: 3, prefix: "", suffix: "", decimals: 0, label: "Workspace plans" },
  { value: 2, prefix: "", suffix: "", decimals: 0, label: "Paid tiers" },
  { value: 4, prefix: "", suffix: "", decimals: 0, label: "Core finance workflows" },
  { value: 0, prefix: "", suffix: "", decimals: 0, label: "Cards needed for Starter" },
] as const;

const approvalBullets = [
  "Multi-level payment approvals",
  "Role-based team access (Owner, Admin, Accountant)",
  "Full immutable audit trail",
] as const;

const showcaseTopClasses = [
  "top-[72px] md:top-[80px]",
  "top-[88px] md:top-[96px]",
  "top-[104px] md:top-[112px]",
] as const;

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

const ShowcaseArrows = () => (
  <div aria-hidden="true" className="mt-6 flex items-center gap-2">
    {[ArrowLeft, ArrowRight].map((Icon, index) => (
      <span
        key={index}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[1.5px] border-[#D4D0CB] text-[#4A5568] transition-colors duration-200 hover:border-[#0D1B2A] hover:text-[#0D1B2A]"
      >
        <Icon size={16} />
      </span>
    ))}
  </div>
);

const ShowcaseFeature = ({ children }: { children: string }) => (
  <div className="flex items-center gap-3">
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#1A3C5E] text-[11px] font-semibold text-white">
      <Check size={11} />
    </span>
    <span className="text-[15px] font-medium text-[#0D1B2A]">{children}</span>
  </div>
);

const ShowcaseLink = ({ children }: { children: string }) => (
  <Link
    to="/register"
    className="group mt-9 inline-flex items-center gap-1.5 text-[15px] font-semibold text-[#1A3C5E]"
  >
    <span>{children}</span>
    <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-1" />
  </Link>
);

const useActiveFeatureCard = (cardCount: number) => {
  const [activeFeatureCard, setActiveFeatureCard] = useState<number | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || typeof window === "undefined") {
      setActiveFeatureCard(null);
      return undefined;
    }

    if (!("IntersectionObserver" in window)) {
      return undefined;
    }

    const ratios = new Map<number, number>();
    let frameId = 0;

    const syncActiveCard = () => {
      frameId = 0;

      const activeEntries = [...ratios.entries()].filter(([, ratio]) => ratio >= 0.8);
      if (activeEntries.length > 0) {
        setActiveFeatureCard(Math.max(...activeEntries.map(([index]) => index)));
        return;
      }

      const visibleEntries = [...ratios.entries()].filter(([, ratio]) => ratio > 0.2);
      setActiveFeatureCard(
        visibleEntries.length > 0
          ? Math.max(...visibleEntries.map(([index]) => index))
          : null,
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
        }

        frameId = window.requestAnimationFrame(() => {
          entries.forEach((entry) => {
            const index = Number((entry.target as HTMLElement).dataset.cardIndex);

            if (!entry.isIntersecting && entry.intersectionRatio === 0) {
              ratios.delete(index);
            } else {
              ratios.set(index, entry.intersectionRatio);
            }
          });

          syncActiveCard();
        });
      },
      { threshold: [0, 0.2, 0.8, 1] },
    );

    cardRefs.current.slice(0, cardCount).forEach((card) => {
      if (card) observer.observe(card);
    });
    return () => {
      observer.disconnect();

      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [cardCount, prefersReducedMotion]);

  return { activeFeatureCard, cardRefs, prefersReducedMotion };
};

const FeatureShowcaseCards = () => {
  const { activeFeatureCard, cardRefs, prefersReducedMotion } = useActiveFeatureCard(3);

  const getCardClassName = (index: number) =>
    cn(
      "feature-card sticky overflow-hidden rounded-[24px] border border-[#E8E4DF] min-h-[600px] md:min-h-[500px]",
      showcaseTopClasses[index],
      !prefersReducedMotion && activeFeatureCard === index && "is-active",
      !prefersReducedMotion &&
        activeFeatureCard !== null &&
        index < activeFeatureCard &&
        "is-behind",
    );

  return (
    <div className="feature-stack mt-10 space-y-4 md:space-y-0">
      <motion.article
        ref={(node) => {
          cardRefs.current[0] = node;
        }}
        data-card-index={0}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className={cn(getCardClassName(0), "bg-[#EBF5FF]")}
      >
        <div className="grid h-full lg:grid-cols-[1fr_0.95fr]">
          <div className="px-6 py-8 sm:px-8 md:px-6 md:py-8 lg:px-[56px] lg:py-[56px]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-[#2980B9]">
              ACCOUNTS RECEIVABLE
            </p>
            <h2 className="mt-4 whitespace-pre-line text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0D1B2A] sm:text-[36px] lg:text-[40px]">
              {"Get paid faster.\nWithout the follow-up."}
            </h2>
            <p className="mt-4 max-w-[380px] text-[16px] leading-[1.7] text-[#4A5568]">
              Create a professional invoice in seconds, send a shareable payment link,
              and get notified the moment money hits your account.
            </p>

            <div className="mt-7 space-y-3">
              <ShowcaseFeature>Shareable payment links</ShowcaseFeature>
              <ShowcaseFeature>Automatic overdue reminders</ShowcaseFeature>
              <ShowcaseFeature>Real-time payment notifications</ShowcaseFeature>
            </div>

            <ShowcaseLink>Send your first invoice</ShowcaseLink>
            <ShowcaseArrows />
          </div>

          <div className="flex min-h-[280px] items-center justify-center rounded-b-[24px] bg-[#DBEAFE] p-6 sm:p-8 lg:min-h-[360px] lg:rounded-b-none lg:rounded-r-[24px]">
            <div className="w-full max-w-[340px] rounded-[16px] bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[14px] font-bold text-[#0D1B2A]">Invoices</p>
                <span className="rounded-full bg-[#F7F6F3] px-2.5 py-1 text-[12px] text-[#4A5568]">
                  8 records
                </span>
              </div>

              <div className="mt-3 rounded-[8px] bg-[#F7F6F3] p-3">
                <p className="text-[11px] text-[#64748B]">Outstanding receivables</p>
                <p className="mt-1 text-[22px] font-extrabold text-[#0D1B2A]">{`${NAIRA}2,450,000`}</p>
              </div>

              <div className="mt-3">
                {[
                  {
                    customer: "Flutterwave",
                    amount: `${NAIRA}1,200,000`,
                    label: "Sent",
                    tone: "blue" as const,
                  },
                  {
                    customer: "Konga",
                    amount: `${NAIRA}450,000`,
                    label: "Paid",
                    tone: "green" as const,
                  },
                  {
                    customer: "Access Bank",
                    amount: `${NAIRA}750,000`,
                    label: "Overdue",
                    tone: "red" as const,
                  },
                ].map((row) => (
                  <div
                    key={row.customer}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[#F1F5F9] py-2 text-[13px] last:border-b-0"
                  >
                    <span className="font-medium text-[#0D1B2A]">{row.customer}</span>
                    <span className="font-medium text-[#0D1B2A]">{row.amount}</span>
                    <StatusPill label={row.label} tone={row.tone} className="px-2 py-0.5 text-[10px]" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.article>

      <motion.article
        ref={(node) => {
          cardRefs.current[1] = node;
        }}
        data-card-index={1}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className={cn(getCardClassName(1), "bg-[#FEF9EE]")}
      >
        <div className="grid h-full lg:grid-cols-[0.95fr_1fr]">
          <div className="order-2 px-6 py-8 sm:px-8 md:px-6 md:py-8 lg:order-2 lg:px-[48px] lg:py-[56px]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-[#D97706]">
              ACCOUNTS PAYABLE
            </p>
            <h2 className="mt-4 whitespace-pre-line text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0D1B2A] sm:text-[36px] lg:text-[40px]">
              {"Pay vendors on time,\nevery time."}
            </h2>
            <p className="mt-4 max-w-[380px] text-[16px] leading-[1.7] text-[#4A5568]">
              Schedule payments, set spending thresholds, and let your team sign off
              before a single naira leaves your account.
            </p>

            <div className="mt-7 space-y-3">
              <ShowcaseFeature>Multi-level payment approvals</ShowcaseFeature>
              <ShowcaseFeature>Scheduled future-dated payments</ShowcaseFeature>
              <ShowcaseFeature>Full immutable audit trail</ShowcaseFeature>
            </div>

            <ShowcaseLink>Manage your bills</ShowcaseLink>
            <ShowcaseArrows />
          </div>

          <div className="order-3 flex min-h-[280px] items-center justify-center rounded-b-[24px] bg-[#FDE68A] p-6 sm:p-8 lg:order-1 lg:min-h-[360px] lg:rounded-b-none lg:rounded-l-[24px]">
            <div className="w-full max-w-[360px] rounded-[16px] bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[14px] font-bold text-[#0D1B2A]">Bills</p>
                <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-[12px] font-medium text-[#D97706]">
                  Approvals enabled
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Due this week", value: `${NAIRA}475,500` },
                  { label: "Awaiting approval", value: "3 bills" },
                  { label: "Scheduled", value: "2 payments" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[8px] bg-[#FBFAF8] px-3 py-2.5">
                    <p className="text-[11px] text-[#64748B]">{item.label}</p>
                    <p className="mt-1 text-[13px] font-semibold text-[#0D1B2A]">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                {[
                  {
                    vendor: "Paystack Ltd",
                    amount: `${NAIRA}250,000`,
                    label: "Scheduled",
                    tone: "blue" as const,
                  },
                  {
                    vendor: "AWS Nigeria",
                    amount: `${NAIRA}180,500`,
                    label: "Unpaid",
                    tone: "amber" as const,
                  },
                  {
                    vendor: "Office Supplies",
                    amount: `${NAIRA}45,000`,
                    label: "Paid",
                    tone: "green" as const,
                  },
                ].map((row) => (
                  <div
                    key={row.vendor}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-[#F1F5F9] py-2 text-[13px] last:border-b-0"
                  >
                    <span className="font-medium text-[#0D1B2A]">{row.vendor}</span>
                    <span className="font-medium text-[#0D1B2A]">{row.amount}</span>
                    <StatusPill label={row.label} tone={row.tone} className="px-2 py-0.5 text-[10px]" />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between gap-4 rounded-[8px] bg-[#F7F6F3] px-3 py-2.5">
                <p className="text-[11px] leading-[1.5] text-[#4A5568]">
                  Approval threshold: Bills above {`${NAIRA}200,000`} require 2 approvers
                </p>
                <StatusPill label="Active" tone="green" className="shrink-0 px-2 py-0.5 text-[10px]" />
              </div>
            </div>
          </div>
        </div>
      </motion.article>

      <motion.article
        ref={(node) => {
          cardRefs.current[2] = node;
        }}
        data-card-index={2}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.55, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
        className={cn(getCardClassName(2), "bg-[#F0FDF4]")}
      >
        <div className="grid h-full lg:grid-cols-[1fr_0.95fr]">
          <div className="px-6 py-8 sm:px-8 md:px-6 md:py-8 lg:px-[56px] lg:py-[56px]">
            <p className="text-[11px] font-semibold tracking-[0.1em] text-[#16A34A]">
              AUDIT TRAIL & REPORTS
            </p>
            <h2 className="mt-4 whitespace-pre-line text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#0D1B2A] sm:text-[36px] lg:text-[40px]">
              {"Complete visibility.\nZero surprises."}
            </h2>
            <p className="mt-4 max-w-[380px] text-[16px] leading-[1.7] text-[#4A5568]">
              Every action logged. Every payment tracked. Your accountant gets the
              full picture without ever having to ask.
            </p>

            <div className="mt-7 space-y-3">
              <ShowcaseFeature>Immutable activity log</ShowcaseFeature>
              <ShowcaseFeature>Cash flow reports & exports</ShowcaseFeature>
              <ShowcaseFeature>Real-time financial position</ShowcaseFeature>
            </div>

            <ShowcaseLink>See the reports</ShowcaseLink>
            <ShowcaseArrows />
          </div>

          <div className="flex min-h-[280px] items-center justify-center rounded-b-[24px] bg-[#DCFCE7] p-6 sm:p-8 lg:min-h-[360px] lg:rounded-b-none lg:rounded-r-[24px]">
            <div className="w-full max-w-[360px] rounded-[16px] bg-white p-6 shadow-[0_16px_48px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[14px] font-bold text-[#0D1B2A]">Reports</p>
                <span className="rounded-full bg-[#F0FDF4] px-2.5 py-1 text-[12px] font-medium text-[#16A34A]">
                  Cash flow
                </span>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "Collected", value: `${NAIRA}1.43M`, tone: "green" as const },
                  { label: "Bills Paid", value: `${NAIRA}893.5K`, tone: "amber" as const },
                  { label: "Net Position", value: `${NAIRA}536.5K`, tone: "blue" as const },
                ].map((item) => (
                  <div key={item.label} className="rounded-[8px] bg-[#FBFAF8] p-3">
                    <p className="text-[11px] text-[#64748B]">{item.label}</p>
                    <p className="mt-2 text-[16px] font-bold text-[#0D1B2A]">{item.value}</p>
                    <div className="mt-2">
                      <StatusPill
                        label={item.tone === "amber" ? "Updated" : "Live"}
                        tone={item.tone}
                        className="px-2 py-0.5 text-[10px]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-[8px] bg-[#F0FDF4] p-3">
                <p className="text-[10px] text-[#4A5568]">Cash Flow - Last 6 months</p>
                <svg viewBox="0 0 300 60" className="mt-2 h-[60px] w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="reports-area" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="rgba(22,163,74,0.18)" />
                      <stop offset="100%" stopColor="rgba(22,163,74,0.03)" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0 48 C35 46 48 22 82 24 C116 26 126 40 164 34 C202 28 214 10 248 14 C274 17 288 26 300 18 L300 60 L0 60 Z"
                    fill="url(#reports-area)"
                  />
                  <path
                    d="M0 48 C35 46 48 22 82 24 C116 26 126 40 164 34 C202 28 214 10 248 14 C274 17 288 26 300 18"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="2"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </div>
  );
};

const FeaturesSection = () => {
  const darkSectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: darkSectionRef,
    offset: ["start end", "end start"],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ["0%", "15%"]);

  return (
    <>
      <section
        id="features"
        className="landing-peel-section z-[4] bg-[#F3F4FB] px-3 py-16 sm:px-4 lg:px-6 lg:py-[100px]"
      >
        <div className="mx-auto max-w-[1160px]">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="max-w-[720px]"
          >
            <motion.p
              variants={fadeUp}
              custom={0}
              className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#4A5568]"
            >
              BUILT FOR HOW BUSINESSES ACTUALLY WORK
            </motion.p>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="mt-3 whitespace-pre-line text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-[#0D1B2A] sm:text-[40px] md:text-[48px]"
            >
              {"Run your business like\na seasoned pro"}
            </motion.h2>
          </motion.div>

          <FeatureShowcaseCards />
        </div>
      </section>

      <section
        id="security"
        ref={darkSectionRef}
        className="landing-peel-section relative z-[5] overflow-hidden bg-[#0D1B2A] px-6 py-16 md:px-10 lg:px-12 lg:py-[120px]"
      >
        <span className="landing-peek-label z-[5] bg-[#0D1B2A] text-white/70">
          PLATFORM METRICS
        </span>

        <motion.div
          style={{ y: bgY }}
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0D1B2A] via-[#152238] to-[#0D1B2A] opacity-60"
        />

        <div className={cn(containerClass, "relative z-10")}>
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="mx-auto max-w-[800px] text-center"
          >
            <motion.h2
              variants={fadeUp}
              custom={0}
              className="whitespace-pre-line text-[32px] font-extrabold leading-[1.1] tracking-[-0.02em] text-white sm:text-[40px] md:text-[48px] lg:text-[56px]"
            >
              {"Everything you do with money.\nAll in one place."}
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="mt-4 text-[16px] leading-[1.7] text-white/55 md:text-[18px]"
            >
              Built for Nigerian businesses that are serious about their finances.
            </motion.p>
          </motion.div>

          <div className="mt-10 flex gap-0 overflow-x-auto scrollbar-hide snap-x snap-mandatory lg:hidden">
            {darkStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className={cn(
                  "min-w-[50%] snap-center px-6 py-4 text-center sm:min-w-[25%]",
                  index < darkStats.length - 1 && "border-r border-white/10",
                )}
              >
                <AnimatedStatValue
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  decimals={stat.decimals}
                  className="block text-[32px] font-extrabold leading-none tracking-[-0.02em] text-white sm:text-[42px]"
                />
                <p className="mt-2 text-[13px] text-white/50">{stat.label}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            className="mt-14 hidden gap-6 border-t border-white/10 pt-10 lg:grid lg:grid-cols-4 lg:gap-0 lg:border-t-0 lg:pt-0"
          >
            {darkStats.map((stat, index) => (
              <motion.div
                key={stat.label}
                variants={fadeUp}
                custom={index}
                className={cn(
                  "text-center lg:px-8",
                  index < darkStats.length - 1 && "lg:border-r lg:border-white/10",
                )}
              >
                <AnimatedStatValue
                  value={stat.value}
                  prefix={stat.prefix}
                  suffix={stat.suffix}
                  decimals={stat.decimals}
                  className="block text-[42px] font-extrabold leading-none tracking-[-0.02em] text-white md:text-[52px]"
                />
                <p className="mt-2 text-[14px] text-white/50">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="mt-16 grid items-center gap-10 lg:mt-24 lg:grid-cols-[1.2fr_0.8fr]"
          >
            <motion.div variants={fadeUp} custom={0} className="max-w-[620px]">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">
                APPROVAL WORKFLOWS
              </p>
              <h2 className="mt-4 whitespace-pre-line text-[32px] font-extrabold leading-[1.08] tracking-[-0.02em] text-white sm:text-[40px] md:text-[48px]">
                {"Controls at your\nfingertips."}
              </h2>
              <p className="mt-5 text-[16px] leading-[1.7] text-white/65 md:text-[18px]">
                Decide who can create, approve, or pay. Set spending thresholds and
                require sign-off before a single naira leaves your account.
              </p>

              <div className="mt-9 space-y-4">
                {approvalBullets.map((bullet, index) => (
                  <motion.div
                    key={bullet}
                    variants={fadeUp}
                    custom={index + 1}
                    className="flex items-center gap-3"
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-white">
                      <Check size={12} />
                    </span>
                    <span className="text-[15px] font-medium text-white md:text-[16px]">
                      {bullet}
                    </span>
                  </motion.div>
                ))}
              </div>

              <motion.div variants={fadeUp} custom={4}>
                <Link
                  to="/register"
                  className="mt-10 inline-flex items-center gap-2 rounded-[6px] border border-white/20 bg-white/10 px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-white/15"
                >
                  <span>Explore access controls</span>
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={2}
              className="rounded-[12px] border border-white/10 bg-[#1A2640] p-6 md:p-7"
            >
              <p className="text-[14px] font-semibold text-white">Approval threshold</p>
              <p className="mt-1 text-[13px] text-white/50">
                Bills above {`${NAIRA}200,000`} require 2 approvers
              </p>

              <div className="mt-6 space-y-4">
                {[
                  "Require approval for all bills",
                  "Notify all approvers by email",
                  "Block payment if not approved",
                ].map((label) => (
                  <div key={label} className="flex items-center justify-between gap-4">
                    <span className="text-[13px] text-white/85 md:text-[14px]">{label}</span>
                    <ToggleSwitch checked />
                  </div>
                ))}
              </div>

              <div className="mt-6 border-t border-white/10 pt-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45">
                  Payment status
                </p>
                <div className="mt-3 rounded-[10px] border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-[13px] font-medium text-white md:text-[14px]">
                    BILL-004 - Dangote Cement - {`${NAIRA}210,000`}
                  </p>
                  <div className="mt-3">
                    <StatusPill
                      label="Awaiting approval (1 of 2)"
                      tone="amber"
                      className="bg-[#D97706]/15 text-[#FBBF24]"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </>
  );
};

export default FeaturesSection;
