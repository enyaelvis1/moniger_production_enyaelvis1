import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsData } from "@/hooks/use-settings-data";
import {
  defaultBusinessLanguage,
  defaultBusinessLocale,
  defaultTimezone,
  detectBrowserLanguage,
  detectBrowserLocale,
  detectBrowserTimezone,
  formatCurrencyValue,
  formatDateOnlyValue,
  formatDateTimeValue,
  formatNumberValue,
  formatRelativeTimeValue,
  getMonthOptions,
  inferLanguageFromLocale,
  normalizeLanguagePreference,
  normalizeLocalePreference,
  supportedLanguages,
  supportedLocales,
  translate,
  type SupportedLanguage,
  type SupportedLocale,
} from "@/lib/localization";

type LocalizationContextValue = {
  businessLanguage: SupportedLanguage;
  businessLocale: SupportedLocale;
  currency: string;
  formatCurrency: (amount: number | null | undefined, currencyOverride?: string) => string;
  formatDate: (value: string | number | Date | null | undefined) => string;
  formatDateTime: (value: string | number | Date | null | undefined) => string;
  formatNumber: (value: number | null | undefined, options?: Intl.NumberFormatOptions) => string;
  formatRelativeTime: (value: string | number | Date | null | undefined) => string;
  getMonthLabelOptions: () => string[];
  language: SupportedLanguage;
  locale: SupportedLocale;
  t: (key: string, params?: Record<string, string | number>) => string;
  timezone: string;
  userLanguage: SupportedLanguage | null;
  userLocale: SupportedLocale | null;
};

const LocalizationContext = createContext<LocalizationContextValue | null>(null);

export const LocalizationProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const profile = settingsQuery.data?.profile;
  const business = settingsQuery.data?.business;

  const browserLocale = useMemo(() => detectBrowserLocale(), []);
  const browserLanguage = useMemo(() => detectBrowserLanguage(), []);
  const browserTimezone = useMemo(() => detectBrowserTimezone(), []);

  const businessLanguage = normalizeLanguagePreference(business?.default_language ?? browserLanguage ?? defaultBusinessLanguage);
  const businessLocale = normalizeLocalePreference(business?.default_locale ?? browserLocale ?? defaultBusinessLocale);
  const userLanguage = profile?.language ? normalizeLanguagePreference(profile.language) : null;
  const userLocale = profile?.locale ? normalizeLocalePreference(profile.locale) : null;

  const effectiveLocale = userLocale ?? businessLocale;
  const effectiveLanguage = userLanguage ?? businessLanguage ?? inferLanguageFromLocale(effectiveLocale);
  const effectiveCurrency = business?.default_currency ?? profile?.default_currency ?? "NGN";
  const effectiveTimezone = profile?.timezone ?? browserTimezone ?? defaultTimezone;

  const value = useMemo<LocalizationContextValue>(
    () => ({
      businessLanguage,
      businessLocale,
      currency: effectiveCurrency,
      formatCurrency: (amount, currencyOverride) =>
        formatCurrencyValue(amount, { currency: currencyOverride ?? effectiveCurrency, locale: effectiveLocale }),
      formatDate: (date) => formatDateOnlyValue(date, { locale: effectiveLocale, timezone: effectiveTimezone }),
      formatDateTime: (date) => formatDateTimeValue(date, { locale: effectiveLocale, timezone: effectiveTimezone }),
      formatNumber: (numberValue, options) => formatNumberValue(numberValue, { locale: effectiveLocale }, options),
      formatRelativeTime: (date) => formatRelativeTimeValue(date, { locale: effectiveLocale }),
      getMonthLabelOptions: () => getMonthOptions({ locale: effectiveLocale, timezone: effectiveTimezone }),
      language: effectiveLanguage,
      locale: effectiveLocale,
      t: (key, params) => translate(effectiveLanguage, key, params),
      timezone: effectiveTimezone,
      userLanguage,
      userLocale,
    }),
    [
      businessLanguage,
      businessLocale,
      effectiveCurrency,
      effectiveLanguage,
      effectiveLocale,
      effectiveTimezone,
      userLanguage,
      userLocale,
    ],
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export const useLocalization = () => {
  const context = useContext(LocalizationContext);

  if (!context) {
    throw new Error("useLocalization must be used within a LocalizationProvider.");
  }

  return context;
};

export { supportedLanguages, supportedLocales };
