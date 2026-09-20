import { cn } from "@/lib/utils";

type BadgeVariant = "grey" | "blue" | "red" | "green" | "amber" | "dark";

const variantStyles: Record<BadgeVariant, string> = {
  grey: "bg-muted text-muted-foreground",
  blue: "bg-secondary/15 text-secondary",
  red: "bg-destructive/15 text-destructive",
  green: "bg-success/15 text-success",
  amber: "bg-warning/15 text-warning",
  dark: "bg-foreground/10 text-foreground",
};

const StatusBadge = ({
  variant,
  children,
  className,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium",
      variantStyles[variant],
      className
    )}
  >
    {children}
  </span>
);

export default StatusBadge;
