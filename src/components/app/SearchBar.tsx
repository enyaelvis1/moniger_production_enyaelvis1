import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  Building2,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";
import { useLocalization } from "@/hooks/use-localization";
import { useIsMobile } from "@/hooks/use-mobile";
import { defaultBusinessLocale, formatCurrencyValue } from "@/lib/localization";
import { globalSearchQueryOptions } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

type SearchResultItem = {
  group: "Bills" | "Customers" | "Invoices" | "Payments" | "Vendors";
  icon: LucideIcon;
  id: string;
  keywords?: string[];
  route: string;
  searchTerm: string;
  subtitle: string;
  title: string;
  trailing?: string;
};

type JumpItem = {
  icon: LucideIcon;
  id: string;
  keywords: string[];
  route: string;
  subtitle: string;
  title: string;
};

type SearchResults = Record<SearchResultItem["group"], SearchResultItem[]>;

type InvoiceSearchRow = Pick<Tables<"invoices">, "currency" | "id" | "invoice_number" | "status" | "total_amount">;
type BillSearchRow = Pick<Tables<"bills">, "bill_number" | "category" | "currency" | "id" | "status" | "total_amount">;
type CustomerSearchRow = Pick<Tables<"customers">, "email" | "id" | "name" | "phone">;
type VendorSearchRow = Pick<Tables<"vendors">, "business_name" | "contact_name" | "email" | "id">;
type PaymentSearchRow = Pick<
  Tables<"payments">,
  "amount" | "counterparty_name" | "currency" | "id" | "payment_reference" | "payment_type" | "status"
>;

const RECENT_SEARCHES_KEY = "moniger:recent-searches";
const MAX_RECENT_SEARCHES = 6;

const emptyResults: SearchResults = {
  Bills: [],
  Customers: [],
  Invoices: [],
  Payments: [],
  Vendors: [],
};

const loadRecentSearches = () => {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsedValue) ? parsedValue.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
};

const persistRecentSearch = (value: string) => {
  if (typeof window === "undefined") {
    return loadRecentSearches();
  }

  const normalizedValue = value.trim().replace(/\s+/g, " ");
  if (!normalizedValue) {
    return loadRecentSearches();
  }

  const nextValues = [
    normalizedValue,
    ...loadRecentSearches().filter((entry) => entry.toLowerCase() !== normalizedValue.toLowerCase()),
  ].slice(0, MAX_RECENT_SEARCHES);

  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextValues));
  return nextValues;
};

const clearRecentSearches = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
  }
};

const formatStatus = (value: string | null | undefined) => {
  if (!value) {
    return "Unknown";
  }

  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const withSearchParam = (route: string, searchTerm: string) => {
  const [pathname, search = ""] = route.split("?");
  const params = new URLSearchParams(search);

  if (searchTerm.trim()) {
    params.set("search", searchTerm);
  } else {
    params.delete("search");
  }

  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
};

const matchesJumpItem = (item: JumpItem, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return [item.title, item.subtitle, ...item.keywords].some((value) => value.toLowerCase().includes(normalizedQuery));
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
};

const searchAppData = async (businessId: string, query: string): Promise<SearchResults> => {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) {
    return emptyResults;
  }

  const likeValue = `%${normalizedQuery}%`;
  const [invoicesResponse, billsResponse, customersResponse, vendorsResponse, paymentsResponse] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total_amount, currency")
      .eq("business_id", businessId)
      .or(`invoice_number.ilike.${likeValue},notes.ilike.${likeValue}`)
      .order("issue_date", { ascending: false })
      .limit(4),
    supabase
      .from("bills")
      .select("id, bill_number, category, status, total_amount, currency")
      .eq("business_id", businessId)
      .or(`bill_number.ilike.${likeValue},category.ilike.${likeValue},notes.ilike.${likeValue}`)
      .order("bill_date", { ascending: false })
      .limit(4),
    supabase
      .from("customers")
      .select("id, name, email, phone")
      .eq("business_id", businessId)
      .or(`name.ilike.${likeValue},email.ilike.${likeValue},phone.ilike.${likeValue}`)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("vendors")
      .select("id, business_name, contact_name, email")
      .eq("business_id", businessId)
      .or(`business_name.ilike.${likeValue},contact_name.ilike.${likeValue},email.ilike.${likeValue}`)
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("payments")
      .select("id, amount, counterparty_name, currency, payment_reference, payment_type, status")
      .eq("business_id", businessId)
      .or(`payment_reference.ilike.${likeValue},counterparty_name.ilike.${likeValue}`)
      .order("paid_on", { ascending: false })
      .limit(4),
  ]);

  const firstError =
    invoicesResponse.error ??
    billsResponse.error ??
    customersResponse.error ??
    vendorsResponse.error ??
    paymentsResponse.error;

  if (firstError) {
    throw firstError;
  }

  return {
    Bills: ((billsResponse.data ?? []) as BillSearchRow[]).map((bill) => ({
      group: "Bills",
      icon: Receipt,
      id: bill.id,
      keywords: [bill.category ?? "", bill.status ?? ""].filter(Boolean),
      route: withSearchParam("/bills", bill.bill_number),
      searchTerm: bill.bill_number,
      subtitle: bill.category ? `${formatStatus(bill.status)} - ${bill.category}` : `${formatStatus(bill.status)} bill`,
      title: bill.bill_number,
      trailing: formatCurrencyValue(bill.total_amount, { currency: bill.currency ?? "NGN", locale: defaultBusinessLocale }),
    })),
    Customers: ((customersResponse.data ?? []) as CustomerSearchRow[]).map((customer) => ({
      group: "Customers",
      icon: Users,
      id: customer.id,
      keywords: [customer.email ?? "", customer.phone ?? ""].filter(Boolean),
      route: withSearchParam("/customers", customer.name),
      searchTerm: customer.name,
      subtitle: [customer.email, customer.phone].filter(Boolean).join(" - ") || "Customer directory entry",
      title: customer.name,
    })),
    Invoices: ((invoicesResponse.data ?? []) as InvoiceSearchRow[]).map((invoice) => ({
      group: "Invoices",
      icon: FileText,
      id: invoice.id,
      keywords: [invoice.status ?? ""].filter(Boolean),
      route: withSearchParam("/invoices", invoice.invoice_number),
      searchTerm: invoice.invoice_number,
      subtitle: `${formatStatus(invoice.status)} invoice`,
      title: invoice.invoice_number,
      trailing: formatCurrencyValue(invoice.total_amount, { currency: invoice.currency ?? "NGN", locale: defaultBusinessLocale }),
    })),
    Payments: ((paymentsResponse.data ?? []) as PaymentSearchRow[]).map((payment) => ({
      group: "Payments",
      icon: CreditCard,
      id: payment.id,
      keywords: [payment.payment_type ?? "", payment.status ?? ""].filter(Boolean),
      route: withSearchParam("/payments", payment.payment_reference),
      searchTerm: payment.payment_reference,
      subtitle: [formatStatus(payment.status), payment.counterparty_name].filter(Boolean).join(" - ") || "Payment activity",
      title: payment.payment_reference,
      trailing: formatCurrencyValue(payment.amount, { currency: payment.currency ?? "NGN", locale: defaultBusinessLocale }),
    })),
    Vendors: ((vendorsResponse.data ?? []) as VendorSearchRow[]).map((vendor) => ({
      group: "Vendors",
      icon: Building2,
      id: vendor.id,
      keywords: [vendor.contact_name ?? "", vendor.email ?? ""].filter(Boolean),
      route: withSearchParam("/vendors", vendor.business_name),
      searchTerm: vendor.business_name,
      subtitle: [vendor.contact_name, vendor.email].filter(Boolean).join(" - ") || "Vendor directory entry",
      title: vendor.business_name,
    })),
  };
};

const SearchBar = ({ businessId }: { businessId?: string }) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { t } = useLocalization();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const shortcutLabel = useMemo(() => {
    if (typeof navigator === "undefined") {
      return "Ctrl";
    }

    return /Mac|iPhone|iPad/.test(navigator.platform) ? "Cmd" : "Ctrl";
  }, []);

  const jumpItems: JumpItem[] = useMemo(
    () => [
      {
        icon: LayoutDashboard,
        id: "jump-dashboard",
        keywords: ["home", "overview", "metrics", "summary"],
        route: "/dashboard",
        subtitle: t("search.jump.dashboard.subtitle"),
        title: t("search.jump.dashboard.title"),
      },
      {
        icon: FileText,
        id: "jump-invoices",
        keywords: ["receivables", "billing", "invoice"],
        route: "/invoices",
        subtitle: t("search.jump.invoices.subtitle"),
        title: t("search.jump.invoices.title"),
      },
      {
        icon: Receipt,
        id: "jump-bills",
        keywords: ["payables", "expenses", "bill"],
        route: "/bills",
        subtitle: t("search.jump.bills.subtitle"),
        title: t("search.jump.bills.title"),
      },
      {
        icon: Building2,
        id: "jump-vendors",
        keywords: ["suppliers", "vendor", "bank details"],
        route: "/vendors",
        subtitle: t("search.jump.vendors.subtitle"),
        title: t("search.jump.vendors.title"),
      },
      {
        icon: Users,
        id: "jump-customers",
        keywords: ["clients", "customer", "contacts"],
        route: "/customers",
        subtitle: t("search.jump.customers.subtitle"),
        title: t("search.jump.customers.title"),
      },
      {
        icon: CreditCard,
        id: "jump-payments",
        keywords: ["transactions", "collections", "payouts", "payment"],
        route: "/payments",
        subtitle: t("search.jump.payments.subtitle"),
        title: t("search.jump.payments.title"),
      },
      {
        icon: BarChart2,
        id: "jump-reports",
        keywords: ["analytics", "reports", "charts"],
        route: "/reports",
        subtitle: t("search.jump.reports.subtitle"),
        title: t("search.jump.reports.title"),
      },
      {
        icon: ShieldCheck,
        id: "jump-audit",
        keywords: ["logs", "audit", "activity"],
        route: "/audit-trail",
        subtitle: t("search.jump.audit.subtitle"),
        title: t("search.jump.audit.title"),
      },
      {
        icon: UserRound,
        id: "jump-settings-profile",
        keywords: ["profile", "account", "personal settings"],
        route: "/settings?tab=profile",
        subtitle: t("search.jump.profileSettings.subtitle"),
        title: t("search.jump.profileSettings.title"),
      },
      {
        icon: ShieldCheck,
        id: "jump-settings-security",
        keywords: ["security", "session", "sessions", "device", "devices", "logout", "sign out", "password", "mfa", "2fa", "authenticator", "privacy", "export", "data"],
        route: "/settings?tab=security",
        subtitle: t("search.jump.securitySettings.subtitle"),
        title: t("search.jump.securitySettings.title"),
      },
      {
        icon: Settings,
        id: "jump-settings-business",
        keywords: ["workspace", "business", "settings"],
        route: "/settings?tab=business",
        subtitle: t("search.jump.businessSettings.subtitle"),
        title: t("search.jump.businessSettings.title"),
      },
      {
        icon: Users,
        id: "jump-settings-team",
        keywords: ["team", "members", "roles", "invite", "invite email", "workspace access"],
        route: "/team",
        subtitle: t("search.jump.team.subtitle"),
        title: t("search.jump.team.title"),
      },
      {
        icon: Settings,
        id: "jump-settings-notifications",
        keywords: ["notifications", "alerts", "digest", "email", "email delivery"],
        route: "/settings?tab=notifications",
        subtitle: t("search.jump.notificationSettings.subtitle"),
        title: t("search.jump.notificationSettings.title"),
      },
    ],
    [t],
  );

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 180);

    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((currentOpen) => !currentOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const searchQuery = useQuery({
    queryKey: ["global-search", businessId, debouncedSearch],
    queryFn: () => searchAppData(businessId!, debouncedSearch),
    enabled: open && Boolean(businessId) && debouncedSearch.length >= 2,
    ...globalSearchQueryOptions,
  });

  const searchTargets = useMemo(
    () =>
      debouncedSearch
        ? [
            { icon: FileText, id: "search-target-invoices", route: withSearchParam("/invoices", debouncedSearch), title: t("search.searchPageTargets.invoices") },
            { icon: Receipt, id: "search-target-bills", route: withSearchParam("/bills", debouncedSearch), title: t("search.searchPageTargets.bills") },
            { icon: Users, id: "search-target-customers", route: withSearchParam("/customers", debouncedSearch), title: t("search.searchPageTargets.customers") },
            { icon: Building2, id: "search-target-vendors", route: withSearchParam("/vendors", debouncedSearch), title: t("search.searchPageTargets.vendors") },
            { icon: CreditCard, id: "search-target-payments", route: withSearchParam("/payments", debouncedSearch), title: t("search.searchPageTargets.payments") },
          ]
        : [],
    [debouncedSearch, t],
  );

  const filteredJumpItems = useMemo(
    () => jumpItems.filter((item) => matchesJumpItem(item, debouncedSearch)),
    [debouncedSearch, jumpItems],
  );

  const selectSearch = (value: string) => {
    const nextRecentSearches = persistRecentSearch(value);
    setRecentSearches(nextRecentSearches);
  };

  const handleRouteSelect = (route: string, searchValue?: string) => {
    if (searchValue?.trim()) {
      selectSearch(searchValue);
    }

    setOpen(false);
    navigate(route);
  };

  const handleClearHistory = () => {
    clearRecentSearches();
    setRecentSearches([]);
  };

  const resultGroups = searchQuery.data ?? emptyResults;

  const renderResultGroup = (group: keyof SearchResults) => {
    const items = resultGroups[group];
    if (items.length === 0) {
      return null;
    }

    return (
      <CommandGroup key={group} heading={group}>
        {items.map((item) => (
          <CommandItem
            key={item.id}
            value={`${item.title} ${item.subtitle}`}
            keywords={item.keywords}
            onSelect={() => handleRouteSelect(item.route, item.searchTerm)}
            className="gap-3"
          >
            <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">{item.title}</div>
              <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
            </div>
            {item.trailing ? <CommandShortcut className="tracking-normal">{item.trailing}</CommandShortcut> : null}
          </CommandItem>
        ))}
      </CommandGroup>
    );
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="hidden h-10 w-64 items-center justify-between rounded-xl border-[#E0DFF0] bg-white/90 px-3 text-muted-foreground shadow-sm transition-colors hover:bg-[#F8F8FC] md:flex lg:w-80"
        aria-label={t("search.openCommandPalette")}
        aria-controls="global-command-palette"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate text-sm">{t("search.triggerPlaceholder")}</span>
        </span>
        <span className="flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
          <span>{shortcutLabel}</span>
          <span>K</span>
        </span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size={isMobile ? "icon" : "sm"}
        onClick={() => setOpen(true)}
        className={cn(
          "rounded-lg text-muted-foreground md:hidden",
          isMobile ? "h-9 w-9" : "gap-2 px-3",
        )}
        aria-label={t("search.openCommandPalette")}
        aria-controls="global-command-palette"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Search className="h-4 w-4" aria-hidden="true" />
        {!isMobile ? <span>Search</span> : null}
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        contentClassName="md:max-w-2xl"
        contentId="global-command-palette"
        title={t("search.title")}
        description={t("search.description")}
      >
        <CommandInput
          value={search}
          onValueChange={setSearch}
          placeholder={t("search.inputPlaceholder")}
          aria-label={t("search.inputAriaLabel")}
        />
        <CommandList className="max-h-[min(70vh,32rem)]" aria-busy={searchQuery.isFetching}>
          {!debouncedSearch && recentSearches.length > 0 ? (
            <CommandGroup heading={t("search.groups.recentSearches")}>
              {recentSearches.map((recentSearch) => (
                <CommandItem
                  key={recentSearch}
                  value={recentSearch}
                  onSelect={() => setSearch(recentSearch)}
                  className="gap-3"
                >
                  <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{recentSearch}</span>
                </CommandItem>
              ))}
              <CommandItem onSelect={handleClearHistory} className="gap-3 text-muted-foreground">
                <History className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{t("search.clearRecentSearches")}</span>
              </CommandItem>
            </CommandGroup>
          ) : null}

          {!debouncedSearch ? (
            <CommandGroup heading={t("search.groups.jumpTo")}>
              {jumpItems.map((item) => (
                <CommandItem
                  key={item.id}
                  value={`${item.title} ${item.subtitle}`}
                  keywords={item.keywords}
                  onSelect={() => handleRouteSelect(item.route)}
                  className="gap-3"
                >
                  <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{item.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <>
              <CommandGroup heading={t("search.groups.searchIn", { query: debouncedSearch })}>
                {searchTargets.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${debouncedSearch}`}
                    onSelect={() => handleRouteSelect(item.route, debouncedSearch)}
                    className="gap-3"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{item.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{t("search.searchPageTargets.filterDescription")}</div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              {filteredJumpItems.length > 0 ? (
                <>
                  <CommandSeparator />
                  <CommandGroup heading={t("search.groups.pages")}>
                    {filteredJumpItems.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={`${item.title} ${item.subtitle}`}
                        keywords={item.keywords}
                        onSelect={() => handleRouteSelect(item.route, debouncedSearch)}
                        className="gap-3"
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-foreground">{item.title}</div>
                          <div className="truncate text-xs text-muted-foreground">{item.subtitle}</div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              ) : null}

              <CommandSeparator />
              {renderResultGroup("Invoices")}
              {renderResultGroup("Bills")}
              {renderResultGroup("Customers")}
              {renderResultGroup("Vendors")}
              {renderResultGroup("Payments")}
            </>
          )}

          <CommandEmpty className="py-2">
            {searchQuery.isFetching ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("search.empty.searching")}</div>
            ) : (
              <EmptyState
                title={debouncedSearch.length < 2 ? t("search.empty.keepTypingTitle") : t("search.empty.noMatchesTitle")}
                description={
                  debouncedSearch.length < 2
                    ? t("search.empty.keepTypingDescription")
                    : t("search.empty.noMatchesDescription", { query: debouncedSearch })
                }
                icon={Search}
                size="compact"
                className="border-0 bg-transparent px-4 py-8"
              />
            )}
          </CommandEmpty>
        </CommandList>
      </CommandDialog>
    </>
  );
};

export default SearchBar;
