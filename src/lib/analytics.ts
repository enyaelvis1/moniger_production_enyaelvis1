import * as amplitude from "@amplitude/analytics-browser";

type AnalyticsPrimitive = boolean | number | string | null;
type AnalyticsPropertyValue = AnalyticsPrimitive | AnalyticsPrimitive[] | undefined;
type AnalyticsEventProperties = Record<string, AnalyticsPropertyValue>;
type AnalyticsContext = {
  business_id?: string;
  workspace_role?: string;
};

const amplitudeApiKey = import.meta.env.VITE_AMPLITUDE_API_KEY?.trim();
const amplitudeEnvironment = import.meta.env.MODE;

let analyticsInitialized = false;
let analyticsContext: AnalyticsContext = {};

export const isAnalyticsConfigured = Boolean(amplitudeApiKey);

const sanitizeValue = (value: unknown): AnalyticsPropertyValue => {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.filter(
      (entry): entry is AnalyticsPrimitive =>
        entry === null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean",
    );
  }

  return undefined;
};

const sanitizeEventProperties = (properties: Record<string, unknown>) =>
  Object.entries(properties).reduce<Record<string, Exclude<AnalyticsPropertyValue, undefined>>>((accumulator, [key, value]) => {
    const sanitizedValue = sanitizeValue(value);

    if (sanitizedValue !== undefined) {
      accumulator[key] = sanitizedValue;
    }

    return accumulator;
  }, {});

export const initializeAnalytics = () => {
  if (!isAnalyticsConfigured || analyticsInitialized) {
    return;
  }

  amplitude.init(amplitudeApiKey!, {
    autocapture: false,
    defaultTracking: false,
    optOut: true,
    logLevel: import.meta.env.DEV ? amplitude.Types.LogLevel.Warn : amplitude.Types.LogLevel.Error,
  });

  analyticsInitialized = true;
};

export const setAnalyticsConsent = (enabled: boolean) => {
  if (!isAnalyticsConfigured) {
    return;
  }

  amplitude.setOptOut(!enabled);
};

export const setAnalyticsContext = (nextContext: AnalyticsContext) => {
  analyticsContext = {
    ...analyticsContext,
    ...nextContext,
  };
};

export const clearAnalyticsContext = () => {
  analyticsContext = {};
};

export const setAnalyticsUser = ({
  businessId,
  locale,
  userId,
  workspaceRole,
}: {
  businessId?: string | null;
  locale?: string | null;
  userId: string;
  workspaceRole?: string | null;
}) => {
  if (!isAnalyticsConfigured) {
    return;
  }

  amplitude.setUserId(userId);

  const identify = new amplitude.Identify();

  if (businessId) {
    identify.set("business_id", businessId);
  }
  if (workspaceRole) {
    identify.set("workspace_role", workspaceRole);
  }
  if (locale) {
    identify.set("locale", locale);
  }

  amplitude.identify(identify);
};

export const clearAnalyticsUser = () => {
  if (!isAnalyticsConfigured) {
    return;
  }

  amplitude.setUserId(undefined);
};

export const trackAnalyticsEvent = (eventType: string, properties: AnalyticsEventProperties = {}) => {
  if (!isAnalyticsConfigured) {
    return;
  }

  const mergedProperties = sanitizeEventProperties({
    environment: amplitudeEnvironment,
    ...analyticsContext,
    ...properties,
  });

  amplitude.track(eventType, mergedProperties);
};
