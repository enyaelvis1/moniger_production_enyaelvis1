import React, { type ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

import type { AppError, ErrorProviderProps } from "@/lib/error-handling";
import { clearBrowserAppCaches, isChunkLoadError } from "@/lib/app-cache";
import { ErrorContext, useError, useErrorState } from "@/lib/error-handling";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error boundary caught:", error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return <DefaultErrorFallback error={this.state.error} reset={this.handleReset} />;
    }

    return this.props.children;
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const deploymentError = isChunkLoadError(error);

  const recover = () => {
    if (!deploymentError) {
      reset();
      return;
    }

    void clearBrowserAppCaches().finally(() => window.location.reload());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-6 border border-border">
        <div className="flex items-start gap-4">
          <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {deploymentError ? "Moniger was updated" : "Something went wrong"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {deploymentError
                ? "This browser loaded an older app version. Refresh to load the latest deployment."
                : import.meta.env.DEV
                ? error.message
                : "We're sorry, but something unexpected happened. Please try again."}
            </p>
            <button
              onClick={recover}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw size={16} />
              {deploymentError ? "Refresh application" : "Try again"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorProvider({ children }: ErrorProviderProps) {
  const value = useErrorState();

  return <ErrorContext.Provider value={value}>{children}</ErrorContext.Provider>;
}

export function ErrorDisplay({ error }: { error: AppError }) {
  const { removeError } = useError();
  const severityStyles = {
    info: "bg-secondary/15 text-secondary border-secondary/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    error: "bg-destructive/15 text-destructive border-destructive/30",
    critical: "bg-destructive text-destructive-foreground border-destructive",
  };

  const iconColor = {
    info: "text-secondary",
    warning: "text-warning",
    error: "text-destructive",
    critical: "text-destructive-foreground",
  };

  return (
    <div
      className={`rounded-lg border p-4 mb-4 flex items-start gap-3 animate-fade-in ${severityStyles[error.severity]}`}
      role="alert"
      aria-live="assertive"
    >
      <AlertCircle className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconColor[error.severity]}`} />
      <div className="flex-1">
        <p className="font-medium">{error.userMessage}</p>
        {error.recoveryAction && (
          <button
            onClick={error.recoveryAction}
            className="text-sm mt-2 underline hover:no-underline"
          >
            {error.recoveryLabel || "Try again"}
          </button>
        )}
      </div>
      <button
        onClick={() => removeError(error.id)}
        className="flex-shrink-0 text-lg leading-none opacity-70 hover:opacity-100"
        aria-label="Dismiss error"
      >
        x
      </button>
    </div>
  );
}

export function ErrorList() {
  const { errors } = useError();

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {errors.map((error) => (
        <ErrorDisplay key={error.id} error={error} />
      ))}
    </div>
  );
}
