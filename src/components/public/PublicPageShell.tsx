import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { containerClass } from "@/components/landing/landing-shared";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { SkipToMainContent } from "@/components/ui/accessibility";

export const publicFadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

type Highlight = {
  label: string;
  value: string;
};

type PublicPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  accent: ReactNode;
  highlights?: Highlight[];
  children: ReactNode;
  aside?: ReactNode;
  contentClassName?: string;
  cta?: {
    label: string;
    to: string;
  };
};

export const PublicInfoCard = ({
  icon: Icon,
  onClick,
  title,
  description,
  className,
}: {
  icon: LucideIcon;
  onClick?: () => void;
  title: string;
  description: string;
  className?: string;
}) => (
  <div
    className={cn("rounded-[24px] border border-[#DCE2F2] bg-white/90 p-6 shadow-[0_18px_50px_rgba(16,32,63,0.06)]", onClick ? "cursor-pointer transition-shadow hover:shadow-[0_22px_60px_rgba(16,32,63,0.12)]" : "", className)}
    onClick={onClick}
    onKeyDown={(event) => {
      if (onClick && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onClick();
      }
    }}
    role={onClick ? "button" : undefined}
    tabIndex={onClick ? 0 : undefined}
  >
    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4154D8]">
      <Icon size={22} />
    </div>
    <h3 className="mt-5 text-[18px] font-bold tracking-[-0.02em] text-[#10203F]">{title}</h3>
    <p className="mt-2 text-[14px] leading-[1.75] text-[#5F6A88]">{description}</p>
  </div>
);

const PublicPageShell = ({
  eyebrow,
  title,
  description,
  accent,
  highlights = [],
  children,
  aside,
  contentClassName,
  cta,
}: PublicPageShellProps) => (
  <PublicPageShellContent
    accent={accent}
    aside={aside}
    children={children}
    cta={cta}
    description={description}
    eyebrow={eyebrow}
    highlights={highlights}
    title={title}
    contentClassName={contentClassName}
  />
);

const PublicPageShellContent = ({
  eyebrow,
  title,
  description,
  accent,
  highlights = [],
  children,
  aside,
  contentClassName,
  cta,
}: PublicPageShellProps) => {
  const { isOnline } = useNetworkStatus();

  return (
  <div className="min-h-screen bg-[#F7F6F3] text-[#10203F]">
    <SkipToMainContent />
    {!isOnline ? (
      <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-amber-900 md:px-10 lg:px-12">
        <div className={cn(containerClass, "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between")}>
          <div>
            <p className="font-semibold">You&apos;re offline</p>
            <p className="text-sm text-amber-900/80">Check your connection and refresh once you&apos;re back online.</p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
          >
            Retry
          </button>
        </div>
      </div>
    ) : null}
    <main id="main-content" tabIndex={-1} className="outline-none">
    <section className="relative overflow-hidden border-b border-[#E3E6F2] bg-[linear-gradient(180deg,#F7F8FC_0%,#EEF2FF_44%,#F7F6F3_100%)] px-6 pb-14 pt-10 md:px-10 lg:px-12 lg:pb-20">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-10%] h-56 w-56 rounded-full bg-[#D9E3FF] blur-3xl" />
        <div className="absolute right-[-4%] top-[10%] h-72 w-72 rounded-full bg-[#E7DDFD] blur-3xl" />
        <div className="absolute bottom-[-12%] left-[24%] h-48 w-48 rounded-full bg-[#DBF3E8] blur-3xl" />
      </div>

      <div className={cn(containerClass, "relative z-10")}>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#D8DDF0] bg-white/80 px-4 py-2 text-sm font-medium text-[#4154D8] backdrop-blur hover:border-[#B7C3F6] hover:text-[#3144CB]"
        >
          <ArrowLeft size={16} />
          Back to home
        </Link>

        <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <motion.div initial="hidden" animate="visible">
            <motion.span
              variants={publicFadeUp}
              custom={0}
              className="inline-flex rounded-full border border-[#D8DDF0] bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5F6A88]"
            >
              {eyebrow}
            </motion.span>
            <motion.h1
              variants={publicFadeUp}
              custom={1}
              className="mt-5 max-w-[720px] text-[40px] font-black leading-[1.02] tracking-[-0.04em] text-[#10203F] sm:text-[52px] lg:text-[64px]"
            >
              {title}
            </motion.h1>
            <motion.p
              variants={publicFadeUp}
              custom={2}
              className="mt-5 max-w-[620px] text-[18px] leading-[1.75] text-[#5F6A88] lg:text-[19px]"
            >
              {description}
            </motion.p>

            {highlights.length > 0 ? (
              <motion.div
                variants={publicFadeUp}
                custom={3}
                className="mt-8 grid gap-3 sm:grid-cols-3"
              >
                {highlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] border border-[#DCE2F2] bg-white/90 px-5 py-4 shadow-[0_16px_40px_rgba(16,32,63,0.05)]"
                  >
                    <p className="text-[24px] font-black tracking-[-0.03em] text-[#10203F]">{item.value}</p>
                    <p className="mt-1 text-[13px] text-[#6B7693]">{item.label}</p>
                  </div>
                ))}
              </motion.div>
            ) : null}

            {cta ? (
              <motion.div variants={publicFadeUp} custom={4} className="mt-8">
                <Link
                  to={cta.to}
                  className="inline-flex items-center gap-2 rounded-full bg-[#10203F] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(16,32,63,0.18)] transition-all hover:-translate-y-px hover:bg-[#0D1B2A]"
                >
                  <span>{cta.label}</span>
                  <ArrowRight size={16} />
                </Link>
              </motion.div>
            ) : null}
          </motion.div>

          <motion.div
            initial="hidden"
            animate="visible"
            variants={publicFadeUp}
            custom={2}
            className="relative"
          >
            {accent}
          </motion.div>
        </div>
      </div>
    </section>

    <section className="px-6 py-16 md:px-10 lg:px-12 lg:py-20">
      <div
        className={cn(
          containerClass,
          aside ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10" : "",
          contentClassName,
        )}
      >
        <div className="space-y-8">{children}</div>
        {aside ? <aside className="space-y-5">{aside}</aside> : null}
      </div>
    </section>
    </main>
  </div>
  );
};

export default PublicPageShell;
