import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useSessionTimeout } from "@/contexts/SessionTimeoutContext";
import { downloadJsonFile, createExportFileName } from "@/lib/export";
import {
  defaultSubscriptionCatalog,
  type SubscriptionCatalog,
  type SubscriptionPlan,
} from "@/lib/subscriptions";
import { useAdminAccess } from "@/admin/components/AdminRoute";
import {
  invokeAdminConsole,
  useAdminConsoleQuery,
  type AdminSettingsResponse,
} from "@/admin/lib/admin-console";
import {
  AdminBadge,
  AdminPageHeader,
  AdminSectionCard,
} from "@/admin/components/AdminUi";

const buildBulkTestDataConfirmation = (count: number) => `DELETE ${count} RECORDS`;

type BillingCatalogDraft = Record<
  SubscriptionPlan,
  {
    description: string;
    featuresText: string;
    priceLabel: string;
  }
>;

const createBillingCatalogDraft = (catalog: SubscriptionCatalog): BillingCatalogDraft => ({
  business: {
    description: catalog.business.description,
    featuresText: catalog.business.features.join("\n"),
    priceLabel: catalog.business.priceLabel,
  },
  growth: {
    description: catalog.growth.description,
    featuresText: catalog.growth.features.join("\n"),
    priceLabel: catalog.growth.priceLabel,
  },
  starter: {
    description: catalog.starter.description,
    featuresText: catalog.starter.features.join("\n"),
    priceLabel: catalog.starter.priceLabel,
  },
});

const parseBillingCatalogDraft = (draft: BillingCatalogDraft): SubscriptionCatalog => ({
  business: {
    ...defaultSubscriptionCatalog.business,
    description: draft.business.description,
    features: draft.business.featuresText
      .split("\n")
      .map((feature) => feature.trim())
      .filter(Boolean),
    priceLabel: draft.business.priceLabel,
  },
  growth: {
    ...defaultSubscriptionCatalog.growth,
    description: draft.growth.description,
    features: draft.growth.featuresText
      .split("\n")
      .map((feature) => feature.trim())
      .filter(Boolean),
    priceLabel: draft.growth.priceLabel,
  },
  starter: {
    ...defaultSubscriptionCatalog.starter,
    description: draft.starter.description,
    features: draft.starter.featuresText
      .split("\n")
      .map((feature) => feature.trim())
      .filter(Boolean),
    priceLabel: draft.starter.priceLabel,
  },
});

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const adminAccess = useAdminAccess();
  const { sessionTimeoutMinutes, setSessionTimeoutMinutes } = useSessionTimeout();
  const settingsQuery = useAdminConsoleQuery<AdminSettingsResponse>("settings.get");
  const configByKey = useMemo(
    () => new Map((settingsQuery.data?.platformConfig ?? []).map((item) => [item.key, item.value ?? {}])),
    [settingsQuery.data?.platformConfig],
  );
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState<"super_admin" | "support">("support");
  const [supportEmail, setSupportEmail] = useState(String(configByKey.get("support_email")?.value ?? ""));
  const [bannerText, setBannerText] = useState(String(configByKey.get("landing_banner")?.text ?? ""));
  const [maintenanceMode, setMaintenanceMode] = useState(Boolean(configByKey.get("maintenance_mode")?.enabled));
  const [adminPageSize, setAdminPageSize] = useState(() => String(configByKey.get("admin_page_size")?.value ?? 25));
  const [billingCatalogDraft, setBillingCatalogDraft] = useState<BillingCatalogDraft>(() =>
    createBillingCatalogDraft(defaultSubscriptionCatalog),
  );
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState(() => String(sessionTimeoutMinutes));
  const [exportConfirmation, setExportConfirmation] = useState("");
  const [testDataResource, setTestDataResource] = useState<"all" | "payments" | "payouts" | "other">("all");
  const [testDataConfirmation, setTestDataConfirmation] = useState("");
  const [testDataBulkConfirmation, setTestDataBulkConfirmation] = useState("");
  const [testDataReason, setTestDataReason] = useState("");
  const [testDataPreview, setTestDataPreview] = useState<{ confirmationCount?: number; blocked?: { payments?: Array<{ id: string; reason: string }>; payouts: Array<{ id: string; status: string }> }; deletable?: { payments: number; payouts: number; receivables?: number }; other?: { announcements: number; bills: number; businesses: number; checkoutSessions: number; content: number; customers: number; invoices: number; signupAlerts: number; users: number; vendors: number; blocked: number } } | null>(null);
  const [isCleaningTestData, setIsCleaningTestData] = useState(false);
  const testDataDeletionCount = testDataPreview?.confirmationCount ?? 0;

  const previewTestData = useCallback(async (resource = testDataResource) => {
    try {
      const result = await invokeAdminConsole<typeof testDataPreview>("testData.preview", { resource });
      setTestDataPreview(result);
    } catch (error) {
      setTestDataPreview(null);
      toast({ title: "Preview failed", description: error instanceof Error ? error.message : "Unable to preview marked test data.", variant: "destructive" });
    }
  }, [testDataResource, toast]);

  useEffect(() => {
    setSessionTimeoutInput(String(sessionTimeoutMinutes));
  }, [sessionTimeoutMinutes]);

  useEffect(() => {
    if (adminAccess.role === "super_admin") {
      void previewTestData(testDataResource);
    }
  }, [adminAccess.role, previewTestData, testDataResource]);

  useEffect(() => {
    setAdminPageSize(String(configByKey.get("admin_page_size")?.value ?? 25));
  }, [configByKey]);

  useEffect(() => {
    const configuredCatalog = configByKey.get("billing_catalog");
    if (configuredCatalog && typeof configuredCatalog === "object" && !Array.isArray(configuredCatalog)) {
      setBillingCatalogDraft(createBillingCatalogDraft({
        business: {
          ...defaultSubscriptionCatalog.business,
          ...(configuredCatalog.business as Partial<typeof defaultSubscriptionCatalog.business>),
        },
        growth: {
          ...defaultSubscriptionCatalog.growth,
          ...(configuredCatalog.growth as Partial<typeof defaultSubscriptionCatalog.growth>),
        },
        starter: {
          ...defaultSubscriptionCatalog.starter,
          ...(configuredCatalog.starter as Partial<typeof defaultSubscriptionCatalog.starter>),
        },
      }));
    }
  }, [configByKey]);

  const refreshSettings = async () => {
    await settingsQuery.refetch();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settings"
        subtitle="Operator access, platform configuration, and controlled maintenance actions."
      />

      <Tabs defaultValue="admins" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-[#111927]">
          <TabsTrigger value="admins">Admin Users</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="config">Platform Config</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="admins" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <AdminSectionCard title="Current Admins">
              <div className="space-y-3">
                {(settingsQuery.data?.adminUsers ?? []).map((adminUser) => (
                  <div key={adminUser.adminUserId} className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#F1F5F9]">{adminUser.fullName ?? adminUser.email}</p>
                        <p className="text-sm text-white/45">{adminUser.email}</p>
                      </div>
                      <AdminBadge tone={adminUser.role === "super_admin" ? "info" : "neutral"}>{adminUser.role}</AdminBadge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="ghost"
                        className="h-8 rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
                        onClick={async () => {
                          await invokeAdminConsole("settings.adminUser", {
                            adminUserId: adminUser.adminUserId,
                            role: adminUser.role === "super_admin" ? "support" : "super_admin",
                            type: "update",
                          });
                          await refreshSettings();
                        }}
                      >
                        Change role
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 rounded-lg border border-[#EF4444]/20 bg-[#EF4444]/10 text-[#FCA5A5] hover:bg-[#EF4444]/20"
                        onClick={async () => {
                          await invokeAdminConsole("settings.adminUser", {
                            adminUserId: adminUser.adminUserId,
                            type: "remove",
                          });
                          await refreshSettings();
                        }}
                      >
                        Revoke access
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </AdminSectionCard>

            <AdminSectionCard title="Add Admin">
              <div className="space-y-3">
                <Input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="Email address" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
                <select value={adminRole} onChange={(event) => setAdminRole(event.target.value as "super_admin" | "support")} className="h-11 rounded-md border border-white/10 bg-[#0F1621] px-3 text-white">
                  <option value="support">support</option>
                  <option value="super_admin">super_admin</option>
                </select>
                <Button
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                  onClick={async () => {
                    await invokeAdminConsole("settings.adminUser", {
                      email: adminEmail,
                      role: adminRole,
                      type: "add",
                    });
                    setAdminEmail("");
                    await refreshSettings();
                    toast({ title: "Admin access prepared", description: "The account was added. If it was new, an invitation email was sent." });
                  }}
                >
                  Add or Invite Admin
                </Button>
              </div>
            </AdminSectionCard>
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <AdminSectionCard title="Session Security">
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-[#F1F5F9]">Automatic sign-out</p>
                  <p className="mt-1 text-sm text-white/45">
                    Admin sessions now sign out automatically after the configured period of inactivity. Mouse,
                    keyboard, touch, and scroll activity all keep the session alive.
                  </p>
                </div>

                <div className="w-full max-w-xs space-y-2">
                  <Label htmlFor="admin-session-timeout" className="text-white/80">Inactivity duration (minutes)</Label>
                  <Input
                    id="admin-session-timeout"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={sessionTimeoutInput}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setSessionTimeoutInput(nextValue);

                      const parsedValue = Number(nextValue);
                      if (Number.isFinite(parsedValue)) {
                        setSessionTimeoutMinutes(parsedValue);
                      }
                    }}
                    className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
                  />
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4 text-sm text-white/60">
                  Current timeout: <span className="font-medium text-[#F1F5F9]">{sessionTimeoutMinutes} minute{sessionTimeoutMinutes === 1 ? "" : "s"}</span>
                </div>
              </div>
            </AdminSectionCard>

            <AdminSectionCard title="How to test">
              <div className="space-y-3 text-sm text-white/60">
                <p>Set the timeout to `1` minute, then leave the admin app untouched.</p>
                <p>Confirm the warning appears shortly before logout and the app redirects back to `/login` when the idle period completes.</p>
                <p>Click “Stay signed in” during the warning state and confirm the admin session remains active.</p>
              </div>
            </AdminSectionCard>
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-4">
          <AdminSectionCard title="Platform Config">
            <div className="space-y-4">
              <Input value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="Support email" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
              <Input value={bannerText} onChange={(event) => setBannerText(event.target.value)} placeholder="Platform announcement banner text" className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30" />
              <div className="w-full max-w-xs space-y-2">
                <Label htmlFor="admin-page-size" className="text-white/80">Admin items per page</Label>
                <Input
                  id="admin-page-size"
                  type="number"
                  min={5}
                  max={200}
                  step={5}
                  value={adminPageSize}
                  onChange={(event) => setAdminPageSize(event.target.value)}
                  className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
                />
              </div>
              <label className="flex items-center gap-3 text-sm text-white/70">
                <input type="checkbox" checked={maintenanceMode} onChange={(event) => setMaintenanceMode(event.target.checked)} />
                Enable maintenance mode
              </label>
              <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#F1F5F9]">Billing catalog</p>
                    <p className="mt-1 text-sm text-white/45">
                      Update the public pricing cards from one shared catalog. The landing page and `/pricing` read from
                      this value through the public site config endpoint.
                    </p>
                  </div>
                  <p className="text-xs text-white/45">Stored as `platform_config.billing_catalog`</p>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-3">
                  {(["starter", "growth", "business"] as SubscriptionPlan[]).map((plan) => {
                    const planDraft = billingCatalogDraft[plan];
                    const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);

                    return (
                      <div key={plan} className="rounded-xl border border-white/5 bg-[#111927] p-4">
                        <p className="font-medium text-[#F1F5F9]">{planLabel}</p>
                        <div className="mt-3 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`billing-${plan}-price`} className="text-white/80">Price label</Label>
                            <Input
                              id={`billing-${plan}-price`}
                              value={planDraft.priceLabel}
                              onChange={(event) => {
                                const value = event.target.value;
                                setBillingCatalogDraft((current) => ({
                                  ...current,
                                  [plan]: {
                                    ...current[plan],
                                    priceLabel: value,
                                  },
                                }));
                              }}
                              placeholder="NGN 29,000/mo"
                              className="border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`billing-${plan}-description`} className="text-white/80">Description</Label>
                            <Textarea
                              id={`billing-${plan}-description`}
                              value={planDraft.description}
                              onChange={(event) => {
                                const value = event.target.value;
                                setBillingCatalogDraft((current) => ({
                                  ...current,
                                  [plan]: {
                                    ...current[plan],
                                    description: value,
                                  },
                                }));
                              }}
                              placeholder="Plan description"
                              className="min-h-[104px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`billing-${plan}-features`} className="text-white/80">Features</Label>
                            <Textarea
                              id={`billing-${plan}-features`}
                              value={planDraft.featuresText}
                              onChange={(event) => {
                                const value = event.target.value;
                                setBillingCatalogDraft((current) => ({
                                  ...current,
                                  [plan]: {
                                    ...current[plan],
                                    featuresText: value,
                                  },
                                }));
                              }}
                              placeholder={"One feature per line"}
                              className="min-h-[136px] border-white/10 bg-[#0F1621] text-white placeholder:text-white/30"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  className="bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                  onClick={async () => {
                    const adminPageSizeValue = Number(adminPageSize);
                    const pageSizeToSave = Number.isFinite(adminPageSizeValue) && adminPageSizeValue > 0 ? adminPageSizeValue : 25;
                    const billingCatalogToSave = parseBillingCatalogDraft(billingCatalogDraft);

                    await Promise.all([
                      invokeAdminConsole("settings.platformConfig", {
                        key: "support_email",
                        value: { value: supportEmail },
                      }),
                      invokeAdminConsole("settings.platformConfig", {
                        key: "landing_banner",
                        value: { enabled: Boolean(bannerText), text: bannerText },
                      }),
                      invokeAdminConsole("settings.platformConfig", {
                        key: "maintenance_mode",
                        value: { enabled: maintenanceMode },
                      }),
                      invokeAdminConsole("settings.platformConfig", {
                        key: "admin_page_size",
                        value: { value: pageSizeToSave },
                      }),
                      invokeAdminConsole("settings.platformConfig", {
                        key: "billing_catalog",
                        value: billingCatalogToSave,
                      }),
                    ]);
                    toast({ title: "Config saved", description: "Platform configuration was updated." });
                    await refreshSettings();
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </AdminSectionCard>
        </TabsContent>

        <TabsContent value="danger" className="mt-4">
          <AdminSectionCard title="Danger Zone">
            {adminAccess.role !== "super_admin" ? (
              <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-4">
                <p className="font-medium text-[#FEF3C7]">Super-admin only area</p>
                <p className="mt-1 text-sm text-[#FCD34D]">
                  Danger Zone is reserved for rare platform-wide recovery and maintenance actions. Support admins can view
                  this section, but only super admins can execute these actions.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-4">
                  <p className="font-medium text-[#FEF3C7]">Why this exists</p>
                  <p className="mt-1 text-sm text-[#FCD34D]">
                    Use this area for controlled, high-impact platform actions only. Every action here is intended for
                    incident response, secure exports, or tightly managed maintenance and should be audit-traceable.
                  </p>
                </div>

                <div className="rounded-xl border border-white/5 bg-[#0F1621] p-4">
                  <p className="font-medium text-[#F1F5F9]">Export platform snapshot</p>
                  <p className="mt-1 text-sm text-white/55">
                    Downloads a JSON snapshot of businesses, members, invoices, bills, and payments for controlled backup,
                    investigation, or migration work. This action is audit logged.
                  </p>
                  <div className="mt-3 max-w-xs space-y-2">
                    <Label htmlFor="danger-export-confirm" className="text-white/80">Type EXPORT to continue</Label>
                    <Input
                      id="danger-export-confirm"
                      value={exportConfirmation}
                      onChange={(event) => setExportConfirmation(event.target.value)}
                      placeholder="EXPORT"
                      className="border-white/10 bg-[#161E2E] text-white placeholder:text-white/30"
                    />
                  </div>
                  <Button
                    className="mt-3 bg-[#3B82F6] text-white hover:bg-[#2563EB]"
                    disabled={exportConfirmation.trim().toUpperCase() !== "EXPORT"}
                    onClick={async () => {
                      const result = await invokeAdminConsole<Record<string, unknown>>("settings.dangerAction", { type: "export_platform_data" });
                      downloadJsonFile({
                        data: result,
                        filename: `${createExportFileName("platform-export")}.json`,
                      });
                      toast({ title: "Export ready", description: "The platform snapshot has been downloaded." });
                      setExportConfirmation("");
                    }}
                  >
                    Export Platform Data
                  </Button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-[#EF4444]/25 bg-gradient-to-br from-[#2A1720] via-[#1B1720] to-[#121722] shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
                  <div className="border-b border-white/10 px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl border border-[#FCA5A5]/20 bg-[#EF4444]/10 p-2.5 text-[#FCA5A5]">
                        <Trash2 className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-[#FFF1F2]">Test data cleanup</h3>
                          <AdminBadge tone="danger">Super admin</AdminBadge>
                        </div>
                          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#FDA4AF]">
                          Remove marked QA fixtures from the selected scope. Live financial records, production users, active payouts, and records without test proof remain protected.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex gap-3 rounded-xl border border-[#F59E0B]/20 bg-[#F59E0B]/10 p-3 text-sm text-[#FCD34D]">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p>For a complete database reset, use a separate staging/QA Supabase project. This control is intentionally limited to safe, marked test data.</p>
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-5">
                      <div>
                        <Label htmlFor="danger-test-data-resource" className="text-[#FFE4E6]">Cleanup scope</Label>
                        <select
                          id="danger-test-data-resource"
                          value={testDataResource}
                          onChange={(event) => {
                            const nextResource = event.target.value as typeof testDataResource;
                            setTestDataResource(nextResource);
                            setTestDataPreview(null);
                          }}
                          className="mt-2 h-11 w-full rounded-lg border border-[#FCA5A5]/25 bg-[#120F16] px-3 text-sm text-white outline-none transition focus:border-[#FCA5A5] focus:ring-2 focus:ring-[#FCA5A5]/20"
                        >
                          <option value="all">All marked test data</option>
                          <option value="payments">Marked payments only</option>
                          <option value="payouts">Marked payouts only</option>
                          <option value="other">Other marked test data</option>
                        </select>
                        <p className="mt-2 text-xs leading-5 text-white/45">Receivables linked to marked payments are included. Test users are removed only when every owned workspace is marked test.</p>
                      </div>
                      <Button
                        variant="ghost"
                        className="h-10 w-full border border-[#FCA5A5]/30 bg-[#7F1D1D]/20 text-[#FFE4E6] hover:bg-[#7F1D1D]/40"
                        onClick={() => void previewTestData()}
                      >
                        <Database className="mr-2 h-4 w-4" aria-hidden="true" />
                        Refresh preview
                      </Button>

                      {testDataPreview?.deletable ? (
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            ["Payments", testDataPreview.deletable.payments],
                            ["Receivables", testDataPreview.deletable.receivables ?? 0],
                            ["Payouts", testDataPreview.deletable.payouts],
                            ["Other records", Object.values(testDataPreview.other ?? {}).reduce((sum, value) => sum + (typeof value === "number" ? value : 0), 0) - (testDataPreview.other?.blocked ?? 0)],
                            ["Blocked", (testDataPreview.blocked?.payments?.length ?? 0) + (testDataPreview.blocked?.payouts?.length ?? 0) + (testDataPreview.other?.blocked ?? 0)],
                          ].map(([label, count]) => (
                            <div key={label} className="rounded-xl border border-white/10 bg-black/15 p-3">
                              <p className="text-xs text-white/45">{label}</p>
                              <p className="mt-1 text-xl font-semibold text-white">{count}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-white/10 bg-black/15 p-4 text-sm text-white/55">Preview the selected scope to see what can be removed.</div>
                      )}
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/15 p-4 sm:p-5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-[#FCA5A5]" aria-hidden="true" />
                        <h4 className="font-medium text-[#FFF1F2]">Confirm deletion</h4>
                      </div>
                      {testDataPreview?.deletable ? (
                        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/10 p-3 text-sm text-[#BBF7D0]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                          <p>{testDataDeletionCount ? `${testDataDeletionCount} linked record(s) will be deleted after confirmation.` : "No deletable records found in this scope."}</p>
                        </div>
                      ) : null}
                      <div className="mt-4 space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="danger-test-data-reason" className="text-[#FFE4E6]">Reason for cleanup</Label>
                          <Textarea
                            id="danger-test-data-reason"
                            value={testDataReason}
                            onChange={(event) => setTestDataReason(event.target.value)}
                            placeholder="Example: Remove QA fixtures after release verification"
                            className="min-h-[108px] w-full resize-y border-[#FCA5A5]/20 bg-[#120F16] text-white placeholder:text-[#FCA5A5]/50"
                          />
                          <p className="text-xs text-white/40">Use at least 10 characters so the cleanup is traceable in the audit log.</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="danger-test-data-confirm" className="text-[#FFE4E6]">Type DELETE TEST DATA</Label>
                          <Input
                            id="danger-test-data-confirm"
                            value={testDataConfirmation}
                            onChange={(event) => setTestDataConfirmation(event.target.value)}
                            placeholder="DELETE TEST DATA"
                            className="border-[#FCA5A5]/20 bg-[#120F16] text-white placeholder:text-[#FCA5A5]/50"
                          />
                        </div>
                        {testDataDeletionCount > 1 ? (
                          <div className="space-y-2">
                            <Label htmlFor="danger-test-data-bulk-confirm" className="text-[#FFE4E6]">Type {buildBulkTestDataConfirmation(testDataDeletionCount)}</Label>
                            <Input
                              id="danger-test-data-bulk-confirm"
                              value={testDataBulkConfirmation}
                              onChange={(event) => setTestDataBulkConfirmation(event.target.value)}
                              placeholder={buildBulkTestDataConfirmation(testDataDeletionCount)}
                              className="border-[#FCA5A5]/20 bg-[#120F16] text-white placeholder:text-[#FCA5A5]/50"
                            />
                          </div>
                        ) : null}
                        <Button
                          className="h-11 w-full bg-[#EF4444] text-white shadow-lg shadow-[#EF4444]/10 hover:bg-[#DC2626]"
                          disabled={isCleaningTestData || !testDataPreview || testDataDeletionCount === 0 || testDataReason.trim().length < 10 || testDataConfirmation.trim().toUpperCase() !== "DELETE TEST DATA" || (testDataDeletionCount > 1 && testDataBulkConfirmation.trim().toUpperCase() !== buildBulkTestDataConfirmation(testDataDeletionCount))}
                          onClick={async () => {
                            setIsCleaningTestData(true);
                            try {
                              const result = await invokeAdminConsole<{ deleted: { announcements?: number; bills?: number; businesses?: number; checkoutSessions?: number; content?: number; customers?: number; invoices?: number; payments: number; payouts: number; signupAlerts?: number; users?: number; vendors?: number } }>("testData.delete", { confirmation: "DELETE TEST DATA", bulkConfirmation: testDataBulkConfirmation.trim(), reason: testDataReason.trim(), resource: testDataResource });
                              const supportingCount = (result.deleted.announcements ?? 0) + (result.deleted.bills ?? 0) + (result.deleted.businesses ?? 0) + (result.deleted.checkoutSessions ?? 0) + (result.deleted.content ?? 0) + (result.deleted.customers ?? 0) + (result.deleted.signupAlerts ?? 0) + (result.deleted.users ?? 0) + (result.deleted.vendors ?? 0);
                              toast({ title: "Test data deleted", description: `${result.deleted.payments} payment(s), ${result.deleted.invoices ?? 0} invoice(s), ${result.deleted.payouts} payout(s), and ${supportingCount} other record(s) removed.` });
                              setTestDataConfirmation("");
                              setTestDataBulkConfirmation("");
                              setTestDataReason("");
                              setTestDataPreview(null);
                            } catch (error) {
                              toast({ title: "Cleanup failed", description: error instanceof Error ? error.message : "Unable to delete test data.", variant: "destructive" });
                            } finally {
                              setIsCleaningTestData(false);
                            }
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
                          {isCleaningTestData ? "Deleting..." : "Delete marked test data"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </AdminSectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettingsPage;
