import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "@/pages/Register";
import { getRegistrationDestination } from "@/lib/subscription-registration";

const { signUpMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signUp: signUpMock }),
}));

vi.mock("@/hooks/use-localization", () => ({
  useLocalization: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/components/auth/AuthShell", () => ({
  default: ({ cardHeader, children }: { cardHeader: ReactNode; children: ReactNode }) => (
    <main>
      {cardHeader}
      {children}
    </main>
  ),
  AuthCardHeader: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  ),
  authInputClassName: "",
  authLabelClassName: "",
  authPrimaryButtonClassName: "",
  authSecondaryButtonClassName: "",
}));

const renderPage = (initialEntry: string) =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <RegisterPage />
    </MemoryRouter>,
  );

afterEach(() => {
  sessionStorage.clear();
});

describe("RegisterPage plan summary", () => {
  it("continues paid registrations into Paystack intent checkout", () => {
    expect(getRegistrationDestination(null, "growth")).toBe("/pricing?billingCycle=monthly&subscribe=growth");
    expect(getRegistrationDestination("/dashboard", "business")).toBe("/pricing?billingCycle=monthly&subscribe=business");
    expect(getRegistrationDestination("/pricing?subscribe=growth", "growth")).toBe("/pricing?subscribe=growth");
    expect(getRegistrationDestination("/dashboard", "starter")).toBe("/dashboard");
  });

  it.each([
    ["/register", "Starter", "Free plan"],
    ["/register?next=%2Fpricing%3Fsubscribe%3Dgrowth", "Growth", "NGN 29,000/mo"],
    ["/register?subscribe=business", "Business", "NGN 89,000/mo"],
  ])("shows the selected %s plan and price", (path, plan, price) => {
    renderPage(path);

    expect(screen.getAllByText("Selected plan").length).toBeGreaterThan(0);
    expect(screen.getByText(plan)).toBeInTheDocument();
    expect(screen.getAllByText(price).length).toBeGreaterThan(0);
  });

  it("moves to account setup immediately when a customer chooses a paid plan", () => {
    renderPage("/register");

    fireEvent.click(screen.getAllByRole("button", { name: "Choose business plan and continue" })[0]);

    expect(screen.getByLabelText("auth.register.businessName")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.register.fullName")).toBeInTheDocument();
    expect(screen.getByText("Business")).toBeInTheDocument();
  });

  it("lets the customer go back and change the plan", () => {
    renderPage("/register");

    fireEvent.click(screen.getAllByRole("button", { name: "Choose business plan and continue" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "auth.register.back" }));

    expect(screen.getAllByRole("button", { name: "Choose starter plan and continue" })[0]).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Choose starter plan and continue" })[0]);
    expect(screen.getByLabelText("auth.register.businessName")).toBeInTheDocument();
    expect(screen.getAllByText("Starter").length).toBeGreaterThan(0);
  });

  it("restores pending email verification after a page refresh", () => {
    sessionStorage.setItem(
      "moniger.signup.email-otp.pending.v1",
      JSON.stringify({
        email: "ada@example.com",
        destination: "/dashboard",
        resendAvailableAt: Date.now() + 30_000,
        expiresAt: Date.now() + 60_000,
      }),
    );

    renderPage("/register");

    expect(screen.getByLabelText("auth.register.emailOtp.codeLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auth.register.emailOtp.verifyAndContinue/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Continue with Starter" })).not.toBeInTheDocument();
  });

  it("advances to login details and returns to business details with Back", () => {
    renderPage("/register");

    fireEvent.click(screen.getAllByRole("button", { name: "Choose starter plan and continue" })[0]);
    fireEvent.change(screen.getByLabelText("auth.register.businessName"), { target: { value: "Acme Ltd" } });
    fireEvent.change(screen.getByLabelText("auth.register.fullName"), { target: { value: "Ada Lovelace" } });
    fireEvent.click(screen.getByRole("button", { name: "auth.register.next" }));

    expect(screen.getByLabelText("auth.register.workEmail")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "auth.register.back" }));

    expect(screen.getByLabelText("auth.register.businessName")).toHaveValue("Acme Ltd");
    expect(screen.getByLabelText("auth.register.fullName")).toHaveValue("Ada Lovelace");
  });
});
