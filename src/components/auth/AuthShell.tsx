import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const authInputClassName =
  "h-12 rounded-[12px] border border-[#D7DDED] bg-white px-4 text-[16px] text-[#15203B] shadow-[inset_0_1px_2px_rgba(15,23,42,0.02)] placeholder:text-[#98A1BA] transition-[border-color,box-shadow] focus-visible:border-[#5B67F7] focus-visible:ring-[3px] focus-visible:ring-[#E3E7FF] focus-visible:ring-offset-0";

export const authLabelClassName = "mb-2 block text-[14px] font-medium text-[#26314F]";

export const authPrimaryButtonClassName =
  "inline-flex h-14 min-w-[200px] items-center justify-center gap-3 rounded-full bg-[#5B67F7] px-9 text-[16px] font-semibold text-white shadow-[0_8px_24px_rgba(91,103,247,0.25)] transition-all duration-200 hover:-translate-y-px hover:bg-[#4A56E0] hover:shadow-[0_12px_32px_rgba(91,103,247,0.3)] disabled:cursor-not-allowed disabled:bg-[#C5CAE9] disabled:shadow-none";

export const authSecondaryButtonClassName =
  "inline-flex h-14 min-w-[200px] items-center justify-center gap-3 rounded-full border border-[#D8DDF0] bg-white px-9 text-[16px] font-semibold text-[#15203B] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:bg-[#F3F4FB] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]";

type AuthShellProps = {
  topActionLabel: string;
  topActionTo: string;
  cardHeader: ReactNode;
  children: ReactNode;
  bottomPanel?: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
};

const PlatformMark = () => (
  <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#5B67F7] shadow-[0_4px_12px_rgba(91,103,247,0.3)]">
    <span className="text-[18px] font-black text-white">M</span>
  </span>
);

export const AuthCardHeader = ({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) => (
  <div className={cn(className)}>
    <h1 className="text-[34px] font-bold tracking-[-0.04em] text-[#10203F] sm:text-[40px]">{title}</h1>
    {subtitle ? (
      <p className="mt-3 max-w-[520px] text-[15px] leading-7 text-[#677391]">{subtitle}</p>
    ) : null}
  </div>
);

const AuthShell = ({
  topActionLabel,
  topActionTo,
  cardHeader,
  children,
  bottomPanel,
  cardClassName,
  contentClassName,
}: AuthShellProps) => (
  <div className="min-h-screen bg-[#F3F4FB] text-[#15203B]">
    {/* Subtle gradient overlay */}
    <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(91,103,247,0.06)_0%,transparent_70%)]" />

    <header className="relative z-10 px-6 py-6 sm:px-12 sm:py-8">
      <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between">
        <Link to="/" aria-label="moniger.net home" className="inline-flex items-center gap-3">
          <PlatformMark />
          <span className="text-[20px] font-bold tracking-[-0.03em] text-[#10203F]">moniger.net</span>
        </Link>

        <Link
          to={topActionTo}
          className="inline-flex items-center gap-2 rounded-full border border-[#D8DDF0] bg-white px-5 py-2.5 text-[15px] font-medium text-[#10203F] shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-all duration-200 hover:bg-[#F3F4FB] hover:shadow-[0_4px_12px_rgba(91,103,247,0.08)]"
        >
          <span>{topActionLabel}</span>
          <ChevronRight size={16} />
        </Link>
      </div>
    </header>

    <main className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 pb-14 pt-2 sm:px-6 sm:pb-20">
      <div
        className={cn(
          "w-full max-w-[640px] overflow-hidden rounded-[24px] border border-[#D8DDF0] bg-white shadow-[0_0_0_1px_rgba(91,103,247,0.04),0_12px_32px_rgba(91,103,247,0.08),0_32px_64px_rgba(91,103,247,0.06)]",
          cardClassName,
        )}
      >
        <div className="px-6 py-8 sm:px-12 sm:py-14">
          {cardHeader}
          <div className={cn("mt-10", contentClassName)}>{children}</div>
        </div>

        {bottomPanel ? (
          <div className="border-t border-[#EAEDF6] bg-[#F8F9FD] px-6 py-6 sm:px-12">{bottomPanel}</div>
        ) : null}
      </div>
    </main>
  </div>
);

export default AuthShell;
