import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { configureAxe } from "vitest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppSidebar } from "@/components/app/AppSidebar";
import NotificationCenter from "@/components/app/NotificationCenter";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    loading: false,
    session: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    user: {
      email: "ada@example.com",
      user_metadata: {
        business_name: "Moniger Labs",
        name: "Ada Lovelace",
      },
    },
  }),
}));

vi.mock("@/hooks/use-notifications-data", () => ({
  useNotificationMutations: () => ({
    markAllAsRead: { isPending: false, mutateAsync: vi.fn() },
    markAsRead: { isPending: false, mutateAsync: vi.fn() },
  }),
  useNotificationsData: () => ({
    data: [],
    error: null,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-localization", () => ({
  useLocalization: () => ({
    t: (key: string) =>
      (
        {
          "common.appName": "moniger.net",
          "navigation.auditTrail": "Audit Trail",
          "navigation.bills": "Bills",
          "navigation.customers": "Customers",
          "navigation.dashboard": "Dashboard",
          "navigation.invoices": "Invoices",
          "notifications.center.allCaughtUp": "All caught up",
          "notifications.center.empty.allDescription":
            "Invoice, payment, report, and team updates will appear here as your workspace changes.",
          "notifications.center.empty.allTitle": "No notifications yet",
          "notifications.center.markAllRead": "Mark all read",
          "navigation.payments": "Payments",
          "navigation.reports": "Reports",
          "navigation.settings": "Settings",
          "navigation.team": "Team",
          "navigation.vendors": "Vendors",
          "notifications.center.title": "Notifications",
          "notifications.center.triggerLabel": "View notifications",
          "navigation.workspaceFallback": "My Business",
        } as Record<string, string>
      )[key] ?? key,
    formatRelativeTime: () => "just now",
  }),
}));

const axe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
});

describe("accessibility smoke coverage", () => {
  afterEach(() => {
    cleanup();
  });

  it("has no axe violations for the primary sidebar when Team is active", async () => {
    const queryClient = new QueryClient();

    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/team"]}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Team" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current", "page");
    expect((await axe(container)).violations).toHaveLength(0);
  }, 15000);

  it("has no axe violations for the notification center empty state", async () => {
    render(
      <MemoryRouter>
        <NotificationCenter businessId="business-1" userId="user-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View notifications" }));

    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    expect((await axe(document.body)).violations).toHaveLength(0);
  }, 15000);

  it("has no axe violations for the command dialog surface", async () => {
    render(
      <CommandDialog open onOpenChange={() => {}} title="Global command palette" description="Search and navigate">
        <CommandInput aria-label="Search workspace" placeholder="Search workspace" />
        <CommandList>
          <CommandGroup heading="Jump To">
            <CommandItem value="Dashboard">Dashboard</CommandItem>
          </CommandGroup>
          <CommandEmpty>Nothing matched your search.</CommandEmpty>
        </CommandList>
      </CommandDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Global command palette" })).toBeInTheDocument();
    expect((await axe(document.body)).violations).toHaveLength(0);
  });
});
