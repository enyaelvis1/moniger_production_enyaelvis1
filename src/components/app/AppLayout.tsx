import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/AppSidebar";
import AppHeader from "@/components/app/AppHeader";
import { useLocalization } from "@/hooks/use-localization";
import { SkipToMainContent } from "@/components/ui/accessibility";
import { LayoutDashboard, FileText, Building2, CreditCard, MoreHorizontal, Plus } from "lucide-react";
import { showDemoToast } from "@/lib/demo-toast";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import { useNetworkStatus } from "@/hooks/use-network-status";

const pageTitleKeys: Record<string, string> = {
  "/dashboard": "pages.dashboard",
  "/invoices": "pages.invoices",
  "/bills": "pages.bills",
  "/vendors": "pages.vendors",
  "/customers": "pages.customers",
  "/payments": "pages.payments",
  "/reports": "pages.reports",
  "/team": "pages.team",
  "/audit-trail": "pages.auditTrail",
  "/settings": "pages.settings",
};

const mobileNavItems = [
  { key: "navigation.dashboard", icon: LayoutDashboard, url: "/dashboard" },
  { key: "navigation.invoices", icon: FileText, url: "/invoices" },
  { key: "navigation.vendors", icon: Building2, url: "/vendors" },
  { key: "navigation.payments", icon: CreditCard, url: "/payments" },
  { key: "layout.mobileNav.more", icon: MoreHorizontal, url: "/settings" },
];

const getPageTitleKey = (pathname: string, search: string) => {
  if (pathname === "/wallet") {
    return "Workspace funding";
  }

  if (pathname === "/wallet/confirmed") {
    return "Workspace funding confirmed";
  }

  if (pathname === "/marketplace-routing") {
    return "Marketplace Routing";
  }

  if (pathname === "/team") {
    return "pages.team";
  }

  if (pathname === "/settings") {
    const settingsTab = new URLSearchParams(search).get("tab");
    return settingsTab === "team" ? "pages.team" : "pages.settings";
  }

  return pageTitleKeys[pathname] || "pages.dashboard";
};

const AppLayout = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { entitlements, isLoading: isSubscriptionLoading, subscription } = useWorkspaceSubscription();
  const { isOnline } = useNetworkStatus();
  const pageTitle = t(getPageTitleKey(location.pathname, location.search));
  const [fabOpen, setFabOpen] = useState(false);
  const quickActionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    setFabOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!fabOpen) {
      return;
    }

    quickActionRefs.current[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFabOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fabOpen]);

  return (
    <div className="min-h-screen bg-[#F3F4FB] dark:bg-background">
      <SkipToMainContent />
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <AppHeader pageTitle={pageTitle} />
            <main
              id="main-content"
              className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pb-28 page-enter sm:px-4 md:p-6 md:pb-6"
            >
              {!isOnline ? (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-amber-900 shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">You&apos;re offline</p>
                      <p className="mt-1 text-sm leading-6 text-amber-900/80">
                        Check your internet connection and try again when you&apos;re back online.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              ) : null}
              {!isSubscriptionLoading && subscription && entitlements.isPaidPlan && !entitlements.isActive ? (
                <div
                  className={`mb-4 rounded-2xl border px-4 py-4 shadow-sm ${
                    entitlements.isCancelled || subscription.status === "cancelled"
                      ? "border-[#FECACA] bg-[#FEF2F2] text-[#991B1B]"
                      : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {entitlements.isCancelled || subscription.status === "cancelled"
                          ? "Workspace subscription cancelled"
                          : "Workspace subscription needs attention"}
                      </p>
                      <p className="mt-1 text-sm leading-6 opacity-90">
                        {entitlements.isCancelled || subscription.status === "cancelled"
                          ? "Your workspace is on a cancelled plan. Renew or upgrade to restore paid-plan features."
                          : "A subscription payment needs attention, so paid-plan features are paused until billing is updated. Review pricing to restore access."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        to="/pricing"
                        className="inline-flex h-10 items-center justify-center rounded-full bg-white/80 px-4 text-sm font-semibold text-[#10203F] transition-colors hover:bg-white"
                      >
                        Review pricing
                      </Link>
                      <Link
                        to="/settings?tab=business"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-current/20 px-4 text-sm font-semibold transition-colors hover:bg-black/5"
                      >
                        Open settings
                      </Link>
                    </div>
                  </div>
                </div>
              ) : null}
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>

      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card border-t border-[#E0DFF0] dark:border-border z-50 flex items-center justify-around px-2 py-1.5 safe-area-bottom"
      >
        {mobileNavItems.map((item) => {
          const active = location.pathname === item.url;
          return (
            <button
              type="button"
              key={item.url}
              onClick={() => navigate(item.url)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                active ? "text-[#5B67F7]" : "text-[#94A3B8] dark:text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <item.icon size={20} aria-hidden="true" />
              <span className="text-[10px] font-medium">{t(item.key)}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile FAB */}
      <div className="md:hidden fixed bottom-20 right-4 z-50">
        {fabOpen && (
          <div
            id="mobile-quick-actions"
            role="group"
            aria-label="Quick actions"
            className="mb-3 flex flex-col gap-2 items-end animate-fade-in"
          >
            {[
              { label: "Fund workspace", action: () => navigate("/wallet?fund=1") },
              { label: t("layout.quickActions.newInvoice"), action: () => navigate("/invoices") },
              { label: t("layout.quickActions.payBill"), action: () => navigate("/bills") },
              { label: t("layout.quickActions.addVendor"), action: () => navigate("/vendors") },
            ].map((item, index) => (
              <button
                ref={(element) => {
                  quickActionRefs.current[index] = element;
                }}
                type="button"
                key={item.label}
                onClick={() => { item.action(); setFabOpen(false); }}
                className="bg-white dark:bg-card text-foreground text-sm font-medium px-4 py-2 rounded-xl shadow-[0_4px_16px_rgba(91,103,247,0.12)] border border-[#E0DFF0] dark:border-border btn-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setFabOpen(!fabOpen)}
          className={`w-14 h-14 rounded-full bg-[#5B67F7] text-white shadow-[0_8px_24px_rgba(91,103,247,0.35)] flex items-center justify-center btn-press transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2 ${fabOpen ? "rotate-45" : ""}`}
          aria-label={fabOpen ? t("layout.quickActions.close") : t("layout.quickActions.open")}
          aria-expanded={fabOpen}
          aria-controls="mobile-quick-actions"
        >
          <Plus size={24} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default AppLayout;
