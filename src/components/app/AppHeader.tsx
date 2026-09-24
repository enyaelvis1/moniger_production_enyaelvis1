import { useState } from "react";
import { Home, LogOut, RefreshCw, Settings, Shield, User, Moon, Sun, Wallet } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspaceSelection } from "@/contexts/WorkspaceSelectionContext";
import { useLocalization } from "@/hooks/use-localization";
import NotificationCenter from "@/components/app/NotificationCenter";
import SearchBar from "@/components/app/SearchBar";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsData, useWorkspaceWalletData } from "@/hooks/use-settings-data";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const AppHeader = ({ pageTitle }: { pageTitle: string }) => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { formatCurrency, t } = useLocalization();
  const settingsQuery = useSettingsData(user?.id);
  const { setSelectedBusinessId } = useWorkspaceSelection();
  const workspaceWalletQuery = useWorkspaceWalletData(settingsQuery.data?.business?.id);
  const { adminAccess } = useAdminAccess(user?.id);
  const navigate = useNavigate();
  const businessId = settingsQuery.data?.business?.id;
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const walletCurrency = workspaceWalletQuery.data?.currency ?? settingsQuery.data?.business?.default_currency ?? "NGN";
  const walletAvailableBalance = formatCurrency(workspaceWalletQuery.data?.available_balance ?? 0, walletCurrency);
  const walletChipLabel = workspaceWalletQuery.isLoading
    ? "Loading funding..."
    : workspaceWalletQuery.error
      ? "Funding unavailable"
      : walletAvailableBalance;

  const displayName = user?.user_metadata?.name || user?.email || "";
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "DA";

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="h-14 min-w-0 overflow-hidden border-b border-[#E0DFF0] bg-white dark:border-border dark:bg-card flex items-center justify-between px-3 sm:px-4 md:px-6 shrink-0">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarTrigger
          className="text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t("header.toggleSidebar")}
        />
        <h1 className="min-w-0 truncate text-base font-bold text-[#0D1B2A] dark:text-primary sm:text-lg md:text-2xl">
          {pageTitle}
        </h1>
        {settingsQuery.data?.workspaces && settingsQuery.data.workspaces.length > 1 ? (
          <>
            <label className="sr-only" htmlFor="mobile-workspace-selector">Switch workspace</label>
            <select
              id="mobile-workspace-selector"
              aria-label="Switch workspace"
              value={settingsQuery.data.business?.id ?? ""}
              onChange={(event) => setSelectedBusinessId(event.target.value)}
              className="max-w-[112px] truncate rounded-lg border border-[#E0DFF0] bg-white px-2 py-1.5 text-xs font-medium text-[#0D1B2A] outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-border dark:bg-card dark:text-foreground md:hidden"
            >
              {settingsQuery.data.workspaces.map((workspace) => (
                <option key={workspace.business_id} value={workspace.business_id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden sm:gap-2">
        <Link
          to="/"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E0DFF0] bg-white/90 px-3 text-sm font-medium text-[#0D1B2A] shadow-sm transition-colors hover:bg-[#F8F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border dark:bg-card dark:text-foreground max-[480px]:hidden"
          aria-label={t("header.homeLink")}
        >
          <Home size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t("navigation.home")}</span>
        </Link>

        {businessId ? (
          <Link
            to="/wallet"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D9EAFB] bg-[#F8FBFF] px-3 text-sm font-medium text-[#0F172A] shadow-sm transition-colors hover:bg-[#EEF7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2 dark:border-border dark:bg-card dark:text-foreground max-[480px]:hidden"
            aria-label={`Workspace funding balance ${walletChipLabel}`}
          >
            <Wallet size={16} aria-hidden="true" className="text-[#0284C7]" />
            <span className="hidden xl:inline">Funding</span>
            <span className="font-semibold text-[#0284C7] max-[480px]:text-xs">{walletChipLabel}</span>
          </Link>
        ) : null}

        {adminAccess ? (
          <Link
            to="/admin"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E0DFF0] bg-white/90 px-3 text-sm font-medium text-[#0D1B2A] shadow-sm transition-colors hover:bg-[#F8F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border dark:bg-card dark:text-foreground max-[520px]:hidden"
            aria-label="Open admin dashboard"
          >
            <Settings size={16} aria-hidden="true" />
            <span className="hidden xl:inline">Admin</span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={handleRefresh}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E0DFF0] bg-white/90 px-3 text-sm font-medium text-[#0D1B2A] shadow-sm transition-colors hover:bg-[#F8F8FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 dark:border-border dark:bg-card dark:text-foreground"
          aria-label="Refresh page"
          title="Refresh page"
        >
          <RefreshCw size={16} aria-hidden="true" />
          <span className="hidden sm:inline">Refresh</span>
        </button>

        <div className="hidden lg:block">
          <SearchBar businessId={businessId} />
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg p-2 text-muted-foreground transition-colors btn-press hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={theme === "dark" ? t("header.theme.switchToLight") : t("header.theme.switchToDark")}
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? (
            <Sun size={18} aria-hidden="true" />
          ) : (
            <Moon size={18} aria-hidden="true" />
          )}
        </button>

        <div className="hidden sm:block">
          <NotificationCenter businessId={businessId} userId={user?.id} />
        </div>

        <DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="w-8 h-8 rounded-full bg-[#5B67F7] text-white text-xs font-semibold flex items-center justify-center hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B67F7] focus-visible:ring-offset-2"
              aria-label={t("header.accountMenu.open")}
              aria-controls="account-menu"
              aria-expanded={accountMenuOpen}
              aria-haspopup="menu"
            >
              {initials}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent id="account-menu" align="end" className="w-48">
            <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
              <User size={14} aria-hidden="true" /> {t("header.accountMenu.profile")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")} className="gap-2 cursor-pointer">
              <Settings size={14} aria-hidden="true" /> {t("header.accountMenu.settings")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings?tab=security")} className="gap-2 cursor-pointer">
              <Shield size={14} aria-hidden="true" /> {t("header.accountMenu.security")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive">
              <LogOut size={14} aria-hidden="true" /> {t("header.accountMenu.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AppHeader;
