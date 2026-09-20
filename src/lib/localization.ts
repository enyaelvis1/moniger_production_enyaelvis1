import enMessages from "@/locales/en.json";
import frMessages from "@/locales/fr.json";

export type SupportedLanguage = "en" | "fr";
export type SupportedLocale = "en-NG" | "en-US" | "fr-FR";

type TranslationTree = Record<string, string | TranslationTree>;
type TranslationParams = Record<string, string | number>;

export type LocalizationPreferences = {
  currency: string;
  language: SupportedLanguage;
  locale: SupportedLocale;
  timezone: string;
};

const translations: Record<SupportedLanguage, TranslationTree> = {
  en: enMessages as TranslationTree,
  fr: frMessages as TranslationTree,
};

export const supportedLanguages: Array<{ label: string; value: SupportedLanguage }> = [
  { label: "English", value: "en" },
  { label: "Français", value: "fr" },
];

export const supportedLocales: Array<{ label: string; value: SupportedLocale }> = [
  { label: "English (Nigeria)", value: "en-NG" },
  { label: "English (United States)", value: "en-US" },
  { label: "Français (France)", value: "fr-FR" },
];

export const defaultBusinessLanguage: SupportedLanguage = "en";
export const defaultBusinessLocale: SupportedLocale = "en-NG";
export const defaultTimezone = "Africa/Lagos";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const resolveTranslationNode = (language: SupportedLanguage, key: string): string | undefined => {
  const parts = key.split(".");
  let current: unknown = translations[language];

  for (const part of parts) {
    if (!isRecord(current) || !(part in current)) {
      return undefined;
    }

    current = current[part];
  }

  return typeof current === "string" ? current : undefined;
};

const interpolate = (template: string, params?: TranslationParams) => {
  if (!params) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? "" : String(value);
  });
};

export const isSupportedLanguage = (value: string | null | undefined): value is SupportedLanguage =>
  value === "en" || value === "fr";

export const isSupportedLocale = (value: string | null | undefined): value is SupportedLocale =>
  value === "en-NG" || value === "en-US" || value === "fr-FR";

export const inferLanguageFromLocale = (locale: string | null | undefined): SupportedLanguage =>
  locale?.toLowerCase().startsWith("fr") ? "fr" : "en";

export const normalizeLanguagePreference = (value: string | null | undefined): SupportedLanguage =>
  isSupportedLanguage(value) ? value : defaultBusinessLanguage;

export const normalizeLocalePreference = (value: string | null | undefined): SupportedLocale => {
  if (isSupportedLocale(value)) {
    return value;
  }

  return defaultBusinessLocale;
};

export const detectBrowserLocale = (): SupportedLocale => {
  if (typeof navigator === "undefined") {
    return defaultBusinessLocale;
  }

  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) {
      return candidate;
    }

    if (candidate?.toLowerCase().startsWith("fr")) {
      return "fr-FR";
    }

    if (candidate?.toLowerCase() === "en-us") {
      return "en-US";
    }
  }

  return defaultBusinessLocale;
};

export const detectBrowserLanguage = (): SupportedLanguage =>
  inferLanguageFromLocale(detectBrowserLocale());

export const detectBrowserTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || defaultTimezone;

export const translate = (language: SupportedLanguage, key: string, params?: TranslationParams) => {
  const message = resolveTranslationNode(language, key) ?? resolveTranslationNode(defaultBusinessLanguage, key) ?? key;
  return interpolate(message, params);
};

export const formatCurrencyValue = (
  amount: number | null | undefined,
  { currency, locale }: Pick<LocalizationPreferences, "currency" | "locale">,
) => {
  const normalizedAmount = Number(amount ?? 0);

  try {
    return new Intl.NumberFormat(locale, {
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(normalizedAmount);
  } catch {
    return `${currency} ${normalizedAmount.toFixed(2)}`;
  }
};

export const formatNumberValue = (
  value: number | null | undefined,
  { locale }: Pick<LocalizationPreferences, "locale">,
  options: Intl.NumberFormatOptions = {},
) => {
  const normalizedValue = Number(value ?? 0);

  try {
    return new Intl.NumberFormat(locale, options).format(normalizedValue);
  } catch {
    return normalizedValue.toString();
  }
};

export const formatRelativeTimeValue = (
  value: string | number | Date | null | undefined,
  { locale }: Pick<LocalizationPreferences, "locale">,
) => {
  if (!value) {
    return "Unavailable";
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    return "Unavailable";
  }

  const diffInSeconds = Math.round((normalizedDate.getTime() - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(diffInSeconds);

  let unit: Intl.RelativeTimeFormatUnit = "second";
  let amount = diffInSeconds;

  if (absoluteSeconds >= 60 && absoluteSeconds < 3600) {
    unit = "minute";
    amount = Math.round(diffInSeconds / 60);
  } else if (absoluteSeconds >= 3600 && absoluteSeconds < 86400) {
    unit = "hour";
    amount = Math.round(diffInSeconds / 3600);
  } else if (absoluteSeconds >= 86400 && absoluteSeconds < 604800) {
    unit = "day";
    amount = Math.round(diffInSeconds / 86400);
  } else if (absoluteSeconds >= 604800 && absoluteSeconds < 2629800) {
    unit = "week";
    amount = Math.round(diffInSeconds / 604800);
  } else if (absoluteSeconds >= 2629800 && absoluteSeconds < 31557600) {
    unit = "month";
    amount = Math.round(diffInSeconds / 2629800);
  } else if (absoluteSeconds >= 31557600) {
    unit = "year";
    amount = Math.round(diffInSeconds / 31557600);
  }

  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(amount, unit);
  } catch {
    return normalizedDate.toISOString();
  }
};

export const formatDateValue = (
  value: string | number | Date | null | undefined,
  { locale, timezone }: Pick<LocalizationPreferences, "locale" | "timezone">,
  options: Intl.DateTimeFormatOptions = {},
) => {
  if (!value) {
    return "Unavailable";
  }

  const normalizedDate = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(normalizedDate.getTime())) {
    return "Unavailable";
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      ...options,
    }).format(normalizedDate);
  } catch {
    return normalizedDate.toISOString();
  }
};

export const formatDateOnlyValue = (
  value: string | number | Date | null | undefined,
  preferences: Pick<LocalizationPreferences, "locale" | "timezone">,
) =>
  formatDateValue(value, preferences, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const formatDateTimeValue = (
  value: string | number | Date | null | undefined,
  preferences: Pick<LocalizationPreferences, "locale" | "timezone">,
) =>
  formatDateValue(value, preferences, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  });

export const getMonthOptions = (preferences: Pick<LocalizationPreferences, "locale" | "timezone">) =>
  Array.from({ length: 12 }, (_, index) =>
    formatDateValue(new Date(Date.UTC(2026, index, 1)), preferences, {
      month: "long",
    }),
  );
