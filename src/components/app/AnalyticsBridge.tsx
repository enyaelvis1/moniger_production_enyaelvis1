import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { usePrivacyPreferencesData, useSettingsData } from "@/hooks/use-settings-data";
import {
  clearAnalyticsContext,
  clearAnalyticsUser,
  setAnalyticsConsent,
  setAnalyticsContext,
  setAnalyticsUser,
  trackAnalyticsEvent,
} from "@/lib/analytics";

const AnalyticsBridge = () => {
  const location = useLocation();
  const { session, user } = useAuth();
  const { locale } = useLocalization();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const workspaceRole = settingsQuery.data?.membership?.role ?? null;
  const privacyPreferencesQuery = usePrivacyPreferencesData(businessId, user?.id);
  const analyticsOptIn = privacyPreferencesQuery.data?.analytics_opt_in === true;
  const lastTrackedSessionRef = useRef<string | null>(null);
  const lastTrackedPathRef = useRef<string | null>(null);

  useEffect(() => {
    setAnalyticsConsent(analyticsOptIn);

    if (!analyticsOptIn || !user) {
      clearAnalyticsUser();
      clearAnalyticsContext();
      lastTrackedSessionRef.current = null;
      return;
    }

    setAnalyticsContext({
      business_id: businessId ?? undefined,
      workspace_role: workspaceRole ?? undefined,
    });
    setAnalyticsUser({
      businessId,
      locale,
      userId: user.id,
      workspaceRole,
    });
  }, [analyticsOptIn, businessId, locale, user, workspaceRole]);

  useEffect(() => {
    if (!analyticsOptIn || !session) {
      return;
    }

    if (lastTrackedSessionRef.current === session.access_token) {
      return;
    }

    trackAnalyticsEvent("sign_in", {
      auth_level: session.user.aud,
      has_mfa_session: Array.isArray(session.user.factors) && session.user.factors.length > 0,
      path: location.pathname,
    });
    lastTrackedSessionRef.current = session.access_token;
  }, [analyticsOptIn, location.pathname, session]);

  useEffect(() => {
    if (!analyticsOptIn) {
      lastTrackedPathRef.current = null;
      return;
    }

    const currentPath = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current === currentPath) {
      return;
    }

    trackAnalyticsEvent("page_viewed", {
      has_search: Boolean(location.search),
      path: location.pathname,
    });
    lastTrackedPathRef.current = currentPath;
  }, [analyticsOptIn, location.pathname, location.search]);

  return null;
};

export default AnalyticsBridge;
