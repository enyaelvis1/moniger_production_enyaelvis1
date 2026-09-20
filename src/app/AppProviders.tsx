import { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ErrorBoundary,
  ErrorList,
  ErrorProvider,
} from "@/components/ui/error-handling";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { SessionTimeoutProvider } from "@/contexts/SessionTimeoutContext";
import { captureMonitoringException } from "@/lib/monitoring";
import { defaultQueryClientOptions } from "@/lib/query";

const queryClient = new QueryClient({
  defaultOptions: defaultQueryClientOptions,
});

const AppProviders = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SessionTimeoutProvider>
        <AuthProvider>
          <LocalizationProvider>
            <ErrorProvider>
              <Toaster />
              <Sonner />
              <div className="pointer-events-none fixed inset-x-0 top-4 z-50 px-4">
                <div className="pointer-events-auto mx-auto max-w-3xl">
                  <ErrorList />
                </div>
              </div>
              <ErrorBoundary
                onError={(error, errorInfo) => {
                  captureMonitoringException(error, {
                    componentStack: errorInfo.componentStack,
                  });
                }}
              >
                {children}
              </ErrorBoundary>
            </ErrorProvider>
          </LocalizationProvider>
        </AuthProvider>
      </SessionTimeoutProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default AppProviders;
