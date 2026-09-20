import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const {
  clearAnalyticsContextMock,
  clearAnalyticsUserMock,
  getSessionMock,
  getAuthenticatorAssuranceLevelMock,
  listFactorsMock,
  setMonitoringUserMock,
  challengeAndVerifyMock,
  onAuthStateChangeMock,
  signInWithPasswordMock,
  signOutMock,
  signUpMock,
  trackAnalyticsEventMock,
  unsubscribeMock,
} = vi.hoisted(() => ({
  clearAnalyticsContextMock: vi.fn(),
  clearAnalyticsUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  getAuthenticatorAssuranceLevelMock: vi.fn(),
  listFactorsMock: vi.fn(),
  setMonitoringUserMock: vi.fn(),
  challengeAndVerifyMock: vi.fn(),
  onAuthStateChangeMock: vi.fn(),
  signInWithPasswordMock: vi.fn(),
  signOutMock: vi.fn(),
  signUpMock: vi.fn(),
  trackAnalyticsEventMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}));

vi.mock("@/lib/analytics", () => ({
  clearAnalyticsContext: clearAnalyticsContextMock,
  clearAnalyticsUser: clearAnalyticsUserMock,
  trackAnalyticsEvent: trackAnalyticsEventMock,
}));

vi.mock("@/lib/monitoring", () => ({
  clearMonitoringUser: vi.fn(),
  setMonitoringUser: setMonitoringUserMock,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      mfa: {
        challengeAndVerify: challengeAndVerifyMock,
        getAuthenticatorAssuranceLevel: getAuthenticatorAssuranceLevelMock,
        listFactors: listFactorsMock,
      },
      onAuthStateChange: onAuthStateChangeMock,
      signInWithPassword: signInWithPasswordMock,
      signOut: signOutMock,
      signUp: signUpMock,
    },
  },
}));

const AuthConsumer = () => {
  const { signOut } = useAuth();

  return (
    <div>
      <button type="button" onClick={() => void signOut()}>
        Sign out locally
      </button>
      <button type="button" onClick={() => void signOut("others")}>
        Sign out others
      </button>
    </div>
  );
};

describe("AuthContext", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    getAuthenticatorAssuranceLevelMock.mockResolvedValue({
      data: {
        currentAuthenticationMethods: [],
        currentLevel: null,
        nextLevel: null,
      },
      error: null,
    });
    listFactorsMock.mockResolvedValue({
      data: { all: [], phone: [], totp: [] },
      error: null,
    });
    challengeAndVerifyMock.mockResolvedValue({ data: null, error: null });
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeMock } } });
    signInWithPasswordMock.mockReset();
    signOutMock.mockReset();
    signOutMock.mockResolvedValue({ error: null });
    signUpMock.mockReset();
    clearAnalyticsContextMock.mockReset();
    clearAnalyticsUserMock.mockReset();
    setMonitoringUserMock.mockReset();
    trackAnalyticsEventMock.mockReset();
    unsubscribeMock.mockReset();
  });

  it("uses a local sign-out scope by default", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out locally" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledWith({ scope: "local" });
    });
  });

  it("passes through scoped sign-out requests", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out others" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
    });
  });

  it("tracks and clears analytics state on a local sign out", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out locally" }));

    await waitFor(() => {
      expect(trackAnalyticsEventMock).toHaveBeenCalledWith("sign_out", { scope: "local" });
      expect(clearAnalyticsUserMock).toHaveBeenCalled();
      expect(clearAnalyticsContextMock).toHaveBeenCalled();
    });
  });
});
