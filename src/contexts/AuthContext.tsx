import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import {
  buildMfaState,
  createEmptyMfaState,
  type AppAuthMethod,
  type AppMfaFactor,
  type AuthenticatorAssuranceLevel,
} from "@/lib/mfa";
import { clearAnalyticsContext, clearAnalyticsUser, trackAnalyticsEvent } from "@/lib/analytics";
import { clearMonitoringUser, setMonitoringUser } from "@/lib/monitoring";
import { syncCurrentAccountSessionInventory } from "@/hooks/use-account-session-inventory";
import { getSessionIdFromAccessToken } from "@/lib/mfa-recovery";
import { supabase } from "@/lib/supabase";
import type { SubscriptionPlan } from "@/lib/subscriptions";
import { getEmailConfirmationRedirect } from "@/lib/subscription-registration";

export type AuthSignOutScope = "global" | "local" | "others";
export type AuthSignInResult = {
  needsMfa: boolean;
};

export interface AuthContextType {
  currentAuthMethods: AppAuthMethod[];
  currentAal: AuthenticatorAssuranceLevel;
  isMfaRequired: boolean;
  isRecoveryBypassActive: boolean;
  user: User | null;
  mfaFactors: AppMfaFactor[];
  mfaLoading: boolean;
  nextAal: AuthenticatorAssuranceLevel;
  refreshMfaState: () => Promise<void>;
  resendEmailConfirmation: () => Promise<void>;
  session: Session | null;
  signIn: (email: string, password: string) => Promise<AuthSignInResult>;
  signUp: (data: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    plan?: SubscriptionPlan;
  }) => Promise<{ needsEmailConfirmation: boolean; userId: string | null }>;
  signOut: (scope?: AuthSignOutScope) => Promise<void>;
  verifyMfa: (factorId: string, code: string) => Promise<void>;
  verifiedMfaFactors: AppMfaFactor[];
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaState, setMfaState] = useState(createEmptyMfaState());
  const [mfaLoading, setMfaLoading] = useState(false);
  const [isRecoveryBypassActive, setIsRecoveryBypassActive] = useState(false);

  const checkRecoveryBypass = useCallback(async (activeSession: Session | null) => {
    if (!activeSession?.access_token) {
      return false;
    }

    const sessionId = getSessionIdFromAccessToken(activeSession.access_token);
    if (!sessionId) {
      return false;
    }

    const { data, error } = await supabase.rpc("has_mfa_recovery_session", {
      p_session_id: sessionId,
    });

    if (error) {
      return false;
    }

    return data === true;
  }, []);

  const applyRecoveryBypass = useCallback(
    async (activeSession: Session | null, nextMfaState: ReturnType<typeof createEmptyMfaState> | ReturnType<typeof buildMfaState>) => {
      const recoveryBypass = nextMfaState.isRequired ? await checkRecoveryBypass(activeSession) : false;
      setIsRecoveryBypassActive(recoveryBypass);

      if (!recoveryBypass) {
        return nextMfaState;
      }

      const hasRecoveryMethod = nextMfaState.authMethods.some((method) => method.method === "recovery_code");

      return {
        ...nextMfaState,
        authMethods: hasRecoveryMethod
          ? nextMfaState.authMethods
          : [...nextMfaState.authMethods, { method: "recovery_code", verifiedAt: new Date().toISOString() }],
        isRequired: false,
      };
    },
    [checkRecoveryBypass],
  );

  const persistSessionInventory = useCallback(
    (activeSession: Session, nextMfaState: ReturnType<typeof createEmptyMfaState> | ReturnType<typeof buildMfaState>) => {
      const recoveryBypassActive = nextMfaState.authMethods.some((method) => method.method === "recovery_code");

      void syncCurrentAccountSessionInventory({
        currentAal: nextMfaState.currentLevel,
        currentAuthMethods: nextMfaState.authMethods,
        isRecoveryBypassActive: recoveryBypassActive,
        session: activeSession,
      }).catch(() => undefined);
    },
    [],
  );

  const loadMfaState = useCallback(async () => {
    const [assuranceResponse, factorsResponse] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);

    if (assuranceResponse.error) {
      throw assuranceResponse.error;
    }

    if (factorsResponse.error) {
      throw factorsResponse.error;
    }

    return buildMfaState({
      currentAuthenticationMethods: Array.isArray(assuranceResponse.data.currentAuthenticationMethods)
        ? assuranceResponse.data.currentAuthenticationMethods
        : [],
      currentLevel: assuranceResponse.data.currentLevel,
      factors: factorsResponse.data.all,
      nextLevel: assuranceResponse.data.nextLevel,
    });
  }, []);

  const refreshMfaState = useCallback(async () => {
    const {
      data: { session: activeSession },
    } = await supabase.auth.getSession();

    if (!activeSession) {
      setMfaState(createEmptyMfaState());
      setIsRecoveryBypassActive(false);
      return;
    }

    setMfaLoading(true);

    try {
      const nextMfaState = await loadMfaState();
      const finalMfaState = await applyRecoveryBypass(activeSession, nextMfaState);
      setMfaState(finalMfaState);
      persistSessionInventory(activeSession, finalMfaState);
    } catch {
      setMfaState(createEmptyMfaState());
      setIsRecoveryBypassActive(false);
    } finally {
      setMfaLoading(false);
    }
  }, [applyRecoveryBypass, loadMfaState, persistSessionInventory]);

  const syncSessionState = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession) {
        clearMonitoringUser();
        setMfaState(createEmptyMfaState());
        setIsRecoveryBypassActive(false);
        setMfaLoading(false);
        setLoading(false);
        return;
      }

      setMonitoringUser({
        email: nextSession.user.email ?? null,
        id: nextSession.user.id,
      });

      setMfaLoading(true);

      try {
        const nextMfaState = await loadMfaState();
        const finalMfaState = await applyRecoveryBypass(nextSession, nextMfaState);
        setMfaState(finalMfaState);
        persistSessionInventory(nextSession, finalMfaState);
      } catch {
        setMfaState(createEmptyMfaState());
        setIsRecoveryBypassActive(false);
      } finally {
        setMfaLoading(false);
        setLoading(false);
      }
    },
    [applyRecoveryBypass, loadMfaState, persistSessionInventory],
  );

  useEffect(() => {
    let isMounted = true;

    const applySession = async (nextSession: Session | null) => {
      if (!isMounted) {
        return;
      }

      await syncSessionState(nextSession);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });

    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      void applySession(existingSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncSessionState]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    setSession(data.session);
    setUser(data.user ?? data.session?.user ?? null);
    const authUser = data.user ?? data.session?.user ?? null;
    if (authUser) {
      setMonitoringUser({
        email: authUser.email ?? null,
        id: authUser.id,
      });
    }

    let nextMfaState = createEmptyMfaState();

    if (data.session) {
      setMfaLoading(true);

      try {
        nextMfaState = await loadMfaState();
        const finalMfaState = await applyRecoveryBypass(data.session, nextMfaState);
        nextMfaState = finalMfaState;
        setMfaState(finalMfaState);
        persistSessionInventory(data.session, finalMfaState);
      } catch {
        setMfaState(createEmptyMfaState());
        setIsRecoveryBypassActive(false);
      } finally {
        setMfaLoading(false);
      }
    } else {
      setMfaState(createEmptyMfaState());
      setIsRecoveryBypassActive(false);
    }

    return {
      needsMfa: nextMfaState.isRequired,
    };
  };

  const signUp = async (data: { email: string; password: string; name: string; businessName: string; plan?: SubscriptionPlan }) => {
    const configuredEmailRedirectTo = import.meta.env.VITE_SUPABASE_EMAIL_REDIRECT_TO?.trim();
    const plan = data.plan ?? "starter";
    const emailRedirectTo = getEmailConfirmationRedirect({
      origin: window.location.origin,
      plan,
      redirectTo: configuredEmailRedirectTo || `${window.location.origin}/dashboard`,
    });
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          business_name: data.businessName,
          signup_plan: plan,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });
    if (error) throw error;

    const userId = signUpData.user?.id ?? null;
    if (userId && supabase.functions?.invoke) {
      try {
        await supabase.functions.invoke("signup-alert", {
          body: {
            plan,
            userId,
          },
        });
      } catch (alertError) {
        console.warn("Signup alert delivery failed", alertError);
      }
    }

    return {
      needsEmailConfirmation: !signUpData.session,
      userId,
    };
  };

  const resendEmailConfirmation = async () => {
    if (!user?.email) {
      throw new Error("We could not find an email address for this account.");
    }

    const plan = user.user_metadata?.signup_plan as SubscriptionPlan | undefined;
    const emailRedirectTo = getEmailConfirmationRedirect({
      origin: window.location.origin,
      plan: plan === "growth" || plan === "business" ? plan : "starter",
      redirectTo: import.meta.env.VITE_SUPABASE_EMAIL_REDIRECT_TO?.trim() || `${window.location.origin}/dashboard`,
    });
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: user.email,
      options: { emailRedirectTo },
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async (scope: AuthSignOutScope = "local") => {
    trackAnalyticsEvent("sign_out", { scope });
    const { error } = await supabase.auth.signOut({ scope });
    if (error) throw error;
    if (scope === "global" || scope === "local") {
      clearMonitoringUser();
      clearAnalyticsUser();
      clearAnalyticsContext();
      setMfaState(createEmptyMfaState());
      setIsRecoveryBypassActive(false);
    }
  };

  const verifyMfa = async (factorId: string, code: string) => {
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      code,
      factorId,
    });

    if (error) {
      throw error;
    }

    await refreshMfaState();
  };

  return (
    <AuthContext.Provider
      value={{
        currentAuthMethods: mfaState.authMethods,
        currentAal: mfaState.currentLevel,
        isMfaRequired: mfaState.isRequired,
        isRecoveryBypassActive,
        loading,
        mfaFactors: mfaState.factors,
        mfaLoading,
        nextAal: mfaState.nextLevel,
        refreshMfaState,
        resendEmailConfirmation,
        session,
        signIn,
        signOut,
        signUp,
        user,
        verifyMfa,
        verifiedMfaFactors: mfaState.verifiedFactors,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
