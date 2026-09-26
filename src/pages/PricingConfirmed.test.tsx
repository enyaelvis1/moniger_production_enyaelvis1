import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PricingConfirmedPage from "@/pages/PricingConfirmed";

const {
  getWorkspaceSubscriptionConfirmationStatusMock,
  useSupabaseSessionMock,
  verifyWorkspaceSubscriptionCheckoutMock,
} = vi.hoisted(() => ({
  getWorkspaceSubscriptionConfirmationStatusMock: vi.fn(),
  useSupabaseSessionMock: vi.fn(),
  verifyWorkspaceSubscriptionCheckoutMock: vi.fn(),
}));

vi.mock("@/hooks/use-supabase-session", () => ({
  useSupabaseSession: useSupabaseSessionMock,
}));

vi.mock("@/lib/workspace-subscriptions", () => ({
  getWorkspaceSubscriptionConfirmationStatus: getWorkspaceSubscriptionConfirmationStatusMock,
  verifyWorkspaceSubscriptionCheckout: verifyWorkspaceSubscriptionCheckoutMock,
}));

const renderPage = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/pricing/confirmed" element={<PricingConfirmedPage />} />
            <Route path="/pricing" element={<div>Pricing</div>} />
            <Route path="/dashboard" element={<div>Dashboard</div>} />
            <Route path="/login" element={<div>Login</div>} />
            <Route path="/admin/subscriptions" element={<div>Admin subscriptions</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  };
};

describe("PricingConfirmedPage", () => {
  beforeEach(() => {
    getWorkspaceSubscriptionConfirmationStatusMock.mockReset();
    verifyWorkspaceSubscriptionCheckoutMock.mockReset();
    useSupabaseSessionMock.mockReset();
  });

  it("uses the public confirmation flow for signed-out visitors and keeps workspace details hidden", async () => {
    useSupabaseSessionMock.mockReturnValue({
      isSessionLoading: false,
      session: null,
    });
    getWorkspaceSubscriptionConfirmationStatusMock.mockResolvedValue({
      confirmation: {
        billingCycle: "monthly",
        plan: "growth",
        reference: "SUB-123",
        status: "completed",
      },
      kind: "public_status",
      ok: true,
    });

    renderPage("/pricing/confirmed?reference=SUB-123");

    await waitFor(() => {
      expect(getWorkspaceSubscriptionConfirmationStatusMock).toHaveBeenCalledWith({ reference: "SUB-123" });
    });

    expect(verifyWorkspaceSubscriptionCheckoutMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/payment was successful/i)).toBeInTheDocument();
    expect(screen.getByText(/your paystack payment was received/i)).toBeInTheDocument();
    expect(screen.queryByText(/Acme Workspace/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /continue to dashboard/i })).toBeInTheDocument();
  });

  it("uses the signed-in verification flow and shows workspace details only for authenticated users", async () => {
    useSupabaseSessionMock.mockReturnValue({
      isSessionLoading: false,
      session: { access_token: "token" },
    });
    verifyWorkspaceSubscriptionCheckoutMock.mockResolvedValue({
      kind: "verified",
      ok: true,
      subscription: {
        amount: 29000,
        billingCycle: "monthly",
        businessId: "business-1",
        businessName: "Acme Workspace",
        nextRenewalAt: "2026-06-21T00:00:00.000Z",
        plan: "growth",
        provider: "paystack",
        reference: "SUB-123",
        status: "active",
      },
    });

    const { queryClient } = renderPage("/pricing/confirmed?reference=SUB-123");
    queryClient.setQueryData(["workspace-subscription", "business-1"], { plan: "starter" });

    await waitFor(() => {
      expect(verifyWorkspaceSubscriptionCheckoutMock).toHaveBeenCalledWith({ reference: "SUB-123" });
    });

    expect(getWorkspaceSubscriptionConfirmationStatusMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.queryByText(/subscription confirmed/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(queryClient.getQueryData(["workspace-subscription", "business-1"])).toBeUndefined();
    });
  });

  it("retries a delayed provider response and only redirects after verification succeeds", async () => {
    useSupabaseSessionMock.mockReturnValue({
      isSessionLoading: false,
      session: { access_token: "token" },
    });
    verifyWorkspaceSubscriptionCheckoutMock
      .mockRejectedValueOnce(Object.assign(new Error("Payment verification is still pending"), { code: "CHECKOUT_PENDING", retryable: true }))
      .mockRejectedValueOnce(Object.assign(new Error("Payment verification is still pending"), { code: "CHECKOUT_PENDING", retryable: true }))
      .mockResolvedValueOnce({
        kind: "verified",
        ok: true,
        subscription: {
          amount: 89000,
          billingCycle: "monthly",
          businessId: "business-1",
          businessName: "Acme Workspace",
          nextRenewalAt: "2026-06-21T00:00:00.000Z",
          plan: "business",
          provider: "paystack",
          reference: "SUB-DELAYED",
          status: "active",
        },
      });

    renderPage("/pricing/confirmed?reference=SUB-DELAYED");

    await waitFor(() => {
      expect(verifyWorkspaceSubscriptionCheckoutMock).toHaveBeenCalledTimes(3);
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    }, { timeout: 10000 });

  }, 10000);
});
