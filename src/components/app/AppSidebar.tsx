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
} from "lucide-react";
import { useRef, type KeyboardEvent, type MutableRefObject } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLocalization } from "@/hooks/use-localization";
import { useSettingsData } from "@/hooks/use-settings-data";
import { useWorkspaceSelection } from "@/contexts/WorkspaceSelectionContext";
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
  const { user } = useAuth();
  const settingsQuery = useSettingsData(user?.id);
  const { setSelectedBusinessId } = useWorkspaceSelection();
  const { t } = useLocalization();
  const mainNav = [
    { title: t("navigation.dashboard"), url: "/dashboard", icon: LayoutDashboard },
    { title: t("navigation.invoices"), url: "/invoices", icon: FileText },
    { title: t("navigation.bills"), url: "/bills", icon: Receipt },
    { title: t("navigation.vendors"), url: "/vendors", icon: Building2 },
    { title: t("navigation.customers"), url: "/customers", icon: Users },
    { title: t("navigation.payments"), url: "/payments", icon: CreditCard },
    { title: t("navigation.reports"), url: "/reports", icon: BarChart2 },
    { title: t("navigation.team"), url: "/team", icon: UserRound },
    { title: t("navigation.auditTrail"), url: "/audit-trail", icon: ShieldCheck },
  ];
  const financeNav = [
    { title: "Funding", url: "/wallet", icon: Wallet },
    { title: "Marketplace Routing", url: "/marketplace-routing", icon: ArrowRightLeft },
  ];
  const navRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const financeRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const footerRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeSettingsTab = new URLSearchParams(location.search).get("tab");
  const isLegacyTeamView = location.pathname === "/settings" && activeSettingsTab === "team";
  const isTeamView = location.pathname === "/team" || isLegacyTeamView;
  const isSettingsView = location.pathname === "/settings" && !isLegacyTeamView;

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
      </div>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <nav aria-label="Primary navigation">
              <SidebarMenu>
              {mainNav.map((item, index) => {
                const active = item.url === "/team" ? isTeamView : location.pathname === item.url;
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
                            : "text-muted-foreground hover:bg-[#EEEDF8] dark:hover:bg-muted"
                        }`}
                        aria-label={collapsed ? item.title : undefined}
                        aria-current={active ? "page" : undefined}
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
                              : "text-muted-foreground hover:bg-[#EEEDF8] dark:hover:bg-muted"
                          }`}
                          aria-label={collapsed ? item.title : undefined}
                          aria-current={active ? "page" : undefined}
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
          </SidebarMenu>
        </nav>
      </SidebarFooter>
    </Sidebar>
  );
}
