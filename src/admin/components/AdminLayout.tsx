import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  FileText,
  Menu,
  Search,
  BellRing,
  Settings,
  Users,
  X,
  ArrowLeftRight,
  MoonStar,
  SunMedium,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { useAdminAccess } from "@/admin/components/AdminRoute";

type AdminNavItem = {
  icon: typeof LayoutDashboard;
  label: string;
  to: string;
};

type AdminNavSection = {
  items: AdminNavItem[];
  label: string;
};

const ADMIN_NAV: AdminNavSection[] = [
  {
    label: "OVERVIEW",
    items: [
      { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
      { label: "Platform Metrics", to: "/admin/metrics", icon: BarChart3 },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { label: "Businesses", to: "/admin/businesses", icon: Building2 },
          { label: "Banks", to: "/admin/banks", icon: CreditCard },
          { label: "Categories", to: "/admin/categories", icon: ClipboardList },
      { label: "Users", to: "/admin/users", icon: Users },
      { label: "Subscriptions", to: "/admin/subscriptions", icon: CreditCard },
      { label: "Payments", to: "/admin/payments", icon: ArrowLeftRight },
      { label: "Payouts", to: "/admin/payouts", icon: ArrowLeftRight },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { label: "Announcements", to: "/admin/announcements", icon: Megaphone },
      { label: "Public Content", to: "/admin/content", icon: FileText },
      { label: "Signup Alerts", to: "/admin/signup-alerts", icon: BellRing },
      { label: "Support Lookup", to: "/admin/support", icon: Search },
      { label: "Audit Log", to: "/admin/audit", icon: ClipboardList },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { label: "Settings", to: "/admin/settings", icon: Settings },
      { label: "Health Monitor", to: "/admin/health", icon: Activity },
    ],
  },
];

const routeMeta: Record<string, { breadcrumb: string[]; page: string }> = {
  "/admin": { breadcrumb: ["Overview"], page: "Dashboard" },
  "/admin/metrics": { breadcrumb: ["Overview"], page: "Platform Metrics" },
  "/admin/businesses": { breadcrumb: ["Management"], page: "Businesses" },
  "/admin/banks": { breadcrumb: ["Management"], page: "Banks" },
  "/admin/categories": { breadcrumb: ["Management"], page: "Bill categories" },
  "/admin/users": { breadcrumb: ["Management"], page: "Users" },
  "/admin/subscriptions": { breadcrumb: ["Management"], page: "Subscriptions" },
  "/admin/payments": { breadcrumb: ["Management"], page: "Payments" },
  "/admin/payouts": { breadcrumb: ["Management"], page: "Payouts" },
  "/admin/announcements": { breadcrumb: ["Operations"], page: "Announcements" },
  "/admin/content": { breadcrumb: ["Operations"], page: "Public Content" },
  "/admin/signup-alerts": { breadcrumb: ["Operations"], page: "Signup Alerts" },
  "/admin/support": { breadcrumb: ["Operations"], page: "Support Lookup" },
  "/admin/audit": { breadcrumb: ["Operations"], page: "Audit Log" },
  "/admin/health": { breadcrumb: ["System"], page: "Health Monitor" },
  "/admin/settings": { breadcrumb: ["System"], page: "Settings" },
};

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const adminEnvironment = (import.meta.env.VITE_SENTRY_ENVIRONMENT?.trim() || import.meta.env.MODE || "unknown").toLowerCase();
const adminEnvironmentLabel = adminEnvironment.charAt(0).toUpperCase() + adminEnvironment.slice(1);
const adminEnvironmentClass = adminEnvironment === "production"
  ? "border-[#F97066]/25 bg-[#F97066]/10 text-[#F97066]"
  : adminEnvironment === "staging"
    ? "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#B45309]"
    : "border-[#3B82F6]/25 bg-[#3B82F6]/10 text-[#3B82F6]";

const getRouteMeta = (pathname: string) => {
  if (pathname.startsWith("/admin/businesses/") && pathname.endsWith("/invoices")) {
    return { breadcrumb: ["Management", "Businesses"], page: "Business Invoices" };
  }

  return routeMeta[pathname] ?? { breadcrumb: ["Overview"], page: "Dashboard" };
};

const SidebarContent = ({ closeMobile, isDark }: { closeMobile?: () => void; isDark: boolean }) => {
  const { user } = useAuth();
  const adminAccess = useAdminAccess();
  const displayName = user?.user_metadata?.name || user?.email || "Moniger Admin";
  const initials = getInitials(displayName);

  return (
    <div className={cn("flex h-full flex-col", isDark ? "bg-[#0A1020] text-[#F1F5F9]" : "bg-[#F8FAFF] text-[#10203F]")}>
      <div className="px-5 pt-6">
        <Link to="/admin" onClick={closeMobile}>
          <p className={cn("text-[14px] font-bold tracking-[0.15em]", isDark ? "text-[#3B82F6]" : "text-[#4154D8]")}>MONIGER</p>
          <p className={cn("mt-1 text-[11px] tracking-[0.1em]", isDark ? "text-white/35" : "text-[#6B7693]")}>Admin Console</p>
        </Link>
        <div className={cn("mt-4 border-t pt-4", isDark ? "border-white/5" : "border-[#E3E6F2]")}>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3B82F6,#6366F1)] text-[11px] font-semibold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className={cn("truncate text-[13px] font-medium", isDark ? "text-[#F1F5F9]" : "text-[#10203F]")}>{displayName}</p>
              <span className="mt-1 inline-flex rounded-full bg-[#3B82F6]/15 px-2 py-0.5 text-[10px] text-[#3B82F6]">
                {adminAccess.role === "super_admin" ? "Super Admin" : "Support"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        {ADMIN_NAV.map((section) => (
          <div key={section.label} className="mb-4">
            <p className={cn("px-5 pb-1 text-[10px] uppercase tracking-[0.12em]", isDark ? "text-white/30" : "text-[#8E97B7]")}>{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/admin"}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    cn(
                      "mx-2 flex items-center gap-2.5 rounded-md px-3 py-2 pl-5 text-[13px] font-normal transition-all duration-150",
                      isDark
                        ? "text-white/55 hover:bg-white/5 hover:text-white/85"
                        : "text-[#5F6A88] hover:bg-[#EEF2FF] hover:text-[#10203F]",
                      isActive && "border-l-2 border-[#3B82F6] bg-[#3B82F6]/12 pl-[18px] text-[#3B82F6]",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <item.icon
                        size={16}
                        className={cn(isDark ? "text-white/35" : "text-[#94A3B8]", isActive && "text-[#3B82F6]")}
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={cn("border-t px-5 py-4", isDark ? "border-white/5" : "border-[#E3E6F2]")}>
        <Link
          to="/dashboard"
          className={cn("inline-flex items-center gap-2 text-[12px] transition-colors", isDark ? "text-white/35 hover:text-white/60" : "text-[#6B7693] hover:text-[#10203F]")}
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to App
        </Link>
      </div>
    </div>
  );
};

const AdminLayout = () => {
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayName = user?.user_metadata?.name || user?.email || "Moniger Admin";
  const initials = getInitials(displayName);
  const meta = getRouteMeta(location.pathname);
  const lightModeOverrides = `
    .admin-light .text-white { color: #10203f !important; }
    .admin-light .text-white\\/85 { color: #1f335f !important; }
    .admin-light .text-white\\/80 { color: #243b6b !important; }
    .admin-light .text-white\\/70 { color: #39517f !important; }
    .admin-light .text-white\\/60 { color: #53627f !important; }
    .admin-light .text-white\\/55 { color: #5f6a88 !important; }
    .admin-light .text-white\\/50 { color: #667085 !important; }
    .admin-light .text-white\\/45 { color: #6b7693 !important; }
    .admin-light .text-white\\/40 { color: #8e97b7 !important; }
    .admin-light .text-white\\/35 { color: #9ca6c2 !important; }
    .admin-light .text-white\\/30 { color: #b2bdd6 !important; }
    .admin-light .text-white\\/20 { color: #c9d3e8 !important; }
    .admin-light .bg-\\[\\#0F1621\\],
    .admin-light .bg-\\[\\#111927\\],
    .admin-light .bg-\\[\\#161E2E\\] {
      background-color: #ffffff !important;
      color: #10203f !important;
    }
    .admin-light .bg-white\\/5 { background-color: #f5f7ff !important; }
    .admin-light .bg-white\\/10 { background-color: #eef2ff !important; }
    .admin-light .hover\\:bg-white\\/5:hover { background-color: #f5f7ff !important; }
    .admin-light .hover\\:bg-white\\/10:hover { background-color: #eef2ff !important; }
    .admin-light .hover\\:text-white:hover { color: #10203f !important; }
    .admin-light .border-white\\/5 { border-color: #dce2f2 !important; }
    .admin-light .border-white\\/10 { border-color: #dce2f2 !important; }
    .admin-light .border-white\\/20 { border-color: #c9d3e8 !important; }
    .admin-light .placeholder\\:text-white\\/30::placeholder { color: #9ca6c2 !important; }
  `;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className={cn("admin-shell min-h-screen font-sans", isDark ? "admin-dark bg-[#0F1621] text-[#F1F5F9]" : "admin-light bg-[#F5F7FF] text-[#10203F]")}>
      {!isDark ? <style>{lightModeOverrides}</style> : null}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/5 md:block">
        <SidebarContent isDark={isDark} />
      </aside>

      <div className="min-h-screen md:ml-64">
        <header
          className={cn(
            "sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4 backdrop-blur-xl md:px-7",
            isDark ? "border-white/5 bg-[rgba(15,22,33,0.8)]" : "border-[#DCE2F2] bg-[rgba(245,247,255,0.88)]",
          )}
        >
          <div className="flex items-center gap-3">
            {isMobile ? (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors",
                  isDark
                    ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    : "border-[#DCE2F2] bg-white text-[#64748B] hover:bg-[#F5F7FF] hover:text-[#10203F]",
                )}
                aria-label="Open admin navigation"
              >
                <Menu size={18} aria-hidden="true" />
              </button>
            ) : null}
            <nav className="hidden items-center gap-2 text-[13px] md:flex" aria-label="Breadcrumb">
              {meta.breadcrumb.map((segment) => (
                <span key={segment} className={cn(isDark ? "text-white/40" : "text-[#6B7693]")}>
                  {segment}
                </span>
              ))}
              <span className={cn(isDark ? "text-white/20" : "text-[#C0C7D9]")}>/</span>
              <span className={cn("font-medium", isDark ? "text-white" : "text-[#10203F]")}>{meta.page}</span>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn("hidden items-center gap-2 rounded-full border px-3 py-1 text-[12px] sm:flex", adminEnvironmentClass)} aria-label={`Admin environment: ${adminEnvironmentLabel}`}>
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              Environment: {adminEnvironmentLabel}
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isDark ? "text-white/50 hover:bg-white/5 hover:text-white" : "text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#10203F]",
              )}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-pressed={isDark}
            >
              {isDark ? <SunMedium size={18} aria-hidden="true" /> : <MoonStar size={18} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isDark ? "text-white/50 hover:bg-white/5 hover:text-white" : "text-[#64748B] hover:bg-[#EEF2FF] hover:text-[#10203F]",
              )}
              aria-label="View admin notifications"
            >
              <Bell size={18} aria-hidden="true" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#3B82F6,#6366F1)] text-[11px] font-semibold text-white"
              aria-label="Open admin account menu"
            >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate("/admin/settings")}>View Profile</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    void signOut().finally(() => navigate("/login", { replace: true }));
                  }}
                >
                  Sign out of Admin
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/dashboard")}>Back to App</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className={cn("p-4 md:p-7", isDark ? "" : "bg-[#F5F7FF]")}>
          <Outlet />
        </main>
      </div>

      <Drawer open={mobileOpen} onOpenChange={setMobileOpen}>
        <DrawerContent
          className={cn(
            "max-h-[88vh] rounded-t-[24px]",
            isDark ? "border-white/10 bg-[#0A1020] text-[#F1F5F9]" : "border-[#DCE2F2] bg-white text-[#10203F]",
          )}
        >
          <div className="flex items-center justify-between px-5 pt-2">
            <DrawerTitle className={cn("text-sm font-semibold tracking-[0.1em]", isDark ? "text-white/60" : "text-[#6B7693]")}>ADMIN NAVIGATION</DrawerTitle>
            <DrawerClose className={cn("inline-flex h-9 w-9 items-center justify-center rounded-full", isDark ? "border border-white/10 bg-white/5 text-white/70" : "border border-[#DCE2F2] bg-[#F8FAFF] text-[#64748B]")}>
              <X size={16} aria-hidden="true" />
            </DrawerClose>
          </div>
          <div className="mt-2 h-[70vh] overflow-y-auto">
            <SidebarContent closeMobile={() => setMobileOpen(false)} isDark={isDark} />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AdminLayout;
