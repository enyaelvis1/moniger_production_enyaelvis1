import {
  LayoutDashboard,
  FileText,
  Receipt,
  Building2,
  Users,
  UserRound,
  CreditCard,
  BarChart2,
  ShieldCheck,
  Settings,
  ChevronDown,
  Wallet,
  ArrowRightLeft,
  LogOut,
} from "lucide-react";
import { useRef, type KeyboardEvent, type MutableRefObject } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import { useWorkspaceSelection } from "@/contexts/WorkspaceSelectionContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const workspaceSubscription = useWorkspaceSubscription();
  const { setSelectedBusinessId } = useWorkspaceSelection();
  const { t } = useLocalization();
  const navigate = useNavigate();
  const displayName = user?.user_metadata?.name || user?.email || "";
  const initials = displayName
    .split(" ")
    .map((name) => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "DA";
  const profileAvatarUrl = settingsQuery.data?.profile?.avatar_url ?? null;
  const subscription = workspaceSubscription.subscription;
  const pendingSignupPlan = new URLSearchParams(location.search).get("signup_plan");
  const metadataSignupPlan = user?.user_metadata?.signup_plan;
  const hasPaidSignupIntent = [pendingSignupPlan, metadataSignupPlan].some((plan) => plan === "growth" || plan === "business");
  const isPaymentPending = hasPaidSignupIntent && !workspaceSubscription.entitlements.hasConfirmedPaidSubscription;
  const isWorkspaceLocked = isPaymentPending || Boolean(subscription && subscription.plan !== "starter" && !workspaceSubscription.entitlements.isActive);
  const planLabel = subscription?.plan
    ? subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
    : null;
  const planStatusLabel = subscription?.status === "trial"
    ? "Trial"
    : subscription?.status === "past_due"
      ? "Past due"
      : subscription?.status === "cancelled"
        ? "Cancelled"
        : subscription?.status === "expired"
          ? "Expired"
          : subscription?.status === "paused"
            ? "Paused"
            : "Active";
  const planBadgeClass = subscription?.status === "trial"
    ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
    : subscription?.plan === "business"
      ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/40 dark:text-violet-200"
      : subscription?.plan === "growth"
        ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
        : "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";
  const mainNav = [
    { title: t("navigation.dashboard"), url: "/dashboard", icon: LayoutDashboard, requiresActiveSubscription: false },
    { title: t("navigation.invoices"), url: "/invoices", icon: FileText, requiresActiveSubscription: true },
    { title: t("navigation.bills"), url: "/bills", icon: Receipt, requiresActiveSubscription: true },
    { title: t("navigation.vendors"), url: "/vendors", icon: Building2, requiresActiveSubscription: true },
    { title: t("navigation.customers"), url: "/customers", icon: Users, requiresActiveSubscription: true },
    { title: t("navigation.payments"), url: "/payments", icon: CreditCard, requiresActiveSubscription: true },
    { title: t("navigation.reports"), url: "/reports", icon: BarChart2, requiresActiveSubscription: true },
    { title: t("navigation.team"), url: "/team", icon: UserRound, requiresActiveSubscription: true },
    { title: t("navigation.auditTrail"), url: "/audit-trail", icon: ShieldCheck, requiresActiveSubscription: true },
  ];
  const financeNav = [
    { title: "Funding", url: "/wallet", icon: Wallet, requiresActiveSubscription: true },
    { title: "Marketplace Routing", url: "/marketplace-routing", icon: ArrowRightLeft, requiresActiveSubscription: true },
  ];
  const navRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const financeRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const footerRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeSettingsTab = new URLSearchParams(location.search).get("tab");
  const isLegacyTeamView = location.pathname === "/settings" && activeSettingsTab === "team";
  const isTeamView = location.pathname === "/team" || isLegacyTeamView;
  const isSettingsView = location.pathname === "/settings" && !isLegacyTeamView;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleArrowNavigation = (
    event: KeyboardEvent<HTMLAnchorElement>,
    index: number,
    refs: MutableRefObject<Array<HTMLAnchorElement | null>>,
  ) => {
    const lastIndex = refs.current.length - 1;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        refs.current[(index + 1) % refs.current.length]?.focus();
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        refs.current[(index - 1 + refs.current.length) % refs.current.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        refs.current[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        refs.current[lastIndex]?.focus();
        break;
      case " ":
        event.preventDefault();
        event.currentTarget.click();
        break;
    }
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border"
      aria-label="Primary sidebar"
    >
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-lg font-bold text-primary block">
              {collapsed ? "m" : t("common.appName")}
            </span>
            {!collapsed && (
              <div className="flex items-center gap-1 mt-0.5">
                {settingsQuery.data?.workspaces && settingsQuery.data.workspaces.length > 1 ? (
                  <label className="sr-only" htmlFor="workspace-selector">Switch workspace</label>
                ) : null}
                {settingsQuery.data?.workspaces && settingsQuery.data.workspaces.length > 1 ? (
                  <select
                    id="workspace-selector"
                    aria-label="Switch workspace"
                    value={settingsQuery.data.business?.id ?? ""}
                    onChange={(event) => setSelectedBusinessId(event.target.value)}
                    className="max-w-[170px] truncate bg-transparent text-xs text-muted-foreground outline-none"
                  >
                    {settingsQuery.data.workspaces.map((workspace) => (
                      <option key={workspace.business_id} value={workspace.business_id}>{workspace.name}</option>
                    ))}
                  </select>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground truncate">
                      {settingsQuery.data?.business?.name || user?.user_metadata?.business_name || t("navigation.workspaceFallback")}
                    </span>
                    <ChevronDown size={12} className="text-muted-foreground shrink-0" aria-hidden="true" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={`mt-3 flex items-center gap-2 ${collapsed ? "justify-center" : "min-w-0"}`}>
          <Avatar className="h-8 w-8">
            <AvatarImage src={profileAvatarUrl ?? undefined} alt={`${displayName || "Your"} profile photo`} />
            <AvatarFallback className="bg-[#5B67F7] text-white text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs text-muted-foreground">{displayName}</span>
              {subscription && planLabel ? (
                <Link
                  to="/subscription"
                  className={`mt-1 inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold leading-none transition-colors hover:brightness-95 ${planBadgeClass}`}
                  aria-label={`Current plan: ${planLabel}, ${planStatusLabel}. Open subscription management`}
                >
                  <span className="uppercase tracking-[0.08em] opacity-70">Plan</span>
                  <span className="truncate">{planLabel}</span>
                  <span className="opacity-70">· {planStatusLabel}</span>
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Primary navigation">
              <SidebarMenu>
              {mainNav.map((item, index) => {
                const active = item.url === "/team" ? isTeamView : location.pathname === item.url;
                const disabled = isWorkspaceLocked && item.requiresActiveSubscription;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <Link
                        ref={(element) => {
                          navRefs.current[index] = element;
                        }}
                        to={item.url}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-[#5B67F7] text-white shadow-[0_4px_12px_rgba(91,103,247,0.25)]"
                            : disabled
                              ? "cursor-not-allowed text-muted-foreground/45 opacity-50"
                              : "text-muted-foreground hover:bg-[#EEEDF8] dark:hover:bg-muted"
                        }`}
                        aria-label={collapsed ? item.title : undefined}
                        aria-current={active ? "page" : undefined}
                        aria-disabled={disabled ? "true" : undefined}
                        tabIndex={disabled ? -1 : undefined}
                        title={disabled ? "Complete subscription payment to unlock this workspace tab" : undefined}
                        onClick={(event) => {
                          if (disabled) event.preventDefault();
                        }}
                        onKeyDown={(event) => handleArrowNavigation(event, index, navRefs)}
                      >
                        <item.icon size={18} className="shrink-0" aria-hidden="true" />
                        {!collapsed && <span>{item.title}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed ? (
            <div className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Finance
            </div>
          ) : null}
          <SidebarGroupContent>
            <nav aria-label="Finance navigation">
              <SidebarMenu>
                {financeNav.map((item, index) => {
                  const active = location.pathname === item.url;
                  const disabled = isWorkspaceLocked && item.requiresActiveSubscription;

                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <Link
                          ref={(element) => {
                            financeRefs.current[index] = element;
                          }}
                          to={item.url}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                            active
                              ? "bg-[#5B67F7] text-white shadow-[0_4px_12px_rgba(91,103,247,0.25)]"
                              : disabled
                                ? "cursor-not-allowed text-muted-foreground/45 opacity-50"
                                : "text-muted-foreground hover:bg-[#EEEDF8] dark:hover:bg-muted"
                          }`}
                          aria-label={collapsed ? item.title : undefined}
                          aria-current={active ? "page" : undefined}
                          aria-disabled={disabled ? "true" : undefined}
                          tabIndex={disabled ? -1 : undefined}
                          title={disabled ? "Complete subscription payment to unlock this workspace tab" : undefined}
                          onClick={(event) => {
                            if (disabled) event.preventDefault();
                          }}
                          onKeyDown={(event) => handleArrowNavigation(event, index, financeRefs)}
                        >
                          <item.icon size={18} className="shrink-0" aria-hidden="true" />
                          {!collapsed && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <nav aria-label="Sidebar secondary navigation">
          <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link
                ref={(element) => {
                  footerRefs.current[0] = element;
                }}
                to="/settings"
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSettingsView
                    ? "bg-[#5B67F7] text-white shadow-[0_4px_12px_rgba(91,103,247,0.25)]"
                    : "text-muted-foreground hover:bg-[#EEEDF8] dark:hover:bg-muted"
                }`}
                aria-label={collapsed ? t("navigation.settings") : undefined}
                aria-current={isSettingsView ? "page" : undefined}
                onKeyDown={(event) => handleArrowNavigation(event, 0, footerRefs)}
              >
                <Settings size={18} className="shrink-0" aria-hidden="true" />
                {!collapsed && <span>{t("navigation.settings")}</span>}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="flex w-full items-center gap-3 rounded-lg bg-[#B42318] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#912018] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B42318] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-card"
                aria-label={t("header.accountMenu.signOut")}
                title={t("header.accountMenu.signOut")}
              >
                <LogOut size={18} className="shrink-0" aria-hidden="true" />
                {!collapsed && <span>{t("header.accountMenu.signOut")}</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          </SidebarMenu>
        </nav>
      </SidebarFooter>
    </Sidebar>
  );
}
