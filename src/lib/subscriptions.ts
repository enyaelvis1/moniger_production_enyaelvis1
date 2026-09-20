export type SubscriptionPlan = "starter" | "growth" | "business";
export type SubscriptionBillingCycle = "monthly" | "annual" | "free" | "manual";

export type WorkspaceSubscriptionRecord = {
  amount: number;
  billingCycle: SubscriptionBillingCycle;
  businessId: string;
  businessName: string;
  nextRenewalAt: string | null;
  plan: SubscriptionPlan;
  provider: string;
  reference: string | null;
  status: string;
};

export type PublicWorkspaceSubscriptionConfirmation = {
  billingCycle: SubscriptionBillingCycle;
  plan: SubscriptionPlan;
  reference: string;
  status: "completed" | "failed" | "initialized";
};

export type WorkspaceSubscriptionActionResult =
  | {
    kind: "activated";
    ok: true;
    subscription: WorkspaceSubscriptionRecord;
  }
  | {
    authorizationUrl: string;
    kind: "checkout";
    ok: true;
    reference: string;
  }
  | {
    kind: "verified";
    ok: true;
    subscription: WorkspaceSubscriptionRecord;
  }
  | {
    confirmation: PublicWorkspaceSubscriptionConfirmation;
    kind: "public_status";
    ok: true;
  };

export type SubscriptionCatalogEntry = {
  defaultBillingCycle: SubscriptionBillingCycle;
  description: string;
  features: string[];
  priceLabel: string;
};

export type SubscriptionCatalog = Record<SubscriptionPlan, SubscriptionCatalogEntry>;

const subscriptionPlans = new Set<SubscriptionPlan>(["starter", "growth", "business"]);
const subscriptionBillingCycles = new Set<SubscriptionBillingCycle>(["monthly", "annual", "free", "manual"]);

export const defaultSubscriptionCatalog: SubscriptionCatalog = {
  business: {
    defaultBillingCycle: "monthly",
    description: "For finance operations that need stronger controls, exports, and hands-on rollout support.",
    features: ["Advanced permissions", "Unlimited team members", "CSV and PDF exports", "Dedicated onboarding"],
    priceLabel: "NGN 89,000/mo",
  },
  growth: {
    defaultBillingCycle: "monthly",
    description: "For teams that need payable approvals, more members, and tighter cash control.",
    features: ["Unlimited invoices", "5 team members", "Approval workflows", "Priority support"],
    priceLabel: "NGN 29,000/mo",
  },
  starter: {
    defaultBillingCycle: "free",
    description: "For small businesses replacing manual spreadsheets with a cleaner operating system.",
    features: ["Up to 10 invoices/month", "1 team member", "Basic payment tracking", "Email support"],
    priceLabel: "Free",
  },
};

export const subscriptionCatalog = defaultSubscriptionCatalog;

export const isSubscriptionPlan = (value: string | null | undefined): value is SubscriptionPlan =>
  Boolean(value && subscriptionPlans.has(value as SubscriptionPlan));

export const isSubscriptionBillingCycle = (
  value: string | null | undefined,
): value is SubscriptionBillingCycle => Boolean(value && subscriptionBillingCycles.has(value as SubscriptionBillingCycle));

export const getDefaultSubscriptionBillingCycle = (plan: SubscriptionPlan): SubscriptionBillingCycle =>
  subscriptionCatalog[plan]?.defaultBillingCycle ?? "monthly";

const normalizeSubscriptionCatalogEntry = (
  entry: Partial<SubscriptionCatalogEntry> | null | undefined,
  fallback: SubscriptionCatalogEntry,
): SubscriptionCatalogEntry => ({
  defaultBillingCycle:
    entry?.defaultBillingCycle && isSubscriptionBillingCycle(entry.defaultBillingCycle)
      ? entry.defaultBillingCycle
      : fallback.defaultBillingCycle,
  description:
    typeof entry?.description === "string" && entry.description.trim().length > 0
      ? entry.description
      : fallback.description,
  features: Array.isArray(entry?.features)
    ? entry.features.filter((feature): feature is string => typeof feature === "string" && feature.trim().length > 0)
    : fallback.features,
  priceLabel: typeof entry?.priceLabel === "string" && entry.priceLabel.trim().length > 0 ? entry.priceLabel : fallback.priceLabel,
});

export const mergeSubscriptionCatalog = (value: unknown): SubscriptionCatalog => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultSubscriptionCatalog;
  }

  const catalogValue = value as Partial<Record<SubscriptionPlan, Partial<SubscriptionCatalogEntry>>>;

  return {
    business: normalizeSubscriptionCatalogEntry(catalogValue.business, defaultSubscriptionCatalog.business),
    growth: normalizeSubscriptionCatalogEntry(catalogValue.growth, defaultSubscriptionCatalog.growth),
    starter: normalizeSubscriptionCatalogEntry(catalogValue.starter, defaultSubscriptionCatalog.starter),
  };
};

export const isPaidSubscriptionSelection = ({
  billingCycle,
  plan,
}: {
  billingCycle: SubscriptionBillingCycle;
  plan: SubscriptionPlan;
}) => plan !== "starter" && billingCycle !== "free" && billingCycle !== "manual";

export const createSubscriptionIntentPath = ({
  basePath = "/pricing",
  billingCycle,
  plan,
}: {
  basePath?: string;
  billingCycle: SubscriptionBillingCycle;
  plan: SubscriptionPlan;
}) => {
  const params = new URLSearchParams({
    billingCycle,
    subscribe: plan,
  });

  return `${basePath}?${params.toString()}`;
};

export const createSubscriptionConfirmationPath = ({
  basePath = "/pricing/confirmed",
  reference,
}: {
  basePath?: string;
  reference?: string | null;
} = {}) => {
  if (!reference) {
    return basePath;
  }

  const params = new URLSearchParams({
    reference,
  });

  return `${basePath}?${params.toString()}`;
};
