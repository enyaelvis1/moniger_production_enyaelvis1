import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ResetPasswordPage from "@/pages/ResetPassword";

const {
  exchangeCodeForSessionMock,
  getSessionMock,
  setSessionMock,
} = vi.hoisted(() => ({
  exchangeCodeForSessionMock: vi.fn(),
  getSessionMock: vi.fn(),
  setSessionMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      exchangeCodeForSession: exchangeCodeForSessionMock,
      getSession: getSessionMock,
      setSession: setSessionMock,
      updateUser: vi.fn(),
    },
  },
}));

const renderPage = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password/confirmed" element={<div>Password updated</div>} />
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/forgot-password" element={<div>Forgot password</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ResetPasswordPage", () => {
  const replaceStateSpy = vi.spyOn(window.history, "replaceState");

  beforeEach(() => {
    exchangeCodeForSessionMock.mockReset();
    exchangeCodeForSessionMock.mockResolvedValue({ error: null });
    getSessionMock.mockReset();
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: "user-1" } } }, error: null });
    setSessionMock.mockReset();
    setSessionMock.mockResolvedValue({ error: null });
    replaceStateSpy.mockClear();
  });

  afterEach(() => {
    replaceStateSpy.mockClear();
  });

  it("scrubs the recovery code from the browser url after exchanging the session", async () => {
    renderPage("/reset-password?code=recovery-code");

    await waitFor(() => {
      expect(exchangeCodeForSessionMock).toHaveBeenCalledWith("recovery-code");
    });

    await screen.findByRole("button", { name: /update password/i });

    expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, document.title, "/reset-password");
  });

  it("scrubs access and refresh tokens from the browser url after restoring the session from the hash", async () => {
    renderPage("/reset-password#access_token=access-token&refresh_token=refresh-token");

    await waitFor(() => {
      expect(setSessionMock).toHaveBeenCalledWith({
        access_token: "access-token",
        refresh_token: "refresh-token",
      });
    });

    await screen.findByRole("button", { name: /update password/i });

    expect(replaceStateSpy).toHaveBeenCalledWith(window.history.state, document.title, "/reset-password");
  });
});
