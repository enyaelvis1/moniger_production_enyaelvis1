import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type OperationStatusState = "error" | "running" | "success";

type OperationStatusNoticeProps = {
  description: string;
  onRetry?: () => void;
  retryLabel?: string;
  state: OperationStatusState;
  title: string;
};

const stateConfig = {
  error: {
    ariaLive: "assertive",
    className: "border-destructive/40 bg-destructive/5 text-foreground",
    icon: AlertCircle,
    iconClassName: "text-destructive",
    role: "alert",
  },
  running: {
    ariaLive: "polite",
    className: "border-primary/20 bg-primary/5 text-foreground",
    icon: Loader2,
    iconClassName: "animate-spin text-primary",
    role: "status",
  },
  success: {
    ariaLive: "polite",
    className: "border-success/30 bg-success/10 text-foreground",
    icon: CheckCircle2,
    iconClassName: "text-success",
    role: "status",
  },
} as const;

const OperationStatusNotice = ({
  description,
  onRetry,
  retryLabel = "Retry",
  state,
  title,
}: OperationStatusNoticeProps) => {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <Alert
      role={config.role}
      aria-live={config.ariaLive}
      aria-atomic="true"
      className={cn("backdrop-blur-sm", config.className)}
    >
      <Icon className={`h-4 w-4 ${config.iconClassName}`} aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>{description}</p>
        {state === "error" && onRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry} className="w-full sm:w-auto">
            {retryLabel}
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
};

export default OperationStatusNotice;
