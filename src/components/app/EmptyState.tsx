import type { ComponentType } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

interface EmptyStateProps {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  actions?: EmptyStateAction[];
  className?: string;
  size?: "default" | "compact";
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  actions = [],
  className,
  size = "default",
}: EmptyStateProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center border border-dashed border-border text-center",
        isCompact ? "rounded-lg bg-muted/20 px-4 py-6" : "rounded-xl bg-card/60 px-6 py-12",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-full bg-muted",
          isCompact ? "h-12 w-12" : "h-14 w-14",
        )}
      >
        <Icon className={cn("text-muted-foreground", isCompact ? "h-6 w-6" : "h-7 w-7")} />
      </div>
      <h3 className={cn("font-semibold text-foreground", isCompact ? "text-base" : "text-lg")}>{title}</h3>
      <p className={cn("mt-2 text-sm text-muted-foreground", isCompact ? "max-w-sm" : "max-w-md")}>{description}</p>
      {actions.length > 0 && (
        <div className={cn("mt-5 flex flex-wrap items-center justify-center gap-3", isCompact ? "mt-4 gap-2" : undefined)}>
          {actions.map((action) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              variant={action.variant ?? "default"}
              size={action.size ?? (isCompact ? "sm" : "default")}
              className="btn-press rounded-lg"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
