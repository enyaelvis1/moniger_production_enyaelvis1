import { type CSSProperties, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart2,
  CheckCircle2,
  Clock3,
  ReceiptText,
  Shield,
  Zap,
} from "lucide-react";
import { NAIRA } from "./landing-shared";
import dashboardPreview from "@/assets/dashboard-preview.jpg";

const heroFeatures = [
  { icon: Zap, text: "Send invoices in seconds" },
  { icon: Shield, text: "Approval controls" },
  { icon: BarChart2, text: "Audit-ready cash flow" },
] as const;

const trustLogos = [
  { name: "Konga", src: "/logos/konga.png", className: "h-7 md:h-8" },
  { name: "Flutterwave", src: "/logos/flutterwave.svg", className: "h-[18px] md:h-5" },
  { name: "GTBank", src: "/logos/gtbank.svg", className: "h-7 md:h-8" },
  { name: "Access Bank", src: "/logos/access-bank.png", className: "h-[18px] md:h-5" },
  { name: "Paystack", src: "/logos/paystack.svg", className: "h-4 md:h-[18px]" },
  { name: "Airtel Africa", src: "/logos/airtel-africa.svg", className: "h-[18px] md:h-5" },
  { name: "Zenith Bank", src: "/logos/zenith-bank.svg", className: "h-7 md:h-8" },
  { name: "Glo", src: "/logos/glo.png", className: "h-9 md:h-10" },
  { name: "FirstBank", src: "/logos/first-bank.svg", className: "h-7 md:h-8" },
] as const;

const heroAnimationStyle = (
  delay: string,
  duration: string,
  startY = "16px",
): CSSProperties =>
  ({
    "--hero-delay": delay,
    "--hero-duration": duration,
    "--hero-start-y": startY,
  }) as CSSProperties;

const HeroSection = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    navigate(trimmedEmail ? `/register?email=${encodeURIComponent(trimmedEmail)}` : "/register");
  };

  return (
    <>
      <section
        className="landing-hero relative z-[1] flex items-center overflow-visible px-5 pb-20 pt-[88px] max-md:pb-12 max-md:rounded-b-[28px] md:px-8 md:rounded-b-[40px] lg:px-12"
      >
        <div className="absolute inset-0 rounded-bl-[24px] rounded-br-[24px] bg-[radial-gradient(circle_at_18%_24%,rgba(22,163,74,0.08),transparent_18%),radial-gradient(circle_at_78%_28%,rgba(91,103,247,0.16),transparent_28%),radial-gradient(circle_at_84%_66%,rgba(16,32,63,0.06),transparent_24%),linear-gradient(180deg,#F7F8FF_0%,#F1F4FF_52%,#F6F6FB_100%)] md:rounded-bl-[40px] md:rounded-br-[40px]" />
        <div className="hero-orb hero-orb-left" aria-hidden="true" />
        <div className="hero-orb hero-orb-right" aria-hidden="true" />
        <div className="hero-grid-pattern" aria-hidden="true" />

        <div className="relative z-10 mx-auto w-full max-w-[1160px]">
          <div className="grid items-center gap-12 md:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] md:gap-16">
            <div className="hero-content min-w-0 flex flex-col justify-center text-center md:text-left">
              <div
                className="hero-badge hero-animate inline-flex items-center gap-2 self-center rounded-full border border-white/80 bg-white/88 py-2 pl-2.5 pr-4 text-[13px] font-semibold text-[#4A5568] shadow-[0_14px_34px_rgba(91,103,247,0.09)] backdrop-blur md:self-start"
                style={heroAnimationStyle("0ms", "500ms")}
              >
                <span className="hero-live-dot" aria-hidden="true" />
                <span>Finance workflow built for Nigerian businesses</span>
              </div>

              <h1
                className="hero-heading hero-animate mx-auto mt-6 max-w-full text-[36px] font-[800] leading-[0.98] tracking-[-0.05em] text-[#10203F] md:mx-0 md:max-w-[560px] md:text-[48px] lg:w-[660px] lg:max-w-none lg:text-[68px]"
                style={heroAnimationStyle("80ms", "600ms")}
              >
                Finance operations your team can{" "}
                <span className="hero-heading-accent">trust</span>
              </h1>

              <p
                className="hero-subtext hero-animate mx-auto mt-5 max-w-[500px] text-[18px] font-normal leading-[1.7] text-[#5E6A86] md:mx-0 md:text-[19px]"
                style={heroAnimationStyle("160ms", "600ms")}
              >
                Send invoices, manage vendor bills, and keep every naira visible from one
                clean, auditable workspace.
              </p>

              <div
                className="hero-feature-pills hero-animate mt-6 flex flex-wrap justify-center gap-2 md:justify-start"
                style={heroAnimationStyle("240ms", "500ms")}
              >
                {heroFeatures.map((feature) => (
                  <div
                    key={feature.text}
                    className="hero-feature-pill inline-flex items-center gap-[7px] rounded-full border border-white/80 bg-white/86 py-[8px] pl-[11px] pr-4 text-[13px] font-semibold text-[#374151] shadow-[0_10px_24px_rgba(91,103,247,0.07)] backdrop-blur transition-[border-color,box-shadow,transform] duration-150 ease-out hover:-translate-y-px hover:border-[#B0B8E8] hover:shadow-[0_14px_26px_rgba(91,103,247,0.11)] max-md:gap-[5px] max-md:py-[5px] max-md:pl-[8px] max-md:pr-[10px] max-md:text-[11px]"
                  >
                    <feature.icon size={14} className="text-[#5B67F7] max-md:h-3 max-md:w-3" />
                    <span>{feature.text}</span>
                  </div>
                ))}
              </div>

              <form
                aria-label="Start your Moniger trial"
                autoComplete="off"
                onSubmit={handleSubmit}
                className="hero-email-group hero-animate mx-auto mt-8 flex w-full max-w-[500px] items-center rounded-[18px] border border-white/80 bg-white/92 py-[7px] pl-[20px] pr-[7px] shadow-[0_24px_48px_rgba(91,103,247,0.10),0_6px_16px_rgba(16,32,63,0.05)] backdrop-blur transition-all duration-200 focus-within:border-[#5B67F7] focus-within:shadow-[0_0_0_4px_rgba(91,103,247,0.10),0_24px_48px_rgba(91,103,247,0.10)] md:mx-0"
                style={heroAnimationStyle("380ms", "500ms")}
              >
                <label htmlFor="hero-email" className="sr-only">
                  Work email
                </label>
                <input
                  id="hero-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your work email"
                  required
                  className="hero-email-input min-w-0 flex-1 border-0 bg-transparent py-[12px] pr-3 text-[15px] text-[#10203F] outline-none placeholder:text-[#98A1BA]"
                />
                <button
                  type="submit"
                  className="hero-email-button shrink-0 whitespace-nowrap rounded-[12px] border-0 bg-[#5B67F7] px-[24px] py-[14px] text-[14px] font-bold tracking-[-0.01em] text-white shadow-[0_12px_24px_rgba(91,103,247,0.28)] transition-[background,transform,box-shadow] duration-200 hover:bg-[#4A56E0] hover:shadow-[0_16px_28px_rgba(91,103,247,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2 active:scale-[0.97]"
                >
                  <span className="md:hidden">Get Started</span>
                  <span className="hidden md:inline">Get Started Free</span>
                </button>
              </form>

              <div
                className="hero-demo-link-wrap hero-animate mt-4 flex flex-col items-center gap-3 md:items-start"
                style={heroAnimationStyle("430ms", "400ms")}
              >
                <div className="hero-proof-row flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px] font-medium text-[#6A7592] md:justify-start">
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#16A34A]" />
                    No card required
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Clock3 size={14} className="text-[#5B67F7]" />
                    Setup in under 2 minutes
                  </span>
                </div>

                <Link
                  to="/login"
                  className="hero-demo-link group inline-flex items-center gap-[5px] text-[14px] font-medium text-[#677391] no-underline transition-colors duration-200 hover:text-[#10203F]"
                >
                  <span>Already have an account? Sign in</span>
                  <ArrowUpRight
                    size={14}
                    className="transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]"
                  />
                </Link>
              </div>
            </div>

            <div className="hidden items-center justify-end md:flex">
              <div className="landing-hero-frame hero-stage relative w-full max-w-[540px] lg:max-w-[620px]">
                <div className="hero-stage-backdrop" aria-hidden="true" />
                <div className="hero-stage-ring" aria-hidden="true" />
                <div className="hero-stage-grid" aria-hidden="true" />

                <div className="overflow-hidden rounded-[28px] border border-white/65 bg-white/96 shadow-[0_10px_28px_rgba(91,103,247,0.10),0_42px_80px_rgba(16,32,63,0.16)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(91,103,247,0.14),0_52px_92px_rgba(16,32,63,0.18)]">
                  <div className="flex items-center gap-2 bg-[#16284E] px-5 py-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
                    <span className="ml-auto text-[11px] font-semibold tracking-[0.10em] text-white/60">MONIGER DASHBOARD</span>
                  </div>
                  <img
                    src={dashboardPreview}
                    alt="moniger.net dashboard showing invoices, payments, and cash flow analytics"
                    width={1200}
                    height={800}
                    loading="eager"
                    decoding="async"
                    sizes="(min-width: 1024px) 580px, (min-width: 768px) 520px, 100vw"
                    className="block w-full"
                  />
                </div>

                <div className="hero-float-card absolute -left-8 top-[12%] rounded-[18px] border border-white/75 bg-white/95 px-4 py-3 shadow-[0_18px_40px_rgba(16,32,63,0.14)] backdrop-blur">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#EEF2FF] text-[#5B67F7]">
                      <ReceiptText size={18} />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[#6A7592]">Receivables overview</p>
                      <p className="mt-1 text-[22px] font-black tracking-[-0.04em] text-[#10203F]">{NAIRA}180k</p>
                      <p className="mt-1 text-[12px] text-[#16A34A]">Invoice collected</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 h-6 w-6 rounded-tr-[24px] bg-white md:h-10 md:w-10 md:rounded-tr-[40px]" />
        <div className="absolute bottom-0 right-0 h-6 w-6 rounded-tl-[24px] bg-white md:h-10 md:w-10 md:rounded-tl-[40px]" />
      </section>

      <section
        className="landing-peel-section relative z-[2] border-y border-[#D8DDF0] bg-white px-6 py-10 max-md:-mt-7 max-md:rounded-t-[28px] max-md:pt-10 md:-mt-10 md:px-10 lg:px-12 lg:py-12"
        style={{ position: "relative" }}
      >
        <div className="mx-auto max-w-[1160px]">
          <p className="text-center text-[14px] font-medium text-[#677391] md:text-[16px]">
            Trusted by businesses across Nigeria
          </p>

          <div className="mt-6 overflow-hidden">
            <div className="trust-marquee flex w-max items-center gap-10 lg:gap-14">
              {[...trustLogos, ...trustLogos, ...trustLogos].map((logo, index) => (
                <div
                  key={`${logo.name}-${index}`}
                  className="inline-flex min-w-[124px] shrink-0 items-center justify-center px-3 py-2 md:min-w-[144px]"
                >
                  <img
                    src={logo.src}
                    alt={`${logo.name} logo`}
                    width={160}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className={`w-auto max-w-[150px] object-contain ${logo.className}`}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
