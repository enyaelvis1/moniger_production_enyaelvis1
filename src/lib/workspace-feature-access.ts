import type { WorkspaceSubscription } from "@/hooks/use-workspace-subscription";

export type WorkspaceFeature =
  | "dashboard"
  | "invoices"
  | "customers"
  | "payments"
  | "bills"
  | "vendors"
  | "reports"
  | "team"
  | "auditTrail"
  | "funding"
  | "marketplaceRouting";

const starterFeatures: ReadonlySet<WorkspaceFeature> = new Set([
  "dashboard",
  "invoices",
  "customers",
  "payments",
]);

export const isWorkspaceFeatureAvailable = (
  plan: WorkspaceSubscription["plan"] | null | undefined,
  feature: WorkspaceFeature,
) => plan !== "starter" || starterFeatures.has(feature);

export const getWorkspaceFeatureLabel = (feature: WorkspaceFeature) => {
  const labels: Record<WorkspaceFeature, string> = {
    dashboard: "Dashboard",
    invoices: "Invoices",
    customers: "Customers",
    payments: "Payments",
    bills: "Bills",
    vendors: "Vendors",
    reports: "Reports",
    team: "Team",
    auditTrail: "Audit Trail",
    funding: "Funding",
    marketplaceRouting: "Marketplace Routing",
  };

  return labels[feature];
};
