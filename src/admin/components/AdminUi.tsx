import { ReactNode } from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowUpRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

const useAdminTheme = () => {
  const { theme } = useTheme();
  return { isDark: theme === "dark" };
};

const getSurfaceClassName = (isDark: boolean) =>
  cn(
    "rounded-xl border shadow-[0_0_0_1px_rgba(59,130,246,0.02)]",
    isDark ? "border-white/5 bg-[#161E2E] text-[#F1F5F9]" : "border-[#DCE2F2] bg-white text-[#10203F]",
  );

export const AdminPageHeader = ({
  action,
  subtitle,
  title,
}: {
  action?: ReactNode;
  subtitle: ReactNode;
  title: string;
}) => {
  const { isDark } = useAdminTheme();

  return (
    <div className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className={cn("text-xl font-bold sm:text-[22px]", isDark ? "text-[#F1F5F9]" : "text-[#10203F]")}>{title}</h1>
        <div className={cn("mt-1 text-xs sm:text-[13px]", isDark ? "text-white/40" : "text-[#6B7693]")}>{subtitle}</div>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2 sm:gap-3">{action}</div> : null}
    </div>
  );
};

export const AdminSectionCard = ({
  children,
  className,
  title,
  titleAction,
}: {
  children: ReactNode;
  className?: string;
  title: string;
  titleAction?: ReactNode;
}) => {
  const { isDark } = useAdminTheme();

  return (
    <section className={cn(getSurfaceClassName(isDark), "p-4 sm:p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <h2 className={cn("text-sm font-semibold sm:text-[15px]", isDark ? "text-[#F1F5F9]" : "text-[#10203F]")}>{title}</h2>
        {titleAction}
      </div>
      {children}
    </section>
  );
};

export const AdminMetricCard = ({
  accent,
  icon,
  label,
  sublabel,
  trend,
  value,
}: {
  accent: ReactNode;
  icon: ReactNode;
  label: string;
  sublabel: string;
  trend?: ReactNode;
  value: string;
}) => {
  const { isDark } = useAdminTheme();

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-4 transition-all duration-150 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.08)] sm:px-6 sm:py-5",
        isDark ? "border-white/5 bg-[#161E2E] hover:border-white/10" : "border-[#DCE2F2] bg-white hover:border-[#C9D6F5]",
      )}
    >
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <div className="flex items-center gap-3">
          {icon}
          <span className={cn("text-[12px]", isDark ? "text-white/45" : "text-[#6B7693]")}>{label}</span>
        </div>
        {accent}
      </div>
      <p className={cn("text-[26px] font-bold tracking-[-0.04em] [font-variant-numeric:tabular-nums] sm:text-[32px]", isDark ? "text-[#F1F5F9]" : "text-[#10203F]")}>{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
        {trend}
        <span className={isDark ? "text-white/45" : "text-[#6B7693]"}>{sublabel}</span>
      </div>
    </div>
  );
};

export const AdminBadge = ({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "danger" | "info" | "neutral" | "success" | "warning";
}) => {
  const toneClasses = {
    danger: "border-[#EF4444]/20 bg-[#EF4444]/12 text-[#FCA5A5]",
    info: "border-[#3B82F6]/20 bg-[#3B82F6]/12 text-[#60A5FA]",
    neutral: "border-white/10 bg-white/5 text-white/60",
    success: "border-[#10B981]/20 bg-[#10B981]/12 text-[#34D399]",
    warning: "border-[#F59E0B]/20 bg-[#F59E0B]/12 text-[#FBBF24]",
  } as const;

  return <span className={cn("inline-flex items-center rounded-full border px-2 py-1 text-[10px] sm:px-2.5 sm:text-[11px]", toneClasses[tone])}>{children}</span>;
};

export const AdminToolbar = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { isDark } = useAdminTheme();

  return <div className={cn(getSurfaceClassName(isDark), "flex flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:items-center", className)}>{children}</div>;
};

export const AdminTableWrapper = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  const { isDark } = useAdminTheme();

  return (
    <div className={cn(getSurfaceClassName(isDark), "overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
};

export const AdminTableHead = ({ children }: { children: ReactNode }) => {
  const { isDark } = useAdminTheme();

  return <thead className={cn("text-[11px] uppercase tracking-[0.08em]", isDark ? "bg-[#0F1621] text-white/30" : "bg-[#F5F7FF] text-[#6B7693]")}>{children}</thead>;
};

export const AdminTableSkeleton = ({ columns = 4, rows = 6 }: { columns?: number; rows?: number }) => {
  const { isDark } = useAdminTheme();

  return (
    <div className={cn(getSurfaceClassName(isDark), "overflow-hidden")}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <AdminTableHead>
            <tr>
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i} className="table-header px-4 py-3 text-left">
                  <Skeleton className="h-3 w-24" />
                </th>
              ))}
            </tr>
          </AdminTableHead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r} className={cn("border-t", isDark ? "border-white/5" : "border-[#E3E6F2]") }>
                {Array.from({ length: columns }).map((__, c) => (
                  <td key={c} className="px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const AdminGhostButton = ({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button>) => {
  const { isDark } = useAdminTheme();

  return (
    <Button
      variant="ghost"
      className={cn(
        "h-8 rounded-lg border px-3 text-xs sm:h-9 sm:text-sm",
        isDark
          ? "border-white/10 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
          : "border-[#DCE2F2] bg-white text-[#10203F] hover:bg-[#F5F7FF] hover:text-[#10203F]",
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
};

export const AdminEmpty = ({
  description,
  icon = Inbox,
  title,
}: {
  description: string;
  icon?: Parameters<typeof EmptyState>[0]["icon"];
  title: string;
}) => {
  const { isDark } = useAdminTheme();

  return (
    <EmptyState
      className={isDark ? "border-white/10 bg-transparent" : "border-[#DCE2F2] bg-white/70"}
      description={description}
      icon={icon}
      title={title}
    />
  );
};

export const formatAdminDate = (value: string | null | undefined) => {
  if (!value) {
    return "Unknown";
  }

  return format(new Date(value), "MMM d, yyyy");
};

export const formatAdminDateTime = (value: string | null | undefined) => {
  if (!value) {
    return "Unknown";
  }

  return format(new Date(value), "MMM d, yyyy HH:mm");
};

export const formatAdminRelativeTime = (value: string | null | undefined) => {
  if (!value) {
    return "Unknown";
  }

  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
};

export const formatAdminCurrency = (value: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", {
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
    style: "currency",
  }).format(value);

export const formatAdminNumber = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? "compact" : "standard",
  }).format(value);

export const AdminInlineLink = ({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-1 text-[12px] text-[#60A5FA] transition-colors hover:text-[#93C5FD]"
  >
    <span>{children}</span>
    <ArrowUpRight size={12} aria-hidden="true" />
  </button>
);
