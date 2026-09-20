import * as Sentry from "@sentry/react";

const resolveSampleRate = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
};

const sentryDsn = import.meta.env.VITE_SENTRY_DSN?.trim();
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE;
const tracesSampleRate = resolveSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.2);

let monitoringInitialized = false;

export const isMonitoringEnabled = Boolean(sentryDsn);

export const initializeMonitoring = () => {
  if (!isMonitoringEnabled || monitoringInitialized) {
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    enabled: true,
    environment: sentryEnvironment,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate,
  });

  monitoringInitialized = true;

  window.__MONIGER_TRIGGER_SENTRY_TEST__ = () => {
    throw new Error("Moniger Sentry test error");
  };
};

export const captureMonitoringException = (error: unknown, context?: Record<string, unknown>) => {
  if (!isMonitoringEnabled) {
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
};

export const captureMonitoringMessage = (message: string, context?: Record<string, unknown>) => {
  if (!isMonitoringEnabled) {
    return;
  }

  Sentry.captureMessage(message, {
    extra: context,
    level: "info",
  });
};

export const setMonitoringUser = (user: { email?: string | null; id: string }) => {
  if (!isMonitoringEnabled) {
    return;
  }

  Sentry.setUser({
    email: user.email ?? undefined,
    id: user.id,
  });
};

export const clearMonitoringUser = () => {
  if (!isMonitoringEnabled) {
    return;
  }

  Sentry.setUser(null);
};
