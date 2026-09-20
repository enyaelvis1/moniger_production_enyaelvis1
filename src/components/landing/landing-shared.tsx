import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const NAIRA = "\u20A6";
export const HEART = "\u2665";

export const navItems = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Security", href: "#security" },
  { label: "About", href: "#about" },
] as const;

export const containerClass = "mx-auto max-w-[1160px]";

export type ButtonVariant = "primary" | "ghost" | "light" | "darkGhost";
export type ButtonSize = "default" | "small" | "form";

export const buttonClass = (variant: ButtonVariant, size: ButtonSize = "default") =>
  cn(
    "inline-flex items-center justify-center gap-3 whitespace-nowrap rounded-full border font-semibold tracking-[-0.02em] transition-all duration-200",
    {
      "h-16 px-9 text-[17px]": size === "default",
      "h-14 px-7 text-[16px]": size === "small",
      "h-[52px] px-7 text-[15px]": size === "form",
    },
    {
      "border-white/80 bg-white text-[#0D1B2A] shadow-[0_10px_24px_rgba(13,27,42,0.08)] hover:-translate-y-px hover:shadow-[0_14px_28px_rgba(13,27,42,0.12)]":
        variant === "primary" || variant === "light",
      "border-[#0D1B2A]/18 bg-transparent text-[#0D1B2A] hover:border-[#0D1B2A] hover:bg-white/70":
        variant === "ghost",
      "border-white/28 bg-transparent text-white hover:border-white/45 hover:bg-white/8":
        variant === "darkGhost",
    },
  );

export type Tone = "green" | "amber" | "blue" | "red" | "grey" | "navy";

const toneClasses: Record<Tone, string> = {
  green: "bg-[#ECFDF3] text-[#16A34A]",
  amber: "bg-[#FFF7ED] text-[#D97706]",
  blue: "bg-[#EFF6FF] text-[#2980B9]",
  red: "bg-[#FEF2F2] text-[#DC2626]",
  grey: "bg-[#F3F4F6] text-[#4A5568]",
  navy: "bg-[#E8EEF5] text-[#1A3C5E]",
};

export const StatusPill = ({
  label,
  tone,
  className,
}: {
  label: string;
  tone: Tone;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
      toneClasses[tone],
      className,
    )}
  >
    {label}
  </span>
);

export const BrowserDots = () => (
  <div className="flex items-center gap-2">
    <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
    <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
    <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
  </div>
);

export const NigeriaFlagMark = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-flex h-3.5 w-[18px] overflow-hidden rounded-[2px] border border-[#D8D5D0]",
      className,
    )}
  >
    <span className="h-full flex-1 bg-[#16A34A]" />
    <span className="h-full flex-1 bg-white" />
    <span className="h-full flex-1 bg-[#16A34A]" />
  </span>
);

export const ToggleSwitch = ({
  checked = true,
  className,
}: {
  checked?: boolean;
  className?: string;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
      checked ? "bg-[#2980B9]" : "bg-white/15",
      className,
    )}
  >
    <span
      className={cn(
        "inline-block h-5 w-5 rounded-full bg-white transition-transform",
        checked ? "translate-x-5" : "translate-x-1",
      )}
    />
  </span>
);

const formatAnimatedValue = (value: number, decimals: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

export const AnimatedStatValue = ({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || hasStarted) return undefined;

    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setHasStarted(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return undefined;

    let frameId = 0;
    let startTime = 0;
    const duration = 1500;

    const tick = (timestamp: number) => {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(value * easedProgress);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      } else {
        setDisplayValue(value);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [hasStarted, value]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatAnimatedValue(displayValue, decimals)}
      {suffix}
    </span>
  );
};

export const Panel = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div className={cn("rounded-[16px] border border-[#E8E4DF] bg-white", className)}>
    {children}
  </div>
);
