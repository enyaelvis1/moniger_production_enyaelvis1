import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  Info,
  Link as LinkIcon,
  Mail,
  Menu,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Star,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { containerClass } from "./landing-shared";

type MenuKey = "features" | "about";

type MenuItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
  iconClassName: string;
  href?: string;
  to?: string;
};

type MenuColumn = {
  label: string;
  items: MenuItem[];
};

const navItems = [
  { type: "menu" as const, key: "features" as const, label: "Features" },
  { type: "link" as const, label: "Pricing", to: "/pricing" },
  { type: "link" as const, label: "Security", to: "/security" },
  { type: "menu" as const, key: "about" as const, label: "About" },
];

const featuresColumns: MenuColumn[] = [
  {
    label: "PAYMENTS",
    items: [
      {
        title: "Invoicing",
        desc: "Create and send professional invoices",
        icon: FileText,
        iconClassName: "bg-[#EBF5FF] text-[#2980B9]",
        to: "/features/invoicing",
      },
      {
        title: "Bill Payments",
        desc: "Pay vendors and track bills",
        icon: CreditCard,
        iconClassName: "bg-[#FEF9EE] text-[#D97706]",
        to: "/features/bill-payments",
      },
      {
        title: "Payment Links",
        desc: "Get paid via shareable links",
        icon: LinkIcon,
        iconClassName: "bg-[#F0FDF4] text-[#16A34A]",
        href: "#features",
      },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      {
        title: "Vendor Management",
        desc: "Manage all your vendors",
        icon: Users,
        iconClassName: "bg-[#EDE9FE] text-[#7C3AED]",
        to: "/features/vendor-management",
      },
      {
        title: "Customer Profiles",
        desc: "Track customer relationships",
        icon: UserCheck,
        iconClassName: "bg-[#FEF3F2] text-[#DC2626]",
        href: "#features",
      },
      {
        title: "Reports & Analytics",
        desc: "Real-time financial reports",
        icon: BarChart2,
        iconClassName: "bg-[#F0FDF4] text-[#16A34A]",
        href: "#features",
      },
    ],
  },
  {
    label: "CONTROLS",
    items: [
      {
        title: "Approval Workflows",
        desc: "Multi-level payment approvals",
        icon: ShieldCheck,
        iconClassName: "bg-[#EBF5FF] text-[#2980B9]",
        href: "#security",
      },
      {
        title: "Access Controls",
        desc: "Role-based permissions and team access",
        icon: ShieldCheck,
        iconClassName: "bg-[#FEF9EE] text-[#D97706]",
        to: "/security",
      },
      {
        title: "Audit Visibility",
        desc: "Track who changed what and when",
        icon: ShieldCheck,
        iconClassName: "bg-[#EDE9FE] text-[#7C3AED]",
        to: "/security",
      },
    ],
  },
  {
    label: "INTEGRATIONS",
    items: [
      {
        title: "QuickBooks integration (planned)",
        desc: "Planned accounting sync for a future release",
        icon: RefreshCw,
        iconClassName: "bg-[#F0FDF4] text-[#16A34A]",
        to: "/changelog",
      },
      {
        title: "Xero integration (planned)",
        desc: "Planned accounting sync for a future release",
        icon: RefreshCw,
        iconClassName: "bg-[#EBF5FF] text-[#2980B9]",
        to: "/changelog",
      },
      {
        title: "Paystack payments",
        desc: "Provider-backed invoice and subscription payments",
        icon: Smartphone,
        iconClassName: "bg-[#FEF3F2] text-[#DC2626]",
        to: "/pricing",
      },
    ],
  },
];

const aboutColumns: MenuColumn[] = [
  {
    label: "COMPANY",
    items: [
      {
        title: "About moniger.net",
        desc: "Our mission and story",
        icon: Info,
        iconClassName: "bg-[#EBF5FF] text-[#2980B9]",
        to: "/about",
      },
      {
        title: "Contact Us",
        desc: "Get in touch with our team",
        icon: Mail,
        iconClassName: "bg-[#FEF3F2] text-[#DC2626]",
        to: "/contact",
      },
      {
        title: "Changelog",
        desc: "Latest updates and releases",
        icon: BookOpen,
        iconClassName: "bg-[#EDE9FE] text-[#7C3AED]",
        to: "/changelog",
      },
    ],
  },
  {
    label: "RESOURCES",
    items: [
      {
        title: "Help Centre",
        desc: "Documentation and guides",
        icon: HelpCircle,
        iconClassName: "bg-[#F0FDF4] text-[#16A34A]",
        to: "/help-centre",
      },
      {
        title: "Support",
        desc: "Talk to our support team",
        icon: MessageSquare,
        iconClassName: "bg-[#FEF9EE] text-[#D97706]",
        to: "/support",
      },
      {
        title: "Privacy Policy",
        desc: "How we handle your data",
        icon: FileText,
        iconClassName: "bg-[#EBF5FF] text-[#2980B9]",
        to: "/privacy",
      },
    ],
  },
];

const mobileFeaturesItems: MenuItem[] = [
  featuresColumns[0].items[0],
  featuresColumns[0].items[2],
  featuresColumns[1].items[0],
  featuresColumns[2].items[0],
];

const mobilePricingItems: MenuItem[] = [
  {
    title: "Starter",
    desc: "Free plan for small businesses",
    icon: Star,
    iconClassName: "bg-[#F7F6F3] text-[#0D1B2A]",
    to: "/pricing",
  },
  {
    title: "Growth",
    desc: "Paid plan for growing teams",
    icon: BarChart2,
    iconClassName: "bg-[#E8E4DF] text-[#4A5568]",
    to: "/pricing",
  },
];

const mobileCompanyItems: MenuItem[] = [
  {
    title: "About",
    desc: "Our mission and story",
    icon: Info,
    iconClassName: "bg-[#EBF5FF] text-[#2980B9]",
    to: "/about",
  },
  {
    title: "Contact",
    desc: "Get in touch with our team",
    icon: Mail,
    iconClassName: "bg-[#FEF3F2] text-[#DC2626]",
    to: "/contact",
  },
  {
    title: "Help Centre",
    desc: "Documentation and guides",
    icon: HelpCircle,
    iconClassName: "bg-[#F0FDF4] text-[#16A34A]",
    to: "/help-centre",
  },
];

const desktopLinkClass =
  "inline-flex items-center gap-1.5 text-[15px] font-normal tracking-[-0.01em] text-[#4A5568] transition-colors duration-150 hover:text-[#5B67F7]";

const sectionLabelClass =
  "mb-3 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8B8FA8]";

const DesktopMenuEntry = ({ item }: { item: MenuItem }) => {
  const content = (
    <>
      <span
        className={cn(
          "inline-flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px]",
          item.iconClassName,
        )}
      >
        <item.icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-[#0D1B2A]">{item.title}</span>
        <span className="mt-0.5 block text-[12px] leading-[1.4] text-[#64748B]">{item.desc}</span>
      </span>
    </>
  );

  if (item.to) {
    return (
      <Link
        to={item.to}
        className="mb-1 flex items-start gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8]"
      >
        {content}
      </Link>
    );
  }

  return (
    <a
      href={item.href}
      className="mb-1 flex items-start gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8]"
    >
      {content}
    </a>
  );
};

const MobileMenuEntry = ({ item, onNavigate }: { item: MenuItem; onNavigate: (path: string) => void }) => {
  const content = (
    <>
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px]",
          item.iconClassName,
        )}
      >
        <item.icon size={16} />
      </span>
      <span className="text-[14px] font-normal text-[#374151]">{item.title}</span>
    </>
  );

  if (item.to) {
    return (
      <button
        type="button"
        onClick={() => onNavigate(item.to!)}
        className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8] text-left pointer-events-auto cursor-pointer"
      >
        {content}
      </button>
    );
  }

  return (
    <a
      href={item.href}
      onClick={() => onNavigate(item.href || "#")}
      className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8] pointer-events-auto cursor-pointer"
    >
      {content}
    </a>
  );
};

const MobileNavLink = ({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: (path: string) => void }) => {
  return (
    <button
      type="button"
      onClick={() => onClick(to)}
      className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8] text-left"
    >
      {children}
    </button>
  );
};

const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<MenuKey | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [expandedMobile, setExpandedMobile] = useState<Record<string, boolean>>({
    features: false,
    pricing: false,
    company: false,
  });

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setExpandedMobile({ features: false, pricing: false, company: false });
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY >= 60);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = originalOverflow;
    };
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    if (!activeMenu) return undefined;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveMenu(null);
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [activeMenu]);

  const handleMobileNavigation = useCallback((path: string) => {
    closeDrawer();
    
    // Navigate after state update completes
    setTimeout(() => {
      navigate(path);
    }, 50);
  }, [closeDrawer, navigate]);

  const toggleMobileSection = (key: "features" | "pricing" | "company") => {
    setExpandedMobile((current) => ({ ...current, [key]: !current[key] }));
  };

  const renderDesktopDropdown = () => {
    if (!activeMenu) return null;

    if (activeMenu === "features") {
      return (
        <div className="grid gap-6 lg:grid-cols-4">
          {featuresColumns.map((column) => (
            <div key={column.label}>
              <span className={sectionLabelClass}>{column.label}</span>
              {column.items.map((item) => (
                <DesktopMenuEntry key={item.title} item={item} />
              ))}
            </div>
          ))}
          <div className="col-span-full mt-4 flex items-center gap-2 border-t border-[#E8E6F0] pt-5">
            <Link
              to="/register"
              className="inline-flex items-center rounded-full bg-[#5B67F7] px-5 py-2.5 text-[13px] font-medium text-white shadow-[0_4px_16px_rgba(91,103,247,0.3)] transition-all hover:bg-[#4A56E0] hover:shadow-[0_8px_24px_rgba(91,103,247,0.4)]"
            >
              Start for free
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-full border border-[#D8D6E8] bg-[#F3F4FB] px-5 py-2.5 text-[13px] font-medium text-[#0D1B2A] transition-all hover:border-[#5B67F7]"
            >
              Open workspace
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_0.95fr]">
        {aboutColumns.map((column) => (
          <div key={column.label}>
            <span className={sectionLabelClass}>{column.label}</span>
            {column.items.map((item) => (
              <DesktopMenuEntry key={item.title} item={item} />
            ))}
          </div>
        ))}
        <div className="rounded-[12px] bg-[#F3F4FB] p-6">
          <p className="text-[16px] font-bold text-[#0D1B2A]">Talk to us</p>
          <p className="mt-2 text-[13px] leading-[1.6] text-[#64748B]">
            Have questions about moniger.net? We respond within 24 hours.
          </p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#0D1B2A]">
              <Mail size={14} />
              <span>hello@moniger.net</span>
            </div>
            <div className="flex items-center gap-2 text-[13px] font-medium text-[#0D1B2A]">
              <Phone size={14} />
              <span>+234 913 170 1391</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <nav aria-label="Primary navigation" className={cn("landing-nav fixed left-0 right-0 z-40 w-full", scrolled && "scrolled")}>
        <div
          className={cn(
            containerClass,
            "landing-nav-inner relative flex h-[60px] items-center justify-between px-5 md:h-[68px] lg:px-12",
          )}
          onMouseLeave={() => setActiveMenu(null)}
        >
          <Link to="/" className="landing-wordmark flex items-center gap-2 text-[18px] font-bold tracking-[-0.02em] text-[#0D1B2A] md:text-[20px]">
            <img
              src="/moniger-mark.svg"
              alt=""
              width={32}
              height={32}
              decoding="async"
              aria-hidden="true"
              className="h-7 w-7 md:h-8 md:w-8"
            />
            moniger.net
          </Link>

          <div className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) =>
              item.type === "menu" ? (
                <button
                  key={item.key}
                  type="button"
                  aria-expanded={activeMenu === item.key}
                  aria-controls={`${item.key}-desktop-menu`}
                  className={cn(desktopLinkClass, activeMenu === item.key && "text-[#5B67F7]")}
                  onMouseEnter={() => setActiveMenu(item.key)}
                  onFocus={() => setActiveMenu(item.key)}
                  onClick={() => setActiveMenu((current) => (current === item.key ? null : item.key))}
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    size={12}
                    className={cn("transition-transform duration-200", activeMenu === item.key && "rotate-180")}
                  />
                </button>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className={desktopLinkClass}
                  onMouseEnter={() => setActiveMenu(null)}
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-[#D0CEE4] px-5 py-2 text-[14px] font-medium tracking-[-0.01em] text-[#0D1B2A] transition-all duration-200 hover:border-[#5B67F7] hover:text-[#5B67F7] hover:shadow-[0_2px_8px_rgba(91,103,247,0.1)]"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-full bg-[#5B67F7] px-6 py-2.5 text-[14px] font-medium tracking-[-0.01em] text-white shadow-[0_4px_16px_rgba(91,103,247,0.3),0_1px_4px_rgba(91,103,247,0.15)] transition-all duration-200 hover:bg-[#4A56E0] hover:shadow-[0_8px_24px_rgba(91,103,247,0.4)] active:scale-[0.97]"
            >
              Get Started
            </Link>
          </div>

          <button
            type="button"
            ref={menuButtonRef}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-navigation-drawer"
            className="landing-menu-button inline-flex h-10 w-10 items-center justify-center text-[#0D1B2A] lg:hidden"
            onClick={() => {
              setActiveMenu(null);
              setDrawerOpen(true);
            }}
          >
            <Menu size={22} strokeWidth={2} />
          </button>

          {activeMenu ? (
            <div
              className="fixed left-0 right-0 top-full hidden lg:block"
              style={{ top: 68 }}
              onMouseEnter={() => setActiveMenu(activeMenu)}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <div
                id={`${activeMenu}-desktop-menu`}
                className="relative border-t border-[#E0DFF0]/60 bg-[#FAFAFF]/95 backdrop-blur-xl shadow-[0_24px_80px_rgba(91,103,247,0.08),0_8px_32px_rgba(0,0,0,0.05)]"
              >
                <div className="mx-auto max-w-[1200px] px-8 py-8">{renderDesktopDropdown()}</div>
              </div>
            </div>
          ) : null}
        </div>
      </nav>

      {drawerOpen ? (
        <>
          <div
            className="fixed inset-0 z-[9998] bg-[rgba(0,0,0,0.4)] backdrop-blur-[2px] lg:hidden"
            onClick={closeDrawer}
          />

          <div
            id="mobile-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="fixed bottom-0 left-0 right-0 z-[9999] flex min-h-0 flex-col overflow-hidden rounded-t-[24px] bg-[#FAFAFF] shadow-[0_-8px_48px_rgba(91,103,247,0.12),0_-2px_16px_rgba(0,0,0,0.08)] lg:hidden"
            style={{
              height: "min(72dvh, 560px)",
              maxHeight: "calc(100dvh - 8px)",
            }}
          >
            <span className="mx-auto mt-3 block h-1 w-9 rounded-[2px] bg-[#D0CEE4]" />

            <div className="flex items-center justify-between border-b border-[#E0DFF0] px-6 pb-4 pt-5">
              <span className="text-[16px] font-bold text-[#0D1B2A]">moniger.net</span>
              <button
                type="button"
                ref={closeButtonRef}
                aria-label="Close navigation menu"
                className="text-[#4A5568] transition-colors hover:text-[#0D1B2A]"
                onClick={closeDrawer}
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4 overscroll-contain">
              <button
                type="button"
                className="flex items-center justify-between border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] w-full pointer-events-auto cursor-pointer"
                onClick={() => toggleMobileSection("features")}
              >
                <span>Features</span>
                <ChevronDown
                  size={16}
                  className={cn("text-[#94A3B8] transition-transform duration-200", expandedMobile.features && "rotate-180")}
                />
              </button>
              <div
                style={{
                  maxHeight: expandedMobile.features ? "320px" : "0px",
                  overflow: "hidden",
                  transition: "max-height 300ms ease-in-out",
                  flexShrink: 0,
                }}
              >
                <div className="flex flex-col gap-1 rounded-[10px] bg-[#F3F4FB] px-4 py-2 pointer-events-auto">
                  {mobileFeaturesItems.map((item) => (
                    <MobileMenuEntry key={item.title} item={item} onNavigate={handleMobileNavigation} />
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="flex items-center justify-between border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] w-full pointer-events-auto cursor-pointer"
                onClick={() => toggleMobileSection("pricing")}
              >
                <span>Pricing</span>
                <ChevronDown
                  size={16}
                  className={cn("text-[#94A3B8] transition-transform duration-200", expandedMobile.pricing && "rotate-180")}
                />
              </button>
              <div
                style={{
                  maxHeight: expandedMobile.pricing ? "256px" : "0px",
                  overflow: "hidden",
                  transition: "max-height 300ms ease-in-out",
                  flexShrink: 0,
                }}
              >
                <div className="flex flex-col gap-1 rounded-[10px] bg-[#F3F4FB] px-4 py-2 pointer-events-auto">
                  {mobilePricingItems.map((item) => (
                    <MobileMenuEntry key={item.title} item={item} onNavigate={handleMobileNavigation} />
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="flex items-center justify-between border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] w-full pointer-events-auto cursor-pointer"
                onClick={() => toggleMobileSection("company")}
              >
                <span>Company</span>
                <ChevronDown
                  size={16}
                  className={cn("text-[#94A3B8] transition-transform duration-200", expandedMobile.company && "rotate-180")}
                />
              </button>
              <div
                style={{
                  maxHeight: expandedMobile.company ? "500px" : "0px",
                  overflow: "hidden",
                  transition: "max-height 300ms ease-in-out",
                  flexShrink: 0,
                }}
              >
                <div className="flex flex-col gap-1 rounded-[10px] bg-[#F3F4FB] px-4 py-2 pointer-events-auto">
                  {mobileCompanyItems.map((item) => (
                    <MobileMenuEntry key={item.title} item={item} onNavigate={handleMobileNavigation} />
                  ))}
                  <button
                    type="button"
                    onClick={() => handleMobileNavigation("/privacy")}
                    className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8] text-left text-[14px] font-normal text-[#374151] pointer-events-auto cursor-pointer"
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#EBF5FF] text-[#2980B9]",
                      )}
                    >
                      <FileText size={16} />
                    </span>
                    <span>Privacy Policy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileNavigation("/terms")}
                    className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8] text-left text-[14px] font-normal text-[#374151] pointer-events-auto cursor-pointer"
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#F0FDF4] text-[#16A34A]",
                      )}
                    >
                      <FileText size={16} />
                    </span>
                    <span>Terms of Service</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMobileNavigation("/changelog")}
                    className="flex w-full items-center gap-3 rounded-[8px] px-3 py-2.5 transition-colors duration-150 hover:bg-[#EEEDF8] text-left text-[14px] font-normal text-[#374151] pointer-events-auto cursor-pointer"
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] bg-[#EDE9FE] text-[#7C3AED]",
                      )}
                    >
                      <BookOpen size={16} />
                    </span>
                    <span>Changelog</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleMobileNavigation("/security")}
                className="w-full border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] pointer-events-auto cursor-pointer"
              >
                Security
              </button>
              <button
                type="button"
                onClick={() => handleMobileNavigation("/help-centre")}
                className="w-full border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] pointer-events-auto cursor-pointer"
              >
                Help Centre
              </button>
              <button
                type="button"
                onClick={() => handleMobileNavigation("/support")}
                className="w-full border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] pointer-events-auto cursor-pointer"
              >
                Support
              </button>
              <button
                type="button"
                onClick={() => handleMobileNavigation("/login")}
                className="w-full border-b border-[#E8E6F0] py-3.5 text-left text-[16px] font-medium text-[#0D1B2A] pointer-events-auto cursor-pointer"
              >
                Sign In
              </button>
            </div>

            <div
              className="mt-auto flex flex-col gap-2 border-t border-[#E0DFF0] bg-[#FAFAFF] px-6 pt-5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
            >
              <button
                type="button"
                onClick={() => handleMobileNavigation("/register")}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#5B67F7] px-5 py-3.5 text-[15px] font-medium text-white shadow-[0_4px_16px_rgba(91,103,247,0.3)] transition-all hover:bg-[#4A56E0] pointer-events-auto cursor-pointer"
              >
                Get Started Free
              </button>
              <button
                type="button"
                onClick={() => handleMobileNavigation("/login")}
                className="inline-flex w-full items-center justify-center rounded-full border border-[#D0CEE4] bg-[#F3F4FB] px-5 py-3.5 text-[15px] font-medium text-[#0D1B2A] transition-colors hover:border-[#5B67F7] pointer-events-auto cursor-pointer"
              >
                Open Workspace
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
};

export default Navbar;
