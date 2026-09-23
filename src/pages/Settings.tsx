import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "@/components/app/AppLayout";
import { EmptyState } from "@/components/app/EmptyState";
import OperationStatusNotice, { type OperationStatusState } from "@/components/app/OperationStatusNotice";
import { SettingsSectionSkeleton } from "@/components/app/StandalonePageSkeletons";
import { useAuth, type AuthSignOutScope } from "@/contexts/AuthContext";
import type { Enums } from "@/integrations/supabase/types";
import {
  useNotificationPreferencesData,
  useScheduledDigestRunData,
  useUpdateNotificationPreferences,
  type NotificationPreferenceState,
} from "@/hooks/use-notifications-data";
import {
  useAccountSessionInventoryData,
  useMarkAccountSessionsSignedOut,
  type AccountSessionInventoryItem,
} from "@/hooks/use-account-session-inventory";
import { useSendDigestPreviewEmail, useSendTeamInviteEmail } from "@/hooks/use-email-delivery";
import { useGenerateMfaRecoveryCodes, useMfaRecoverySummaryData } from "@/hooks/use-mfa-recovery";
import {
  getAccountDataExportSnapshot,
  getWorkspaceDataExportSnapshot,
  usePrivacyPreferencesData,
  useSendPasswordReauthentication,
  useSecurityActivityData,
  useSettingsData,
  useUpdateBusiness,
  useUpdatePrivacyPreferences,
  useUpdatePassword,
  useUpdateProfile,
} from "@/hooks/use-settings-data";
import { useSubscriptionManagement } from "@/hooks/use-subscription-management";
import { usePublicPricingCatalog } from "@/hooks/use-public-pricing-catalog";
import { useWorkspaceSubscription } from "@/hooks/use-workspace-subscription";
import {
  type TeamMemberItem,
  type WorkspaceInvitationItem,
  useTeamMemberMutations,
  useTeamMembersData,
  useWorkspaceInvitationsData,
} from "@/hooks/use-team-data";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { useSessionTimeout } from "@/contexts/SessionTimeoutContext";
import { supportedLanguages, supportedLocales, useLocalization } from "@/hooks/use-localization";
import { getFormFieldAriaProps } from "@/lib/accessibility";
import { waitForUiFrame } from "@/lib/async";
import { logAuditEventSafe } from "@/lib/audit";
import { getCurrentDeviceSnapshot } from "@/lib/device";
import { createExportFileName, downloadJsonFile } from "@/lib/export";
import {
  defaultBusinessLanguage,
  defaultBusinessLocale,
  defaultTimezone,
  formatCurrencyValue,
  formatDateOnlyValue,
  formatDateTimeValue,
  formatNumberValue,
} from "@/lib/localization";
import { defaultNotificationPreferences } from "@/lib/notifications";
import { filterPhoneInput, normalizePhoneNumber, phonePlaceholder } from "@/lib/phone";
import { defaultPrivacyPreferences, type PrivacyPreferenceState } from "@/lib/privacy";
import { createFormValidator, getFriendlyErrorMessage, ValidationRules } from "@/lib/error-handling";
import { type AppMfaFactor, type AuthenticatorAssuranceLevel, validateTotpCode } from "@/lib/mfa";
import { formatRecoveryCode, getSessionIdFromAccessToken } from "@/lib/mfa-recovery";
import {
  getPasswordStrength,
  normalizeVerificationCode,
  validatePasswordChangeForm,
  type PasswordChangeFormErrors,
} from "@/lib/passwords";
import { supabase } from "@/lib/supabase";
import { cancelWorkspaceSubscription } from "@/lib/workspace-subscriptions";
import { getDefaultSubscriptionBillingCycle, subscriptionCatalog, type SubscriptionPlan } from "@/lib/subscriptions";
import {
  Ban,
  Bell,
  Building2,
  Camera,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Loader2,
  Mail,
  MonitorSmartphone,
  Moon,
  PackageOpen,
  QrCode,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  Smartphone,
  ShieldAlert,
  Sun,
  Trash2,
  User,
  UserPlus,
  Users,
  CheckCircle2,
} from "lucide-react";

const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const currencyOptions = [
  { label: "Nigerian Naira (NGN)", value: "NGN" },
  { label: "US Dollar (USD)", value: "USD" },
  { label: "British Pound (GBP)", value: "GBP" },
] as const;
const workspaceDefaultPreferenceValue = "workspace-default";
const notificationOptions: Array<{
  description: string;
  key: keyof NotificationPreferenceState;
  label: string;
}> = [
  {
    description: "Get an in-app update whenever an invoice is marked as sent.",
    key: "invoice_sent",
    label: "Invoice Sent",
  },
  {
    description: "Get notified when receivable or payable payment activity is completed.",
    key: "payment_received",
    label: "Payment Activity",
  },
  {
    description: "Get reminded when a bill is scheduled or approaching payment.",
    key: "bill_due",
    label: "Bill Due",
  },
  {
    description: "Surface overdue invoice and bill activity in your workspace alerts.",
    key: "overdue",
    label: "Overdue Items",
  },
  {
    description: "Receive alerts when teammate access, roles, or workspace membership changes.",
    key: "team_updates",
    label: "Team Updates",
  },
  {
    description: "Keep weekly summary reports enabled for your workspace digest.",
    key: "weekly_report",
    label: "Weekly Report",
  },
  {
    description: "Allow digest emails and test delivery from the notifications settings panel.",
    key: "email_digest",
    label: "Email Digest",
  },
  {
    description: "Reserve push delivery preferences for the mobile/web push phase.",
    key: "push_notifications",
    label: "Push Notifications",
  },
] as const;

const privacyOptions: Array<{
  description: string;
  key: keyof PrivacyPreferenceState;
  label: string;
}> = [
  {
    description: "Allow anonymous product analytics when the observability phase is enabled later.",
    key: "analytics_opt_in",
    label: "Anonymous Usage Analytics",
  },
  {
    description: "Keep product and account update messages enabled for this account.",
    key: "product_updates_opt_in",
    label: "Product Updates",
  },
  {
    description: "Include customer, vendor, and teammate contact details in workspace exports.",
    key: "include_contact_details_in_exports",
    label: "Include Contact Details In Exports",
  },
  {
    description: "Include audit trail history when downloading a workspace export snapshot.",
    key: "include_audit_log_in_exports",
    label: "Include Audit Trail In Exports",
  },
] as const;

type SecurityExportAction = "account" | "workspace";
type SecurityExportStatus = {
  action: SecurityExportAction;
  description: string;
  state: OperationStatusState;
  title: string;
} | null;
type EmailDeliveryAction = "digest-preview" | "team-invite";
type EmailDeliveryStatus = {
  action: EmailDeliveryAction;
  description: string;
  state: OperationStatusState;
  title: string;
} | null;

const monthNameToNumber = (monthName: string) => {
  const monthIndex = monthOptions.findIndex((month) => month === monthName);
  return monthIndex >= 0 ? monthIndex + 1 : 1;
};

const monthNumberToName = (monthNumber: number | null | undefined) =>
  monthOptions[Math.min(Math.max((monthNumber ?? 1) - 1, 0), monthOptions.length - 1)];

const normalizeRequiredText = (value: string) => value.replace(/\s+/g, " ").trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();

const normalizeOptionalText = (value: string) => {
  const normalizedValue = normalizeRequiredText(value);
  return normalizedValue || null;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) =>
  getFriendlyErrorMessage(error, fallbackMessage);

const getPasswordSubmissionErrors = (error: unknown): PasswordChangeFormErrors => {
  const message = getErrorMessage(error, "").toLowerCase();

  if (!message) {
    return {};
  }

  if (message.includes("current password")) {
    return {
      currentPassword: "Current password could not be verified.",
    };
  }

  if (
    message.includes("reauthentication") ||
    message.includes("verification code") ||
    message.includes("nonce")
  ) {
    return {
      verificationCode: "Enter the verification code from your email, or request a new one.",
    };
  }

  if (message.includes("same password")) {
    return {
      newPassword: "New password must be different from the current password.",
    };
  }

  if (message.includes("weak password")) {
    return {
      newPassword: "Choose a stronger password before saving.",
    };
  }

  return {};
};

const getInitials = (value: string) => {
  const parts = value
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "MN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
};

const formatRoleLabel = (role: string | null | undefined) => {
  if (!role) return "Owner";

  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatStatusLabel = (status: Enums<"business_member_status">) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const formatInvitationStatusLabel = (status: WorkspaceInvitationItem["status"]) =>
  status.charAt(0).toUpperCase() + status.slice(1);

const getStatusBadgeClassName = (status: Enums<"business_member_status">) => {
  if (status === "active") {
    return "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]";
  }

  if (status === "revoked") {
    return "bg-destructive/10 text-destructive";
  }

  return "bg-secondary text-secondary-foreground";
};

const formatJoinedDate = (value: string) =>
  formatDateOnlyValue(value, {
    locale: defaultBusinessLocale,
    timezone: defaultTimezone,
  });

const formatDateTime = (value: string | number | Date | null | undefined) => {
  return formatDateTimeValue(value, {
    locale: defaultBusinessLocale,
    timezone: defaultTimezone,
  });
};

const formatAuthProvider = (provider: string | null | undefined) => {
  if (!provider) return "Email and password";

  return provider
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const formatAuthMethodLabel = (value: string) =>
  value
    .replace(/_/g, " ")
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const formatAalLabel = (value: AuthenticatorAssuranceLevel) => {
  if (value === "aal2") return "AAL2";
  if (value === "aal1") return "AAL1";
  return "Not available";
};

const isExpiredTimestamp = (value: string | null | undefined) => {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
};

const getAccountSessionStatus = (
  sessionItem: AccountSessionInventoryItem,
): { className: string; label: string } => {
  if (sessionItem.signedOutAt) {
    return {
      className: "bg-secondary text-secondary-foreground",
      label: "Signed out",
    };
  }

  if (isExpiredTimestamp(sessionItem.expiresAt)) {
    return {
      className: "bg-destructive/10 text-destructive",
      label: "Expired",
    };
  }

  return {
    className: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
    label: "Active",
  };
};

const getMfaQrCodeDataUrl = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "";
  }

  if (normalizedValue.startsWith("data:image/svg+xml")) {
    return normalizedValue;
  }

  if (normalizedValue.startsWith("<svg") || normalizedValue.startsWith("<?xml")) {
    return `data:image/svg+xml;utf-8,${encodeURIComponent(normalizedValue)}`;
  }

  return `data:image/svg+xml;utf-8,${normalizedValue}`;
};

const getRecoveryCodesDownloadText = (codes: string[], generatedAt: string) =>
  [
    "moniger.net MFA Recovery Codes",
    `Generated: ${formatDateTime(generatedAt)}`,
    "",
    "Store these codes somewhere safe. Each code can only be used once.",
    "",
    ...codes,
    "",
    "If you generate a new set, the old codes stop working immediately.",
  ].join("\r\n");

const roleOptions: Array<{
  description: string;
  label: string;
  value: Enums<"business_role">;
}> = [
  {
    description: "Full workspace management except ownership transfer.",
    label: "Admin",
    value: "admin",
  },
  {
    description: "Finance operations access for invoices, bills, and payments.",
    label: "Accountant",
    value: "accountant",
  },
  {
    description: "Read-only workspace access for visibility and review.",
    label: "Viewer",
    value: "viewer",
  },
];

type SettingsTab = "business" | "notifications" | "profile" | "security";
type SettingsPageSection = SettingsTab | "team";
type ProfileFormErrors = Partial<Record<"fullName" | "phone", string>>;
type BusinessFormErrors = Partial<Record<"name" | "phone", string>>;
type InviteFormErrors = Partial<Record<"email", string>>;
type SecurityAction = Extract<AuthSignOutScope, "global" | "others">;
type PasswordFormState = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
  verificationCode: string;
};
type MfaFormErrors = Partial<Record<"friendlyName" | "verificationCode", string>>;
type MfaSetupState = {
  challengeId: string;
  factorId: string;
  friendlyName: string;
  qrCode: string;
  secret: string;
  uri: string;
};
type RecoveryCodesDialogState = {
  codes: string[];
  generatedAt: string;
} | null;
type PayoutRoutingFormState = {
  accountName: string;
  accountNumber: string;
  bankId: string;
  countryCode: string;
  currency: string;
  providerSettlementBankCode: string;
};

const settingsTabValues: SettingsTab[] = ["profile", "security", "business", "notifications"];
const profileFormValidator = createFormValidator({
  fullName: [ValidationRules.trimmedRequired()],
  phone: [ValidationRules.optional(ValidationRules.phone())],
});
const businessFormValidator = createFormValidator({
  name: [ValidationRules.trimmedRequired()],
  phone: [ValidationRules.optional(ValidationRules.phone())],
});
const inviteFormValidator = createFormValidator({
  email: [ValidationRules.trimmedRequired(), ValidationRules.email()],
});
const inputErrorClassName = "border-destructive focus-visible:ring-destructive";
const inlineErrorClassName = "text-sm font-medium text-destructive";
const profileImageBucketName = "profile-images";
const allowedProfileImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const maxProfileImageSizeInBytes = 2 * 1024 * 1024;

const isSettingsTab = (value: string | null): value is SettingsTab =>
  value ? settingsTabValues.includes(value as SettingsTab) : false;

const sanitizeFileName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const getProfileImageValidationError = (file: File) => {
  if (!allowedProfileImageTypes.includes(file.type as (typeof allowedProfileImageTypes)[number])) {
    return "Upload a PNG, JPG, or WebP image.";
  }

  if (file.size > maxProfileImageSizeInBytes) {
    return "Profile images must be 2MB or smaller.";
  }

  return null;
};

const getProfileImagePath = (userId: string, file: File) => {
  const sanitizedName = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "avatar";
  const extension =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";

  return `${userId}/avatar-${Date.now()}-${sanitizedName}.${extension}`;
};

const getRoutingStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case "verified":
      return "Verified";
    case "pending_verification":
      return "Pending verification";
    case "pending_provider_sync":
      return "Needs admin re-sync";
    case "ready":
      return "Ready";
    case "draft":
      return "Draft";
    case "errored":
      return "Needs attention";
    case "disabled":
      return "Disabled";
    default:
      return "Not configured";
  }
};

const getRoutingStatusBadgeClassName = (status: string | null | undefined) => {
  switch (status) {
    case "verified":
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "pending_verification":
    case "pending_provider_sync":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "errored":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "draft":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
};

const extractProfileImageStoragePath = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const marker = `/storage/v1/object/public/${profileImageBucketName}/`;
  const markerIndex = value.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(value.slice(markerIndex + marker.length));
};

type SettingsPageProps = {
  standaloneTab?: "team";
};

const SettingsPage = ({ standaloneTab }: SettingsPageProps = {}) => {
  const { formatCurrency, formatDate, formatDateTime: formatLocalizedDateTime, formatNumber, t, timezone } = useLocalization();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const { sessionTimeoutMinutes, setSessionTimeoutMinutes } = useSessionTimeout();
  const {
    currentAuthMethods,
    currentAal,
    mfaFactors,
    mfaLoading,
    nextAal,
    refreshMfaState,
    session,
    signOut,
    user,
    verifiedMfaFactors,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const settingsQuery = useSettingsData(user?.id);
  const businessId = settingsQuery.data?.business?.id;
  const workspaceSubscriptionQuery = useWorkspaceSubscription();
  const { data: pricingCatalog } = usePublicPricingCatalog();
  const notificationPreferencesQuery = useNotificationPreferencesData(businessId, user?.id);
  const scheduledDigestRunQuery = useScheduledDigestRunData(businessId, user?.id);
  const privacyPreferencesQuery = usePrivacyPreferencesData(businessId, user?.id);
  const securityActivityQuery = useSecurityActivityData(businessId, user?.id);
  const accountSessionInventoryQuery = useAccountSessionInventoryData(user?.id);
  const mfaRecoverySummaryQuery = useMfaRecoverySummaryData(user?.id);
  const teamMembersQuery = useTeamMembersData(businessId, user?.id);
  const workspaceInvitationsQuery = useWorkspaceInvitationsData(businessId);
  const teamMutations = useTeamMemberMutations(businessId);
  const sendDigestPreviewEmailMutation = useSendDigestPreviewEmail();
  const sendTeamInviteEmailMutation = useSendTeamInviteEmail();
  const updateNotificationPreferencesMutation = useUpdateNotificationPreferences(businessId, user?.id);
  const updatePrivacyPreferencesMutation = useUpdatePrivacyPreferences(businessId, user?.id);
  const updateProfileMutation = useUpdateProfile(user?.id);
  const updateBusinessMutation = useUpdateBusiness(user?.id);
  const { handleUpgrade, isLoading: isSubscriptionActionPending } = useSubscriptionManagement();
  const sendPasswordReauthenticationMutation = useSendPasswordReauthentication();
  const updatePasswordMutation = useUpdatePassword(user?.id, businessId);
  const generateMfaRecoveryCodesMutation = useGenerateMfaRecoveryCodes(user?.id);
  const markAccountSessionsSignedOutMutation = useMarkAccountSessionsSignedOut(user?.id);

  const [profile, setProfile] = useState({
    email: "",
    fullName: "",
    language: workspaceDefaultPreferenceValue,
    locale: workspaceDefaultPreferenceValue,
    phone: "",
  });
  const profileImageInputRef = useRef<HTMLInputElement | null>(null);
  const [business, setBusiness] = useState({
    address: "",
    currency: "NGN",
    rcNumber: "",
    fiscalYear: "January",
    language: defaultBusinessLanguage,
    locale: defaultBusinessLocale,
    name: "",
    phone: "",
    taxId: "",
  });
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreferenceState>(defaultNotificationPreferences);
  const [privacyPreferences, setPrivacyPreferences] =
    useState<PrivacyPreferenceState>(defaultPrivacyPreferences);
  const [profileHydrationKey, setProfileHydrationKey] = useState("");
  const [profileAvatarPreviewUrl, setProfileAvatarPreviewUrl] = useState<string | null>(null);
  const [profileImageError, setProfileImageError] = useState<string | null>(null);
  const [isProfileImageUploading, setIsProfileImageUploading] = useState(false);
  const [businessHydrationKey, setBusinessHydrationKey] = useState("");
  const [notificationHydrationKey, setNotificationHydrationKey] = useState("");
  const [privacyHydrationKey, setPrivacyHydrationKey] = useState("");
  const [profileErrors, setProfileErrors] = useState<ProfileFormErrors>({});
  const [businessErrors, setBusinessErrors] = useState<BusinessFormErrors>({});
  const [inviteErrors, setInviteErrors] = useState<InviteFormErrors>({});
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Enums<"business_role">>("viewer");
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [cancelSubscriptionDialogOpen, setCancelSubscriptionDialogOpen] = useState(false);
  const [cancelSubscriptionPending, setCancelSubscriptionPending] = useState(false);
  const [upgradePlanPending, setUpgradePlanPending] = useState<SubscriptionPlan | null>(null);
  const [memberPendingRevoke, setMemberPendingRevoke] = useState<TeamMemberItem | null>(null);
  const [pendingSecurityScope, setPendingSecurityScope] = useState<AuthSignOutScope | null>(null);
  const [confirmSecurityAction, setConfirmSecurityAction] = useState<SecurityAction | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>({
    confirmPassword: "",
    currentPassword: "",
    newPassword: "",
    verificationCode: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<PasswordChangeFormErrors>({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [mfaSetupOpen, setMfaSetupOpen] = useState(false);
  const [mfaFriendlyName, setMfaFriendlyName] = useState("Primary authenticator");
  const [mfaVerificationCode, setMfaVerificationCode] = useState("");
  const [mfaErrors, setMfaErrors] = useState<MfaFormErrors>({});
  const [mfaSetupState, setMfaSetupState] = useState<MfaSetupState | null>(null);
  const [recoveryCodesDialogState, setRecoveryCodesDialogState] = useState<RecoveryCodesDialogState>(null);
  const [mfaEnrollPending, setMfaEnrollPending] = useState(false);
  const [mfaVerifyPending, setMfaVerifyPending] = useState(false);
  const [mfaDisableDialogOpen, setMfaDisableDialogOpen] = useState(false);
  const [mfaDisablePending, setMfaDisablePending] = useState(false);
  const [factorPendingRemoval, setFactorPendingRemoval] = useState<AppMfaFactor | null>(null);
  const [securityExportStatus, setSecurityExportStatus] = useState<SecurityExportStatus>(null);
  const [sessionTimeoutInput, setSessionTimeoutInput] = useState(() => String(sessionTimeoutMinutes));
  const [emailDeliveryStatus, setEmailDeliveryStatus] = useState<EmailDeliveryStatus>(null);
  const currentDeviceSnapshot = useMemo(() => getCurrentDeviceSnapshot(), []);

  const settings = settingsQuery.data;
  const activeTabParam = searchParams.get("tab");
  const activeTab: SettingsPageSection =
    standaloneTab ?? (activeTabParam === "team" ? "team" : isSettingsTab(activeTabParam) ? activeTabParam : "profile");
  const profileSnapshot = useMemo(
    () => ({
      avatarUrl: settings?.profile?.avatar_url ?? null,
      fullName:
        settings?.profile?.full_name ??
        (typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : ""),
      email: user?.email ?? "",
      language: settings?.profile?.language ?? workspaceDefaultPreferenceValue,
      locale: settings?.profile?.locale ?? workspaceDefaultPreferenceValue,
      phone: settings?.profile?.phone ?? "",
    }),
    [
      settings?.profile?.avatar_url,
      settings?.profile?.full_name,
      settings?.profile?.language,
      settings?.profile?.locale,
      settings?.profile?.phone,
      user?.email,
      user?.user_metadata?.name,
    ],
  );
  const businessSnapshot = useMemo(
    () => ({
      address: settings?.business?.address ?? "",
      currency: settings?.business?.default_currency ?? settings?.profile?.default_currency ?? "NGN",
      fiscalYear: monthNumberToName(settings?.business?.fiscal_year_start_month),
      language: settings?.business?.default_language ?? defaultBusinessLanguage,
      locale: settings?.business?.default_locale ?? defaultBusinessLocale,
      name: settings?.business?.name ?? "",
      phone: settings?.business?.phone ?? "",
      rcNumber: settings?.business?.rc_number ?? "",
      taxId: settings?.business?.tax_id ?? "",
    }),
    [
      settings?.business?.address,
      settings?.business?.default_currency,
      settings?.business?.default_language,
      settings?.business?.default_locale,
      settings?.business?.fiscal_year_start_month,
      settings?.business?.name,
      settings?.business?.phone,
      settings?.business?.rc_number,
      settings?.business?.tax_id,
      settings?.profile?.default_currency,
    ],
  );
  const notificationSnapshot = useMemo(
    () => ({
      ...defaultNotificationPreferences,
      ...(notificationPreferencesQuery.data ?? {}),
    }),
    [notificationPreferencesQuery.data],
  );
  const privacySnapshot = useMemo(
    () => ({
      ...defaultPrivacyPreferences,
      ...(privacyPreferencesQuery.data ?? {}),
    }),
    [privacyPreferencesQuery.data],
  );
  const profileSnapshotKey = useMemo(
    () =>
      [
        user?.id ?? "guest",
        settings?.profile?.updated_at ?? "missing",
        profileSnapshot.avatarUrl ?? "no-avatar",
        profileSnapshot.fullName,
        profileSnapshot.email,
        profileSnapshot.language,
        profileSnapshot.locale,
        profileSnapshot.phone,
      ].join("|"),
    [
      profileSnapshot.avatarUrl,
      profileSnapshot.email,
      profileSnapshot.fullName,
      profileSnapshot.language,
      profileSnapshot.locale,
      profileSnapshot.phone,
      settings?.profile?.updated_at,
      user?.id,
    ],
  );
  const businessSnapshotKey = useMemo(
    () =>
      [
        settings?.business?.id ?? "missing",
        settings?.business?.updated_at ?? "missing",
        businessSnapshot.name,
        businessSnapshot.phone,
        businessSnapshot.address,
        businessSnapshot.rcNumber,
        businessSnapshot.taxId,
        businessSnapshot.currency,
        businessSnapshot.fiscalYear,
        businessSnapshot.language,
        businessSnapshot.locale,
      ].join("|"),
    [
      businessSnapshot.address,
      businessSnapshot.currency,
      businessSnapshot.fiscalYear,
      businessSnapshot.language,
      businessSnapshot.locale,
      businessSnapshot.name,
      businessSnapshot.phone,
      businessSnapshot.rcNumber,
      businessSnapshot.taxId,
      settings?.business?.id,
      settings?.business?.updated_at,
    ],
  );
  const notificationSnapshotKey = useMemo(
    () =>
      [
        businessId ?? "missing",
        ...Object.entries(notificationSnapshot).map(([key, value]) => `${key}:${value ? "1" : "0"}`),
      ].join("|"),
    [businessId, notificationSnapshot],
  );
  const privacySnapshotKey = useMemo(
    () =>
      [
        businessId ?? "missing",
        ...Object.entries(privacySnapshot).map(([key, value]) => `${key}:${value ? "1" : "0"}`),
      ].join("|"),
    [businessId, privacySnapshot],
  );

  useEffect(() => {
    if (profileHydrationKey === profileSnapshotKey) return;
    setProfile({
      email: profileSnapshot.email,
      fullName: profileSnapshot.fullName,
      language: profileSnapshot.language,
      locale: profileSnapshot.locale,
      phone: profileSnapshot.phone,
    });
    setProfileAvatarPreviewUrl(profileSnapshot.avatarUrl);
    setProfileImageError(null);
    setProfileErrors({});
    setProfileHydrationKey(profileSnapshotKey);
  }, [profileHydrationKey, profileSnapshot, profileSnapshotKey]);

  useEffect(() => {
    if (businessHydrationKey === businessSnapshotKey) return;
    setBusiness(businessSnapshot);
    setBusinessErrors({});
    setBusinessHydrationKey(businessSnapshotKey);
  }, [businessHydrationKey, businessSnapshot, businessSnapshotKey]);

  useEffect(() => {
    setSessionTimeoutInput(String(sessionTimeoutMinutes));
  }, [sessionTimeoutMinutes]);

  useEffect(() => {
    if (notificationHydrationKey === notificationSnapshotKey) return;
    setNotificationPreferences(notificationSnapshot);
    setNotificationHydrationKey(notificationSnapshotKey);
  }, [notificationHydrationKey, notificationSnapshot, notificationSnapshotKey]);

  useEffect(() => {
    if (privacyHydrationKey === privacySnapshotKey) return;
    setPrivacyPreferences(privacySnapshot);
    setPrivacyHydrationKey(privacySnapshotKey);
  }, [privacyHydrationKey, privacySnapshot, privacySnapshotKey]);

  useEffect(() => {
    if (!standaloneTab && activeTabParam === "team") {
      navigate("/team", { replace: true });
    }
  }, [activeTabParam, navigate, standaloneTab]);

  const isInitialLoading = settingsQuery.isLoading && !settings;
  const hasSettingsError = Boolean(settingsQuery.error);
  const hasNotificationError = Boolean(notificationPreferencesQuery.error);
  const hasPrivacyError = Boolean(privacyPreferencesQuery.error);
  const hasAccountSessionInventoryError = Boolean(accountSessionInventoryQuery.error);
  const hasSecurityActivityError = Boolean(securityActivityQuery.error);
  const hasTeamError = Boolean(teamMembersQuery.error);
  const hasWorkspaceInvitationsError = Boolean(workspaceInvitationsQuery.error);
  const canManageTeam = settings?.membership?.role === "owner" || settings?.membership?.role === "admin";
  const teamMembers = teamMembersQuery.data ?? [];
  const workspaceInvitations = workspaceInvitationsQuery.data ?? [];
  const activeMemberCount = teamMembers.filter((member) => member.status === "active").length;
  const revokedMemberCount = teamMembers.filter((member) => member.status === "revoked").length;
  const pendingMemberCount =
    teamMembers.filter((member) => member.status === "pending").length +
    workspaceInvitations.filter((invitation) => invitation.status === "pending").length;
  const isTeamBusy =
    teamMembersQuery.isLoading ||
    workspaceInvitationsQuery.isLoading ||
    teamMutations.inviteMember.isPending ||
    teamMutations.updateMemberRole.isPending ||
    teamMutations.updateMemberStatus.isPending;
  const isProfileDirty =
    profile.fullName !== profileSnapshot.fullName ||
    profile.phone !== profileSnapshot.phone ||
    profile.language !== profileSnapshot.language ||
    profile.locale !== profileSnapshot.locale;
  const isBusinessDirty =
    business.name !== businessSnapshot.name ||
    business.phone !== businessSnapshot.phone ||
    business.address !== businessSnapshot.address ||
    business.rcNumber !== businessSnapshot.rcNumber ||
    business.taxId !== businessSnapshot.taxId ||
    business.currency !== businessSnapshot.currency ||
    business.fiscalYear !== businessSnapshot.fiscalYear ||
    business.language !== businessSnapshot.language ||
    business.locale !== businessSnapshot.locale;
  const isNotificationDirty = notificationOptions.some(
    (option) => notificationPreferences[option.key] !== notificationSnapshot[option.key],
  );
  const isPrivacyDirty = privacyOptions.some(
    (option) => privacyPreferences[option.key] !== privacySnapshot[option.key],
  );
  const accountSessions = accountSessionInventoryQuery.data ?? [];
  const currentSessionId = session?.access_token ? getSessionIdFromAccessToken(session.access_token) : null;
  const currentInventorySession =
    accountSessions.find((sessionItem) => sessionItem.sessionId === currentSessionId) ?? null;
  const otherKnownSessions = accountSessions.filter((sessionItem) => sessionItem.sessionId !== currentSessionId);
  const profilePreviewLocale =
    profile.locale === workspaceDefaultPreferenceValue ? business.locale ?? defaultBusinessLocale : profile.locale;
  const profilePreviewCurrency = business.currency || "NGN";
  const profilePreviewDate = formatDateOnlyValue(new Date(), {
    locale: profilePreviewLocale,
    timezone: settings?.profile?.timezone ?? timezone ?? defaultTimezone,
  });
  const profilePreviewDateTime = formatDateTimeValue(new Date(), {
    locale: profilePreviewLocale,
    timezone: settings?.profile?.timezone ?? timezone ?? defaultTimezone,
  });
  const profilePreviewNumber = formatNumberValue(1234567.89, { locale: profilePreviewLocale });
  const profilePreviewMoney = formatCurrencyValue(12500.5, { currency: profilePreviewCurrency, locale: profilePreviewLocale });
  const businessPreviewDate = formatDateOnlyValue(new Date(), {
    locale: business.locale,
    timezone: settings?.profile?.timezone ?? timezone ?? defaultTimezone,
  });
  const businessPreviewNumber = formatNumberValue(1234567.89, { locale: business.locale });
  const businessPreviewMoney = formatCurrencyValue(12500.5, { currency: business.currency, locale: business.locale });
  const currentProfileAvatarUrl = profileAvatarPreviewUrl ?? profileSnapshot.avatarUrl;

  const clearProfileError = (field: keyof ProfileFormErrors) => {
    setProfileErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const handleOpenProfileImagePicker = () => {
    setProfileImageError(null);
    profileImageInputRef.current?.click();
  };

  const handleRemoveProfileImage = async () => {
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "You must be signed in before updating your profile photo.",
        variant: "destructive",
      });
      return;
    }

    const existingImagePath = extractProfileImageStoragePath(profileAvatarPreviewUrl);
    setIsProfileImageUploading(true);
    setProfileImageError(null);

    try {
      await updateProfileMutation.mutateAsync({
        avatar_url: null,
      });

      if (existingImagePath) {
        const { error: removeError } = await supabase.storage.from(profileImageBucketName).remove([existingImagePath]);
        if (removeError) {
          console.warn("Unable to remove previous profile image from storage.", removeError);
        }
      }

      setProfileAvatarPreviewUrl(null);
      toast({
        title: "Profile photo removed",
        description: "Your avatar has been cleared.",
      });
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");
      setProfileImageError(message);
      toast({
        title: "Unable to remove profile photo",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProfileImageUploading(false);
    }
  };

  const handleProfileImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "You must be signed in before updating your profile photo.",
        variant: "destructive",
      });
      return;
    }

    const validationMessage = getProfileImageValidationError(file);
    if (validationMessage) {
      setProfileImageError(validationMessage);
      return;
    }

    const previousImagePath = extractProfileImageStoragePath(profileAvatarPreviewUrl);
    const nextImagePath = getProfileImagePath(user.id, file);

    setIsProfileImageUploading(true);
    setProfileImageError(null);

    try {
      const { error: uploadError } = await supabase.storage.from(profileImageBucketName).upload(nextImagePath, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(profileImageBucketName).getPublicUrl(nextImagePath);

      await updateProfileMutation.mutateAsync({
        avatar_url: publicUrl,
      });

      if (previousImagePath) {
        const { error: removeError } = await supabase.storage.from(profileImageBucketName).remove([previousImagePath]);
        if (removeError) {
          console.warn("Unable to remove previous profile image from storage.", removeError);
        }
      }

      setProfileAvatarPreviewUrl(publicUrl);
      toast({
        title: "Profile photo updated",
        description: "Your new avatar is now visible across the workspace.",
      });
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");
      setProfileImageError(message);
      toast({
        title: "Unable to update profile photo",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProfileImageUploading(false);
    }
  };

  const clearBusinessError = (field: keyof BusinessFormErrors) => {
    setBusinessErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const clearInviteError = (field: keyof InviteFormErrors) => {
    setInviteErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const clearPasswordError = (field: keyof PasswordChangeFormErrors) => {
    setPasswordErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const resetPasswordForm = () => {
    setPasswordForm({
      confirmPassword: "",
      currentPassword: "",
      newPassword: "",
      verificationCode: "",
    });
    setPasswordErrors({});
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const clearMfaError = (field: keyof MfaFormErrors) => {
    setMfaErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
  };

  const resetMfaSetupState = () => {
    setMfaFriendlyName("Primary authenticator");
    setMfaVerificationCode("");
    setMfaErrors({});
    setMfaSetupState(null);
    setMfaEnrollPending(false);
    setMfaVerifyPending(false);
  };

  const closeMfaSetupDialog = async () => {
    const pendingSetupState = mfaSetupState;

    if (pendingSetupState && !mfaVerifyPending) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: pendingSetupState.factorId });

      if (error) {
        toast({
          title: "Setup left pending",
          description: "Finish verification or reopen setup later to complete authenticator enrollment.",
          variant: "destructive",
        });
      } else {
        await refreshMfaState();
      }
    }

    setMfaSetupOpen(false);
    resetMfaSetupState();
  };

  const handleProfileSave = async () => {
    if (isProfileImageUploading) {
      setProfileImageError("Please wait for the profile image upload to finish.");
      return;
    }

    const validationErrors = profileFormValidator({
      fullName: profile.fullName,
      phone: profile.phone.trim(),
    }) as ProfileFormErrors;

    if (Object.keys(validationErrors).length > 0) {
      setProfileErrors(validationErrors);
      return;
    }

    const normalizedFullName = normalizeRequiredText(profile.fullName);

    try {
      await updateProfileMutation.mutateAsync({
        full_name: normalizedFullName,
        language: profile.language === workspaceDefaultPreferenceValue ? null : profile.language,
        locale: profile.locale === workspaceDefaultPreferenceValue ? null : profile.locale,
        phone: normalizePhoneNumber(profile.phone),
      });

      toast({
        title: "Profile updated",
        description: "Your personal information has been saved.",
      });
      setProfileErrors({});
    } catch (error) {
      toast({
        title: "Unable to save profile",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleBusinessSave = async () => {
    if (!settings?.business?.id) {
      toast({
        title: "Workspace not found",
        description: "We could not find a business record for this account yet.",
        variant: "destructive",
      });
      return;
    }

    const validationErrors = businessFormValidator({
      name: business.name,
      phone: business.phone.trim(),
    }) as BusinessFormErrors;

    if (Object.keys(validationErrors).length > 0) {
      setBusinessErrors(validationErrors);
      return;
    }

    const normalizedBusinessName = normalizeRequiredText(business.name);

    try {
      await updateBusinessMutation.mutateAsync({
        businessId: settings.business.id,
        values: {
          address: normalizeOptionalText(business.address),
          default_currency: business.currency,
          default_language: business.language,
          default_locale: business.locale,
          fiscal_year_start_month: monthNameToNumber(business.fiscalYear),
          name: normalizedBusinessName,
          phone: normalizePhoneNumber(business.phone),
          rc_number: normalizeOptionalText(business.rcNumber),
          tax_id: normalizeOptionalText(business.taxId),
        },
      });

      toast({
        title: "Business updated",
        description: "Your workspace details have been saved.",
      });
      setBusinessErrors({});
    } catch (error) {
      toast({
        title: "Unable to save business settings",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleNotificationSave = async () => {
    try {
      await updateNotificationPreferencesMutation.mutateAsync(notificationPreferences);
      toast({
        title: "Notification preferences updated",
        description: "Your workspace alerts will follow these settings going forward.",
      });
    } catch (error) {
      toast({
        title: "Unable to save notification preferences",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleSendDigestPreview = async () => {
    if (!businessId) {
      toast({
        title: "Workspace not found",
        description: "We could not find a workspace to build the digest from.",
        variant: "destructive",
      });
      return;
    }

    if (!notificationPreferences.email_digest) {
      toast({
        title: "Email digest disabled",
        description: "Enable the Email Digest preference first, then try sending a preview again.",
        variant: "destructive",
      });
      return;
    }

    setEmailDeliveryStatus({
      action: "digest-preview",
      description: "Generating and sending a digest preview email to your current account address.",
      state: "running",
      title: "Sending digest preview",
    });

    try {
      await waitForUiFrame();
      const delivery = await sendDigestPreviewEmailMutation.mutateAsync({ businessId });

      setEmailDeliveryStatus({
        action: "digest-preview",
        description: `A digest preview email was sent to ${delivery.recipientEmail}.`,
        state: "success",
        title: "Digest preview sent",
      });
      toast({
        title: "Digest preview sent",
        description: `A preview email is on the way to ${delivery.recipientEmail}.`,
      });
    } catch (error) {
      const message = getErrorMessage(error, "Please try again.");

      setEmailDeliveryStatus({
        action: "digest-preview",
        description: message,
        state: "error",
        title: "Unable to send digest preview",
      });
      toast({
        title: "Unable to send digest preview",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handlePrivacySave = async () => {
    try {
      await updatePrivacyPreferencesMutation.mutateAsync(privacyPreferences);

      if (businessId) {
        await logAuditEventSafe({
          action: "security.privacy_preferences.updated",
          actorUserId: user?.id,
          businessId,
          detail: {
            description: "Privacy and export preferences updated from the security tab.",
            ...privacyPreferences,
          },
          entityId: user?.id,
          entityType: "profile",
          summary: "Privacy preferences updated",
        });
        await securityActivityQuery.refetch();
      }

      toast({
        title: "Privacy controls updated",
        description: "Your privacy and export preferences have been saved.",
      });
    } catch (error) {
      toast({
        title: "Unable to save privacy controls",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleAccountDataExport = async () => {
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "You need an active account session before exporting account data.",
        variant: "destructive",
      });
      return;
    }

    setSecurityExportStatus({
      action: "account",
      description: "We are collecting your profile, memberships, preferences, and recent notifications.",
      state: "running",
      title: "Preparing account data export",
    });

    try {
      await waitForUiFrame();
      const snapshot = await getAccountDataExportSnapshot(user.id, businessId);
      downloadJsonFile({
        data: snapshot,
        filename: createExportFileName("account-data-export"),
      });

      if (businessId) {
        await logAuditEventSafe({
          action: "security.account_export.downloaded",
          actorUserId: user.id,
          businessId,
          detail: {
            description: "Account data export downloaded from the security tab.",
          },
          entityId: user.id,
          entityType: "profile",
          summary: "Account data export downloaded",
        });
        await securityActivityQuery.refetch();
      }

      setSecurityExportStatus({
        action: "account",
        description: "Your account export has been downloaded as a JSON file.",
        state: "success",
        title: "Account export ready",
      });
    } catch (error) {
      setSecurityExportStatus({
        action: "account",
        description: getErrorMessage(error, "Please try again."),
        state: "error",
        title: "Unable to export account data",
      });
    }
  };

  const handleWorkspaceDataExport = async () => {
    if (!user?.id || !businessId) {
      setSecurityExportStatus({
        action: "workspace",
        description: "A workspace context is required before you can export workspace data.",
        state: "error",
        title: "Unable to export workspace data",
      });
      return;
    }

    setSecurityExportStatus({
      action: "workspace",
      description: "We are collecting workspace records and applying your current export privacy settings.",
      state: "running",
      title: "Preparing workspace export",
    });

    try {
      await waitForUiFrame();
      const snapshot = await getWorkspaceDataExportSnapshot(businessId, user.id);
      downloadJsonFile({
        data: snapshot,
        filename: createExportFileName("workspace-data-export"),
      });

      await logAuditEventSafe({
        action: "security.workspace_export.downloaded",
        actorUserId: user.id,
        businessId,
        detail: {
          description: "Workspace data export downloaded from the security tab.",
          include_audit_log_in_exports: privacyPreferences.include_audit_log_in_exports,
          include_contact_details_in_exports: privacyPreferences.include_contact_details_in_exports,
        },
        entityId: businessId,
        entityType: "business",
        summary: "Workspace data export downloaded",
      });
      await securityActivityQuery.refetch();

      setSecurityExportStatus({
        action: "workspace",
        description: "Your workspace export has been downloaded as a JSON file.",
        state: "success",
        title: "Workspace export ready",
      });
    } catch (error) {
      setSecurityExportStatus({
        action: "workspace",
        description: getErrorMessage(error, "Please try again."),
        state: "error",
        title: "Unable to export workspace data",
      });
    }
  };

  const handleSendPasswordVerificationCode = async () => {
    try {
      await sendPasswordReauthenticationMutation.mutateAsync();
      toast({
        title: "Verification code sent",
        description: "If your project requires reauthentication, check your email for a one-time code.",
      });
    } catch (error) {
      toast({
        title: "Unable to send verification code",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handlePasswordSave = async () => {
    const validationErrors = validatePasswordChangeForm(passwordForm);

    if (Object.keys(validationErrors).length > 0) {
      setPasswordErrors(validationErrors);
      return;
    }

    try {
      await updatePasswordMutation.mutateAsync({
        ...(passwordForm.currentPassword ? { current_password: passwordForm.currentPassword } : {}),
        ...(passwordForm.verificationCode
          ? { nonce: normalizeVerificationCode(passwordForm.verificationCode) }
          : {}),
        password: passwordForm.newPassword,
      });

      toast({
        title: "Password updated",
        description: "Your account password has been changed successfully.",
      });
      resetPasswordForm();
    } catch (error) {
      const submissionErrors = getPasswordSubmissionErrors(error);

      if (Object.keys(submissionErrors).length > 0) {
        setPasswordErrors((currentErrors) => ({
          ...currentErrors,
          ...submissionErrors,
        }));
      }

      toast({
        title: "Unable to update password",
        description: getErrorMessage(
          error,
          "Please verify your current password or request a verification code and try again.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleStartMfaSetup = async () => {
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "You need an active session before you can set up multi-factor authentication.",
        variant: "destructive",
      });
      return;
    }

    const normalizedFriendlyName = normalizeRequiredText(mfaFriendlyName || "Authenticator app");

    if (!normalizedFriendlyName) {
      setMfaErrors({ friendlyName: "Give this authenticator a name so you can recognize it later." });
      return;
    }

    setMfaEnrollPending(true);

    try {
      const enrollResponse = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: normalizedFriendlyName,
        issuer: "moniger.net",
      });

      if (enrollResponse.error) {
        throw enrollResponse.error;
      }

      const challengeResponse = await supabase.auth.mfa.challenge({
        factorId: enrollResponse.data.id,
      });

      if (challengeResponse.error) {
        await supabase.auth.mfa.unenroll({ factorId: enrollResponse.data.id });
        throw challengeResponse.error;
      }

      setMfaSetupState({
        challengeId: challengeResponse.data.id,
        factorId: enrollResponse.data.id,
        friendlyName: normalizedFriendlyName,
        qrCode: enrollResponse.data.totp.qr_code,
        secret: enrollResponse.data.totp.secret,
        uri: enrollResponse.data.totp.uri,
      });
      setMfaErrors({});
    } catch (error) {
      toast({
        title: "Unable to start MFA setup",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setMfaEnrollPending(false);
    }
  };

  const handleVerifyMfaSetup = async () => {
    if (!mfaSetupState) {
      return;
    }

    const codeError = validateTotpCode(mfaVerificationCode);

    if (codeError) {
      setMfaErrors((currentErrors) => ({
        ...currentErrors,
        verificationCode: codeError,
      }));
      return;
    }

    setMfaVerifyPending(true);

    try {
      const verifyResponse = await supabase.auth.mfa.verify({
        challengeId: mfaSetupState.challengeId,
        code: mfaVerificationCode.trim(),
        factorId: mfaSetupState.factorId,
      });

      if (verifyResponse.error) {
        throw verifyResponse.error;
      }

      if (businessId) {
        await logAuditEventSafe({
          action: "security.mfa.enabled",
          actorUserId: user?.id,
          businessId,
          detail: {
            description: `Multi-factor authentication enabled with ${mfaSetupState.friendlyName}.`,
            factor_type: "totp",
            friendly_name: mfaSetupState.friendlyName,
          },
          entityId: user?.id,
          entityType: "profile",
          summary: "Multi-factor authentication enabled",
        });
        await securityActivityQuery.refetch();
      }

      toast({
        title: "Authenticator added",
        description: "Multi-factor authentication is now enabled for this account.",
      });
      setMfaSetupOpen(false);
      resetMfaSetupState();
      await refreshMfaState();
    } catch (error) {
      toast({
        title: "Unable to verify authenticator",
        description: getErrorMessage(error, "Check the code in your authenticator app and try again."),
        variant: "destructive",
      });
    } finally {
      setMfaVerifyPending(false);
    }
  };

  const handleRemoveMfaFactor = async (factor: AppMfaFactor) => {
    try {
      const unenrollResponse = await supabase.auth.mfa.unenroll({ factorId: factor.id });

      if (unenrollResponse.error) {
        throw unenrollResponse.error;
      }

      if (businessId) {
        await logAuditEventSafe({
          action: "security.mfa.disabled",
          actorUserId: user?.id,
          businessId,
          detail: {
            description: `Multi-factor authentication disabled for ${factor.friendlyName || "Authenticator app"}.`,
            factor_type: factor.factorType,
            friendly_name: factor.friendlyName,
          },
          entityId: user?.id,
          entityType: "profile",
          summary: "Multi-factor authentication disabled",
        });
        await securityActivityQuery.refetch();
      }

      toast({
        title: "Authenticator removed",
        description: "The selected authenticator app is no longer required for sign-in.",
      });
      setFactorPendingRemoval(null);
      await refreshMfaState();
    } catch (error) {
      toast({
        title: "Unable to remove authenticator",
        description: getErrorMessage(
          error,
          "Please verify with your authenticator app first, then try removing the factor again.",
        ),
        variant: "destructive",
      });
    }
  };

  const handleDisableMfa = async () => {
    setMfaDisablePending(true);

    try {
      const factorsToRemove = mfaFactors.filter((factor) => factor.status === "verified" || factor.status === "unverified");

      for (const factor of factorsToRemove) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });

        if (error) {
          throw error;
        }
      }

      if (businessId && factorsToRemove.length > 0) {
        await logAuditEventSafe({
          action: "security.mfa.disabled",
          actorUserId: user?.id,
          businessId,
          detail: {
            description: "Multi-factor authentication disabled from the security tab.",
            factor_count: factorsToRemove.length,
            factor_ids: factorsToRemove.map((factor) => factor.id),
          },
          entityId: user?.id,
          entityType: "profile",
          summary: "Multi-factor authentication disabled",
        });
        await securityActivityQuery.refetch();
      }

      toast({
        title: "Multi-factor authentication turned off",
        description: "The selected authenticator apps are no longer required for sign-in.",
      });
      setMfaDisableDialogOpen(false);
      await refreshMfaState();
    } catch (error) {
      toast({
        title: "Unable to turn off multi-factor authentication",
        description: getErrorMessage(
          error,
          "Please verify with your authenticator app first, then try again.",
        ),
        variant: "destructive",
      });
    } finally {
      setMfaDisablePending(false);
    }
  };

  const handleGenerateMfaRecoveryCodes = async () => {
    try {
      const result = await generateMfaRecoveryCodesMutation.mutateAsync({
        businessId,
      });

      setRecoveryCodesDialogState({
        codes: result.codes.map((code) => formatRecoveryCode(code)),
        generatedAt: result.generatedAt,
      });
      await securityActivityQuery.refetch();

      toast({
        title: "Recovery codes generated",
        description: "Save these backup codes now. They will only be shown this one time.",
      });
    } catch (error) {
      toast({
        title: "Unable to generate recovery codes",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleCopyRecoveryCodes = async () => {
    if (!recoveryCodesDialogState) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        getRecoveryCodesDownloadText(recoveryCodesDialogState.codes, recoveryCodesDialogState.generatedAt),
      );
      toast({
        title: "Recovery codes copied",
        description: "The backup codes are now on your clipboard.",
      });
    } catch {
      toast({
        title: "Unable to copy recovery codes",
        description: "Copy the codes manually or download them as a text file.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadRecoveryCodes = () => {
    if (!recoveryCodesDialogState) {
      return;
    }

    const fileContents = getRecoveryCodesDownloadText(
      recoveryCodesDialogState.codes,
      recoveryCodesDialogState.generatedAt,
    );
    const downloadUrl = URL.createObjectURL(new Blob([fileContents], { type: "text/plain;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "moniger-mfa-recovery-codes.txt";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1_000);

    toast({
      title: "Recovery codes downloaded",
      description: "Store the downloaded file in a secure location.",
    });
  };

  const closeInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteEmail("");
    setInviteRole("viewer");
    setInviteErrors({});
  };

  const handleInviteMember = async () => {
    if (!businessId) {
      toast({
        title: "Workspace not found",
        description: "We could not find a workspace to attach this teammate to yet.",
        variant: "destructive",
      });
      return;
    }

    const normalizedInviteEmail = normalizeEmail(inviteEmail);

    const validationErrors = inviteFormValidator({
      email: normalizedInviteEmail,
    }) as InviteFormErrors;

    if (Object.keys(validationErrors).length > 0) {
      setInviteErrors(validationErrors);
      return;
    }

    try {
      const inviteResult = await teamMutations.inviteMember.mutateAsync({
        email: normalizedInviteEmail,
        role: inviteRole,
      });
      setInviteErrors({});
      closeInviteDialog();

      setEmailDeliveryStatus({
        action: "team-invite",
        description: `Sending a workspace access email to ${normalizedInviteEmail}.`,
        state: "running",
        title: "Sending invite email",
      });

      await waitForUiFrame();

      try {
        await sendTeamInviteEmailMutation.mutateAsync({
          businessId,
          inviteeEmail: normalizedInviteEmail,
          invitationToken: inviteResult.invitationToken,
          role: inviteRole,
        });

        setEmailDeliveryStatus({
          action: "team-invite",
          description:
            inviteResult.mode === "existing_account"
              ? `${normalizedInviteEmail} was added to the workspace and the invite email was sent successfully.`
              : `${normalizedInviteEmail} was invited successfully and received a secure acceptance link by email.`,
          state: "success",
          title: "Invite email sent",
        });

        toast({
          title: inviteResult.mode === "existing_account" ? "Team member added" : "Invitation sent",
          description:
            inviteResult.mode === "existing_account"
              ? `${normalizedInviteEmail} now has ${formatRoleLabel(inviteRole)} access and received an invite email.`
              : `${normalizedInviteEmail} can accept ${formatRoleLabel(inviteRole)} access from the invitation email.`,
        });
        return;
      } catch (deliveryError) {
        const message = getErrorMessage(
          deliveryError,
          inviteResult.mode === "existing_account"
            ? "The teammate was added, but the invite email could not be sent."
            : "The invitation was created, but the invite email could not be sent.",
        );

        setEmailDeliveryStatus({
          action: "team-invite",
          description: message,
          state: "error",
          title:
            inviteResult.mode === "existing_account"
              ? "Team member added, but email delivery failed"
              : "Invitation created, but email delivery failed",
        });

        toast({
          title:
            inviteResult.mode === "existing_account"
              ? "Team member added, but email delivery failed"
              : "Invitation created, but email delivery failed",
          description: message,
          variant: "destructive",
        });
        return;
      }

    } catch (error) {
      toast({
        title: "Unable to add team member",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleMemberRoleChange = async (member: TeamMemberItem, nextRole: Enums<"business_role">) => {
    if (member.role === nextRole) {
      return;
    }

    try {
      await teamMutations.updateMemberRole.mutateAsync({
        membershipId: member.membershipId,
        role: nextRole,
      });

      toast({
        title: "Team role updated",
        description: `${member.fullName} is now a ${formatRoleLabel(nextRole)}.`,
      });
    } catch (error) {
      toast({
        title: "Unable to update role",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    }
  };

  const handleMemberStatusChange = async (
    member: TeamMemberItem,
    nextStatus: Extract<Enums<"business_member_status">, "active" | "revoked">,
  ) => {
    try {
      await teamMutations.updateMemberStatus.mutateAsync({
        membershipId: member.membershipId,
        status: nextStatus,
      });

      toast({
        title: nextStatus === "active" ? "Access restored" : "Access revoked",
        description:
          nextStatus === "active"
            ? `${member.fullName} can access this workspace again.`
            : `${member.fullName} can no longer access this workspace.`,
      });
    } catch (error) {
      toast({
        title: nextStatus === "active" ? "Unable to restore access" : "Unable to revoke access",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setMemberPendingRevoke(null);
    }
  };

  const handleTabChange = (value: string) => {
    const nextTab = isSettingsTab(value) ? value : "profile";
    const nextParams = new URLSearchParams(searchParams);

    if (nextTab === "profile") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }

    setSearchParams(nextParams, { replace: true });
  };

  const ownerName = profile.fullName || profile.email || "Workspace Owner";
  const currentRoleLabel = formatRoleLabel(settings?.membership?.role);
  const isStandaloneTeamPage = activeTab === "team";
  const authProviderLabel = formatAuthProvider(
    typeof user?.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : user?.identities?.[0]?.provider,
  );
  const sessionStartedLabel = formatDateTime(currentInventorySession?.createdAt ?? session?.created_at ?? user?.last_sign_in_at);
  const lastSignInLabel = formatDateTime(user?.last_sign_in_at);
  const sessionExpiresLabel = currentInventorySession?.expiresAt
    ? formatDateTime(currentInventorySession.expiresAt)
    : session?.expires_at
      ? formatDateTime(session.expires_at * 1000)
      : "Automatic refresh enabled";
  const isSecurityBusy = pendingSecurityScope !== null || markAccountSessionsSignedOutMutation.isPending;
  const isPasswordBusy =
    updatePasswordMutation.isPending || sendPasswordReauthenticationMutation.isPending;
  const isPrivacyBusy = privacyPreferencesQuery.isLoading || updatePrivacyPreferencesMutation.isPending;
  const isSecurityExportBusy = securityExportStatus?.state === "running";
  const isEmailDeliveryBusy =
    sendDigestPreviewEmailMutation.isPending || sendTeamInviteEmailMutation.isPending;
  const latestScheduledDigestRun = scheduledDigestRunQuery.data;
  const canExportWorkspaceData =
    Boolean(businessId) &&
    Boolean(settings?.membership?.role) &&
    ["owner", "admin", "accountant"].includes(settings?.membership?.role ?? "");
  const passwordStrength = useMemo(
    () => getPasswordStrength(passwordForm.newPassword),
    [passwordForm.newPassword],
  );
  const securityActivity = securityActivityQuery.data ?? [];
  const currentAalLabel = formatAalLabel(currentAal);
  const nextAalLabel = formatAalLabel(nextAal);
  const isMfaEnabled = verifiedMfaFactors.length > 0;
  const isAnyMfaBusy = mfaLoading || mfaEnrollPending || mfaVerifyPending;
  const isMfaDisableBusy = isAnyMfaBusy || mfaDisablePending;
  const unverifiedMfaFactorCount = mfaFactors.filter((factor) => factor.status === "unverified").length;
  const currentWorkspacePlan: SubscriptionPlan | null = workspaceSubscriptionQuery.subscription?.plan ?? null;
  const availableUpgradePlans: SubscriptionPlan[] =
    currentWorkspacePlan === "starter"
      ? ["growth", "business"]
      : currentWorkspacePlan === "growth"
        ? ["business"]
        : [];
  const profileSubscriptionActionLabel = workspaceSubscriptionQuery.isLoading
    ? "Checking plan…"
    : workspaceSubscriptionQuery.isError
      ? "Retry plan check"
      : availableUpgradePlans.length > 0
        ? "Upgrade now"
        : "Manage subscription";
  const getPlanCatalog = (plan: SubscriptionPlan) => pricingCatalog?.[plan] ?? subscriptionCatalog[plan];
  const visibleUpgradePlans: SubscriptionPlan[] = availableUpgradePlans;

  const handleProfileSubscriptionAction = () => {
    setUpgradeDialogOpen(true);
  };

  const handleProfileSubscriptionUpgrade = async (plan: SubscriptionPlan) => {
    setUpgradePlanPending(plan);

    try {
      const result = await handleUpgrade({
        billingCycle: getDefaultSubscriptionBillingCycle(plan),
        businessId: businessId ?? undefined,
        plan,
      });

      if (result.kind === "checkout") {
        window.location.assign(result.authorizationUrl);
        return;
      }

      toast({
        title: "Subscription updated",
        description: `${plan.charAt(0).toUpperCase()}${plan.slice(1)} is now active for your workspace.`,
      });
      setUpgradeDialogOpen(false);
      navigate("/dashboard");
    } catch (error) {
      toast({
        title: "Unable to update subscription",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setUpgradePlanPending(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!businessId) {
      return;
    }

    setCancelSubscriptionPending(true);

    try {
      await cancelWorkspaceSubscription({ businessId });
      await workspaceSubscriptionQuery.refetch();
      setCancelSubscriptionDialogOpen(false);
      toast({
        title: "Subscription renewal cancelled",
        description: "Your current plan remains available until the recorded renewal date.",
      });
    } catch (error) {
      toast({
        title: "Unable to cancel renewal",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setCancelSubscriptionPending(false);
    }
  };

  const teamPanel =
    isInitialLoading || (teamMembersQuery.isLoading && !teamMembers.length) ? (
      <SettingsSectionSkeleton variant="team" />
    ) : (
      <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Team Members</h3>
            <p className="text-sm text-muted-foreground">
              Manage who can access this workspace. Team invites currently target existing moniger.net accounts and
              can now send a workspace access email after the role is granted.
            </p>
          </div>
          <Button
            onClick={() => setInviteDialogOpen(true)}
            disabled={!canManageTeam || !businessId}
            className="gap-2 bg-primary text-primary-foreground"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{activeMemberCount}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{pendingMemberCount}</p>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm text-muted-foreground">Revoked</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{revokedMemberCount}</p>
            </div>
          </div>
        </div>

        {!canManageTeam ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            You currently have <span className="font-medium text-foreground">{currentRoleLabel}</span> access.
            Owners and admins can invite teammates or change workspace access.
          </div>
        ) : null}

        {hasTeamError ? (
          <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(teamMembersQuery.error, "We could not load your workspace members right now.")}
          </div>
        ) : null}

        {hasWorkspaceInvitationsError ? (
          <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
            {getErrorMessage(workspaceInvitationsQuery.error, "We could not load your workspace invitations right now.")}
          </div>
        ) : null}

        {emailDeliveryStatus?.action === "team-invite" ? (
          <OperationStatusNotice
            title={emailDeliveryStatus.title}
            description={emailDeliveryStatus.description}
            state={emailDeliveryStatus.state}
            onRetry={emailDeliveryStatus.state === "error" ? () => setInviteDialogOpen(true) : undefined}
            retryLabel="Open invite form"
          />
        ) : null}

        <div className="space-y-3">
          {teamMembers.map((member) => {
            const canEditMember = canManageTeam && !member.isCurrentUser && member.role !== "owner";
            const canRevokeMember = canEditMember && member.status === "active";
            const canRestoreMember = canEditMember && member.status === "revoked";

            return (
              <div
                key={member.membershipId}
                className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 font-medium text-primary">
                      {getInitials(member.fullName || member.email)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{member.fullName}</p>
                      {member.isCurrentUser ? <Badge variant="outline">You</Badge> : null}
                      <Badge className={getStatusBadgeClassName(member.status)}>{formatStatusLabel(member.status)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{member.email}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>Joined {formatJoinedDate(member.joinedAt)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Shield className="h-3.5 w-3.5" />
                        {formatRoleLabel(member.role)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-[180px] space-y-1">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Role</Label>
                    {canEditMember && member.status === "active" ? (
                      <Select
                        value={member.role}
                        onValueChange={(value) => void handleMemberRoleChange(member, value as Enums<"business_role">)}
                        disabled={isTeamBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((roleOption) => (
                            <SelectItem key={roleOption.value} value={roleOption.value}>
                              {roleOption.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
                        {formatRoleLabel(member.role)}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {canRevokeMember ? (
                      <Button variant="outline" onClick={() => setMemberPendingRevoke(member)} disabled={isTeamBusy}>
                        <Ban className="h-4 w-4" />
                        Revoke Access
                      </Button>
                    ) : null}
                    {canRestoreMember ? (
                      <Button
                        variant="outline"
                        onClick={() => void handleMemberStatusChange(member, "active")}
                        disabled={isTeamBusy}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore Access
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {workspaceInvitations.length ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pt-2">
              <Mail className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Pending and historical invitations</p>
            </div>

            {workspaceInvitations.map((invitation) => (
              <div
                key={invitation.invitationId}
                className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{invitation.invitedEmail}</p>
                    <Badge variant="outline">{formatInvitationStatusLabel(invitation.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Invited by {invitation.invitedByName} on {formatDateTime(invitation.createdAt)}
                  </p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Shield className="h-3.5 w-3.5" />
                      {formatRoleLabel(invitation.role)}
                    </span>
                    <span>Expires {formatDateTime(invitation.expiresAt)}</span>
                    {invitation.acceptedAt ? <span>Accepted {formatDateTime(invitation.acceptedAt)}</span> : null}
                  </div>
                </div>

                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  {invitation.status === "pending"
                    ? "Waiting for the recipient to sign in or create an account with the invited email."
                    : invitation.status === "accepted"
                      ? "This invitation has already been accepted."
                      : invitation.status === "expired"
                        ? "This invitation has expired."
                        : "This invitation is no longer active."}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!teamMembersQuery.isLoading && !workspaceInvitationsQuery.isLoading && !teamMembers.length && !workspaceInvitations.length ? (
          <EmptyState
            title="No teammates yet"
            description={
              canManageTeam
                ? "Invite collaborators with finance, admin, or viewer access, even if they still need to create their moniger.net account."
                : "Workspace members and invitations will appear here once an owner or admin adds them."
            }
            icon={Users}
            size="compact"
            actions={canManageTeam && businessId ? [{ label: "Invite member", onClick: () => setInviteDialogOpen(true) }] : []}
          />
        ) : null}
      </div>
    );

  const handleScopedSignOut = async (scope: AuthSignOutScope) => {
    setPendingSecurityScope(scope);

    try {
      try {
        await markAccountSessionsSignedOutMutation.mutateAsync({
          currentSession: session,
          scope,
        });
      } catch {
        // Best effort only. Sign-out should still continue even if inventory metadata cannot be updated.
      }

      if (businessId && user?.id) {
        await logAuditEventSafe({
          action:
            scope === "others"
              ? "security.sign_out.others"
              : scope === "global"
                ? "security.sign_out.global"
                : "security.sign_out.local",
          actorUserId: user.id,
          businessId,
          detail: {
            description:
              scope === "others"
                ? "Other active sessions were signed out from the security tab."
                : scope === "global"
                  ? "All sessions were signed out from the security tab."
                  : "The current device session was signed out from the security tab.",
          },
          entityId: user.id,
          entityType: "profile",
          summary:
            scope === "others"
              ? "Other sessions signed out"
              : scope === "global"
                ? "Signed out everywhere"
                : "Current device signed out",
        });
      }

      await signOut(scope);

      if (scope === "others") {
        await Promise.all([securityActivityQuery.refetch(), accountSessionInventoryQuery.refetch()]);
        toast({
          title: "Other sessions signed out",
          description: "Other active sessions for this account were closed. This device stays signed in.",
        });
      } else if (scope === "global") {
        toast({
          title: "Signed out everywhere",
          description: "All active sessions were closed. Sign in again to continue.",
        });
        navigate("/login", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    } catch (error) {
      toast({
        title:
          scope === "others"
            ? "Unable to sign out other sessions"
            : scope === "global"
              ? "Unable to sign out everywhere"
              : "Unable to sign out",
        description: getErrorMessage(error, "Please try again."),
        variant: "destructive",
      });
    } finally {
      setPendingSecurityScope(null);
      setConfirmSecurityAction(null);
    }
  };

  return (
    <AppLayout>
      <div className={`${isStandaloneTeamPage ? "max-w-6xl" : "max-w-4xl"} page-enter`}>
        {isStandaloneTeamPage ? (
          <div className="space-y-6">
            {hasSettingsError ? (
              <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                {getErrorMessage(settingsQuery.error, "We could not load your team workspace right now.")}
              </div>
            ) : null}
            {teamPanel}
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="border border-border bg-card">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              {t("settings.tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              {t("settings.tabs.security")}
            </TabsTrigger>
            <TabsTrigger value="business" className="gap-2">
              <Building2 className="h-4 w-4" />
              {t("settings.tabs.business")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              {t("settings.tabs.notifications")}
            </TabsTrigger>
          </TabsList>

          {hasSettingsError ? (
            <div className="rounded-xl border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
              {getErrorMessage(settingsQuery.error, "We could not load your settings right now.")}
            </div>
          ) : null}

          <TabsContent value="profile">
            {isInitialLoading ? (
              <SettingsSectionSkeleton variant="profile" />
            ) : (
              <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">Personal Information</h3>
              <div className="rounded-xl border border-[#DCE2F2] bg-[#F8FAFF] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#5B67F7]">Workspace plan</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {workspaceSubscriptionQuery.subscription
                        ? workspaceSubscriptionQuery.subscription.plan.charAt(0).toUpperCase() +
                          workspaceSubscriptionQuery.subscription.plan.slice(1)
                        : "Starter"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {workspaceSubscriptionQuery.isError
                        ? "Plan details could not be loaded right now."
                        : workspaceSubscriptionQuery.subscription
                          ? workspaceSubscriptionQuery.entitlements.isActive
                            ? "Active and ready for use"
                            : workspaceSubscriptionQuery.entitlements.isCancelled
                              ? "Cancelled — renew or upgrade"
                              : "Needs billing attention"
                          : "Active and ready for use"}
                    </p>
                    {workspaceSubscriptionQuery.subscription ? (
                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>Billing: {workspaceSubscriptionQuery.subscription.billingCycle}</span>
                        <span>
                          Renewal: {workspaceSubscriptionQuery.subscription.nextRenewalAt
                            ? new Date(workspaceSubscriptionQuery.subscription.nextRenewalAt).toLocaleDateString("en-NG", { dateStyle: "medium" })
                            : "Not scheduled"}
                        </span>
                        <span>
                          {workspaceSubscriptionQuery.subscription.cancelAtPeriodEnd
                            ? "Cancels at period end"
                            : `Status: ${workspaceSubscriptionQuery.subscription.status.replace(/_/g, " ")}`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <Badge
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                      workspaceSubscriptionQuery.isError
                        ? "bg-[#FEF2F2] text-[#B42318]"
                        : workspaceSubscriptionQuery.subscription
                          ? workspaceSubscriptionQuery.entitlements.isActive
                            ? "bg-[#ECFDF3] text-[#16A34A]"
                            : workspaceSubscriptionQuery.entitlements.isCancelled
                              ? "bg-[#FEF2F2] text-[#B42318]"
                              : "bg-[#FFFBEB] text-[#B45309]"
                          : "bg-[#ECFDF3] text-[#16A34A]"
                    }`}
                  >
                    {workspaceSubscriptionQuery.isLoading
                      ? "Loading"
                      : workspaceSubscriptionQuery.isError
                        ? "Unavailable"
                        : workspaceSubscriptionQuery.subscription?.plan ?? "Starter"}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleProfileSubscriptionAction()}
                    disabled={isSubscriptionActionPending}
                    className="h-9 rounded-full bg-[#10203F] px-4 text-sm font-semibold text-white hover:bg-[#1A2D57]"
                  >
                    {isSubscriptionActionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {profileSubscriptionActionLabel}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/pricing")}
                    className="h-9 rounded-full px-4 text-sm font-semibold"
                  >
                    View plans
                  </Button>
                  {workspaceSubscriptionQuery.subscription?.plan !== "starter" &&
                  workspaceSubscriptionQuery.subscription?.status === "active" &&
                  !workspaceSubscriptionQuery.subscription.cancelAtPeriodEnd ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setCancelSubscriptionDialogOpen(true)}
                      disabled={isSubscriptionActionPending || cancelSubscriptionPending}
                      className="h-9 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Cancel renewal
                    </Button>
                  ) : null}
                </div>
              </div>
              <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
                <DialogContent className="max-w-3xl border-border/70 bg-background/95 backdrop-blur">
                  <DialogHeader>
                    <DialogTitle>Compare plans before upgrading</DialogTitle>
                    <DialogDescription>
                      {currentWorkspacePlan ? (
                        <>
                          Your current plan is{" "}
                          <span className="font-semibold text-foreground capitalize">{currentWorkspacePlan}</span>. Choose a
                          plan below to continue to secure billing.
                        </>
                      ) : (
                        "We could not confirm the current workspace plan yet. Refresh the subscription status before upgrading."
                      )}
                    </DialogDescription>
                  </DialogHeader>
                  {visibleUpgradePlans.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      {visibleUpgradePlans.map((plan) => {
                      const planCatalog = getPlanCatalog(plan);
                      const isCurrentPlan = plan === currentWorkspacePlan;
                      const isRecommended =
                        currentWorkspacePlan === "starter"
                          ? plan === "growth"
                          : currentWorkspacePlan === "growth"
                            ? plan === "business"
                            : false;

                      return (
                        <div
                          key={plan}
                          className={`flex h-full flex-col rounded-3xl border p-5 shadow-sm transition ${
                            isCurrentPlan
                              ? "border-primary/40 bg-primary/5"
                              : "border-border/60 bg-background hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                {plan === "growth" ? "Best for growing teams" : "Best for finance ops"}
                              </p>
                              <h3 className="text-lg font-semibold capitalize text-foreground">{plan}</h3>
                            </div>
                            {isRecommended ? (
                              <Badge className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                                Recommended
                              </Badge>
                            ) : isCurrentPlan ? (
                              <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                Current
                              </Badge>
                            ) : null}
                          </div>

                          <p className="mt-2 text-2xl font-bold text-foreground">{planCatalog.priceLabel}</p>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{planCatalog.description}</p>

                          <div className="mt-4 flex-1 space-y-2">
                            {planCatalog.features.slice(0, 4).map((feature) => (
                              <div key={feature} className="flex items-center gap-2 text-sm text-foreground">
                                <CheckCircle2 className="h-4 w-4 text-primary" />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>

                          <Button
                            type="button"
                            disabled={isCurrentPlan || upgradePlanPending !== null}
                            onClick={() => void handleProfileSubscriptionUpgrade(plan)}
                            className={`mt-5 h-11 rounded-full px-4 text-sm font-semibold ${
                              plan === "business"
                                ? "bg-[#F5F7FF] text-[#1F2A44] hover:bg-[#E9EEFF] hover:text-[#1F2A44]"
                                : "bg-[#10203F] text-white hover:bg-[#1A2D57]"
                            }`}
                          >
                            {upgradePlanPending === plan ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isCurrentPlan ? (
                              "Current plan"
                            ) : (
                              `Continue with ${plan.charAt(0).toUpperCase()}${plan.slice(1)}`
                            )}
                          </Button>
                        </div>
                      );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-5 py-6 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">You&apos;re already on the highest available plan.</p>
                      <p className="mt-1">
                        You can still review plan details or open workspace settings to manage your subscription.
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    <span>Need the full breakdown again?</span>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/pricing")}
                      className="h-9 rounded-full px-4 text-sm font-semibold"
                    >
                      View all plans
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="relative w-fit">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={currentProfileAvatarUrl ?? undefined} alt={`${ownerName} profile photo`} />
                    <AvatarFallback className="bg-primary text-xl font-semibold text-primary-foreground">
                      {getInitials(ownerName)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-3">
                  <p className="font-medium text-foreground">Profile Photo</p>
                  <p className="text-sm text-muted-foreground">Upload a PNG, JPG, or WebP image up to 2MB.</p>
                  <input
                    ref={profileImageInputRef}
                    type="file"
                    accept={allowedProfileImageTypes.join(",")}
                    className="sr-only"
                    onChange={handleProfileImageChange}
                    disabled={isProfileImageUploading || updateProfileMutation.isPending}
                    aria-label="Choose a profile image"
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenProfileImagePicker}
                      disabled={isProfileImageUploading || updateProfileMutation.isPending}
                      className="gap-2"
                    >
                      {isProfileImageUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {currentProfileAvatarUrl ? "Change photo" : "Upload photo"}
                    </Button>
                    {currentProfileAvatarUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleRemoveProfileImage}
                        disabled={isProfileImageUploading || updateProfileMutation.isPending}
                        className="gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  {profileImageError ? (
                    <p className={inlineErrorClassName} role="alert">
                      {profileImageError}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settings-full-name">Full Name</Label>
                  <Input
                    {...getFormFieldAriaProps({
                      error: profileErrors.fullName,
                      id: "settings-full-name",
                      required: true,
                    })}
                    value={profile.fullName}
                    onChange={(event) => {
                      clearProfileError("fullName");
                      setProfile((current) => ({ ...current, fullName: event.target.value }));
                    }}
                    className={profileErrors.fullName ? inputErrorClassName : ""}
                    disabled={isInitialLoading || updateProfileMutation.isPending || isProfileImageUploading}
                  />
                  {profileErrors.fullName ? (
                    <p id="settings-full-name-error" className={inlineErrorClassName} role="alert">
                      {profileErrors.fullName}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-email">Email Address</Label>
                  <Input
                    id="settings-email"
                    value={profile.email}
                    readOnly
                    disabled
                    className="bg-muted/60 text-muted-foreground"
                  />
                  <p className="text-[13px] text-muted-foreground">
                    Email changes and account-session controls are handled in the Security tab.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-phone">Phone Number</Label>
                  <Input
                    {...getFormFieldAriaProps({
                      error: profileErrors.phone,
                      id: "settings-phone",
                    })}
                    value={profile.phone}
                    onChange={(event) => {
                      clearProfileError("phone");
                      setProfile((current) => ({ ...current, phone: event.target.value }));
                    }}
                    disabled={isInitialLoading || updateProfileMutation.isPending || isProfileImageUploading}
                    placeholder={phonePlaceholder}
                    className={profileErrors.phone ? inputErrorClassName : ""}
                  />
                  <p className="text-xs text-muted-foreground">Use international format, for example {phonePlaceholder}.</p>
                  {profileErrors.phone ? (
                    <p id="settings-phone-error" className={inlineErrorClassName} role="alert">
                      {profileErrors.phone}
                    </p>
                  ) : null}
                </div>
              </div>

              <div id="wallet" className="rounded-xl border border-border bg-background p-5 scroll-mt-20">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("locale.sections.profileEyebrow")}</p>
                  <h4 className="text-base font-semibold text-foreground">{t("locale.sections.profileTitle")}</h4>
                  <p className="text-sm text-muted-foreground">{t("locale.sections.profileDescription")}</p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("locale.labels.language")}</Label>
                    <Select
                      value={profile.language}
                      onValueChange={(value) => setProfile((current) => ({ ...current, language: value }))}
                      disabled={isInitialLoading || updateProfileMutation.isPending || isProfileImageUploading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={workspaceDefaultPreferenceValue}>{t("locale.inheritLanguage")}</SelectItem>
                        {supportedLanguages.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("locale.labels.locale")}</Label>
                    <Select
                      value={profile.locale}
                      onValueChange={(value) => setProfile((current) => ({ ...current, locale: value }))}
                      disabled={isInitialLoading || updateProfileMutation.isPending || isProfileImageUploading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={workspaceDefaultPreferenceValue}>{t("locale.inheritLocale")}</SelectItem>
                        {supportedLocales.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("locale.datePreview")}</p>
                    <p className="mt-2 font-medium text-foreground">{profilePreviewDate}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{profilePreviewDateTime}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("locale.currencyPreview")}</p>
                    <p className="mt-2 font-medium text-foreground">{profilePreviewMoney}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{business.currency}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("locale.numberPreview")}</p>
                    <p className="mt-2 font-medium text-foreground">{profilePreviewNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{profilePreviewLocale}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleProfileSave}
                  disabled={
                    isInitialLoading ||
                    updateProfileMutation.isPending ||
                    isProfileImageUploading ||
                    !isProfileDirty
                  }
                  className="bg-primary text-primary-foreground"
                >
                  {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("common.saveChanges")}
                </Button>
              </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="security">
            {isInitialLoading ? (
              <SettingsSectionSkeleton variant="security" />
            ) : (
              <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Account Security</h3>
                  <p className="text-sm text-muted-foreground">
                    Review the current session for this account and control where it stays signed in.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Current session</p>
                        <p className="text-base font-semibold text-foreground">{profile.email || user?.email || "Signed in"}</p>
                      </div>
                      <Badge variant="outline">This device</Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Provider</p>
                        <p className="mt-1 font-medium text-foreground">{authProviderLabel}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Session started</p>
                        <p className="mt-1 font-medium text-foreground">{sessionStartedLabel}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Last sign in</p>
                        <p className="mt-1 font-medium text-foreground">{lastSignInLabel}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background px-4 py-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Session expiry</p>
                        <p className="mt-1 font-medium text-foreground">{sessionExpiresLabel}</p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Password management and authenticator-based multi-factor protection are both available below.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-xl border border-border bg-background p-5">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Session actions</p>
                      <h4 className="text-base font-semibold text-foreground">Control where this account stays signed in</h4>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Use these actions if you signed in on a shared computer, finished a support session, or want to
                      force other devices to log out.
                    </p>

                    <div className="flex flex-col gap-3">
                      <Button
                        variant="outline"
                        onClick={() => void handleScopedSignOut("local")}
                        disabled={isSecurityBusy}
                        className="justify-between"
                      >
                        <span>Sign out this device</span>
                        {pendingSecurityScope === "local" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setConfirmSecurityAction("others")}
                        disabled={isSecurityBusy}
                        className="justify-between"
                      >
                        <span>Sign out other sessions</span>
                        {pendingSecurityScope === "others" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => setConfirmSecurityAction("global")}
                        disabled={isSecurityBusy}
                        className="justify-between"
                      >
                        <span>Sign out everywhere</span>
                        {pendingSecurityScope === "global" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                      Signing out other sessions keeps this device active. Signing out everywhere closes the current
                      session too.
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-5">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Inactivity timeout</p>
                    <h4 className="text-base font-semibold text-foreground">Choose how long idle sessions stay signed in</h4>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    After this many minutes without mouse, keyboard, touch, or scroll activity, Moniger signs out this
                    device automatically. You can lower it temporarily to test the flow quickly.
                  </p>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="w-full max-w-xs space-y-2">
                      <Label htmlFor="session-timeout-minutes">Inactivity duration (minutes)</Label>
                      <Input
                        id="session-timeout-minutes"
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
                      />
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      Current timeout: <span className="font-medium text-foreground">{sessionTimeoutMinutes} minute{sessionTimeoutMinutes === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="space-y-4 rounded-xl border border-border bg-background p-5">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Known sessions</p>
                      <h4 className="text-base font-semibold text-foreground">Recent devices and authentication state</h4>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      This inventory is based on authenticated activity captured by moniger.net. It gives you a practical
                      device history for this account, even though Supabase does not expose a full provider-native session list.
                          {currentDeviceSnapshot.platform} · Provider: {authProviderLabel}
                    </div>

                    {hasAccountSessionInventoryError ? (
                      <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                        {getErrorMessage(
                          accountSessionInventoryQuery.error,
                          "We could not load the account session inventory.",
                        )}
                      </div>
                    ) : null}

                    {accountSessionInventoryQuery.isLoading ? (
                      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Loading known sessions...
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current authentication methods</p>
                      <div className="flex flex-wrap gap-2">
                        {currentAuthMethods.length > 0 ? (
                          currentAuthMethods.map((method) => (
                            <Badge key={`${method.method}-${method.verifiedAt ?? "na"}`} variant="outline" className="gap-1">
                              {formatAuthMethodLabel(method.method)}
                              {method.verifiedAt ? `· ${formatDateTime(method.verifiedAt)}` : ""}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">Session method metadata unavailable</Badge>
                        )}
                      </div>
                    </div>

                    {!accountSessionInventoryQuery.isLoading && !accountSessions.length ? (
                      <EmptyState
                        title="No known sessions recorded yet"
                        description="This account inventory fills in as authenticated sessions become active on different devices."
                        icon={MonitorSmartphone}
                        size="compact"
                      />
                    ) : null}

                    {!accountSessionInventoryQuery.isLoading && accountSessions.length ? (
                      <div className="space-y-3">
                        {accountSessions.map((sessionItem) => {
                          const status = getAccountSessionStatus(sessionItem);
                          const isCurrentSession = sessionItem.sessionId === currentSessionId;

                          return (
                            <div
                              key={sessionItem.sessionId}
                              className="rounded-lg border border-border bg-muted/20 p-4"
                            >
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <MonitorSmartphone className="h-5 w-5" />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-medium text-foreground">{sessionItem.deviceLabel}</p>
                                      {isCurrentSession ? <Badge variant="outline">This device</Badge> : null}
                                      <Badge className={status.className}>{status.label}</Badge>
                                      {sessionItem.recoveryBypassActive ? (
                                        <Badge variant="outline">Recovery code used</Badge>
                                      ) : null}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      {sessionItem.platform} · Provider: {formatAuthProvider(sessionItem.provider)}
                                    </p>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2 lg:min-w-[280px]">
                                  <div>
                                    <span className="font-medium text-foreground">Seen:</span> {formatDateTime(sessionItem.lastSeenAt)}
                                  </div>
                                  <div>
                                    <span className="font-medium text-foreground">Started:</span> {formatDateTime(sessionItem.createdAt)}
                                  </div>
                                  <div>
                                    <span className="font-medium text-foreground">Expires:</span>{" "}
                                    {sessionItem.expiresAt ? formatDateTime(sessionItem.expiresAt) : "Unavailable"}
                                  </div>
                                  <div>
                                    <span className="font-medium text-foreground">AAL:</span>{" "}
                                    {sessionItem.aal ? formatAalLabel(sessionItem.aal as AuthenticatorAssuranceLevel) : "Unavailable"}
                                  </div>
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-border bg-background px-4 py-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Browser</p>
                                  <p className="mt-1 font-medium text-foreground">{sessionItem.browser}</p>
                                </div>
                                <div className="rounded-lg border border-border bg-background px-4 py-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Operating system</p>
                                  <p className="mt-1 font-medium text-foreground">{sessionItem.os}</p>
                                </div>
                              </div>

                              <div className="mt-4 space-y-2">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Authentication methods</p>
                                <div className="flex flex-wrap gap-2">
                                  {sessionItem.authMethods.length > 0 ? (
                                    sessionItem.authMethods.map((method) => (
                                      <Badge
                                        key={`${sessionItem.sessionId}-${method.method}-${method.verifiedAt ?? "na"}`}
                                        variant="outline"
                                        className="gap-1"
                                      >
                                        {formatAuthMethodLabel(method.method)}
                                        {method.verifiedAt ? `· ${formatDateTime(method.verifiedAt)}` : ""}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline">Session method metadata unavailable</Badge>
                                  )}
                                </div>
                              </div>

                              {sessionItem.signedOutAt ? (
                                <p className="mt-3 text-sm text-muted-foreground">
                                  Signed out on {formatDateTime(sessionItem.signedOutAt)}.
                                </p>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    {!accountSessionInventoryQuery.isLoading && otherKnownSessions.length > 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {otherKnownSessions.length} additional device{otherKnownSessions.length === 1 ? "" : "s"} have
                        signed into this account recently.
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-4 rounded-xl border border-border bg-background p-5">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Recent security activity</p>
                      <h4 className="text-base font-semibold text-foreground">Changes made from this account</h4>
                    </div>

                    {hasSecurityActivityError ? (
                      <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                        {getErrorMessage(securityActivityQuery.error, "We could not load recent security activity.")}
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {securityActivity.map((entry) => (
                        <div key={entry.id} className="rounded-lg border border-border px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{entry.summary}</p>
                              <p className="text-sm text-muted-foreground">
                                {entry.detail || formatAuthMethodLabel(entry.action.replace("security.", "").replace(/\./g, " "))}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                          </div>
                        </div>
                      ))}

                      {!securityActivityQuery.isLoading && securityActivity.length === 0 ? (
                        <EmptyState
                          title="No security activity yet"
                          description="Password changes, MFA updates, privacy changes, and export actions will appear here."
                          icon={Shield}
                          size="compact"
                        />
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-foreground">Password Management</h4>
                      <p className="text-sm text-muted-foreground">
                        Change your password here. If secure password change is enabled for this project, request a
                        verification code and paste it below before saving.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleSendPasswordVerificationCode()}
                      disabled={isPasswordBusy}
                    >
                      {sendPasswordReauthenticationMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      Send Verification Code
                    </Button>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="settings-current-password">Current Password</Label>
                      <div className="relative">
                        <Input
                          {...getFormFieldAriaProps({
                            error: passwordErrors.currentPassword,
                            hint: "Only required if your project enforces current-password verification.",
                            id: "settings-current-password",
                          })}
                          id="settings-current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={passwordForm.currentPassword}
                          onChange={(event) => {
                            clearPasswordError("currentPassword");
                            clearPasswordError("newPassword");
                            setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }));
                          }}
                          placeholder="Enter current password"
                          disabled={isPasswordBusy}
                          className={passwordErrors.currentPassword ? `${inputErrorClassName} pr-12` : "pr-12"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                        >
                          {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p id="settings-current-password-hint" className="text-xs text-muted-foreground">
                        Only required if your project enforces current-password verification.
                      </p>
                      {passwordErrors.currentPassword ? (
                        <p id="settings-current-password-error" className={inlineErrorClassName} role="alert">
                          {passwordErrors.currentPassword}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-verification-code">Verification Code</Label>
                      <Input
                        {...getFormFieldAriaProps({
                          error: passwordErrors.verificationCode,
                          hint: "Optional one-time code from your email if secure password change is enabled.",
                          id: "settings-verification-code",
                        })}
                        value={passwordForm.verificationCode}
                        onChange={(event) => {
                          clearPasswordError("verificationCode");
                          setPasswordForm((current) => ({ ...current, verificationCode: event.target.value }));
                        }}
                        placeholder="Paste one-time code"
                        disabled={isPasswordBusy}
                        className={passwordErrors.verificationCode ? inputErrorClassName : ""}
                      />
                      <p id="settings-verification-code-hint" className="text-xs text-muted-foreground">
                        Optional one-time code from your email if secure password change is enabled.
                      </p>
                      {passwordErrors.verificationCode ? (
                        <p id="settings-verification-code-error" className={inlineErrorClassName} role="alert">
                          {passwordErrors.verificationCode}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-new-password">New Password</Label>
                      <div className="relative">
                        <Input
                          {...getFormFieldAriaProps({
                            error: passwordErrors.newPassword,
                            id: "settings-new-password",
                            required: true,
                          })}
                          type={showNewPassword ? "text" : "password"}
                          value={passwordForm.newPassword}
                          onChange={(event) => {
                            clearPasswordError("newPassword");
                            clearPasswordError("confirmPassword");
                            setPasswordForm((current) => ({ ...current, newPassword: event.target.value }));
                          }}
                          placeholder="Create a new password"
                          disabled={isPasswordBusy}
                          className={passwordErrors.newPassword ? `${inputErrorClassName} pr-12` : "pr-12"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                        >
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {passwordForm.newPassword ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Strength</span>
                            <span className={`font-medium ${passwordStrength.textClassName}`}>{passwordStrength.label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[0, 1, 2].map((segment) => (
                              <div
                                key={`password-strength-${segment}`}
                                className={`h-1.5 rounded-full ${
                                  segment < passwordStrength.score ? passwordStrength.fillClassName : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Use at least 8 characters. Uppercase letters, numbers, and symbols make it stronger.
                        </p>
                      )}
                      {passwordErrors.newPassword ? (
                        <p id="settings-new-password-error" className={inlineErrorClassName} role="alert">
                          {passwordErrors.newPassword}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-confirm-password">Confirm New Password</Label>
                      <div className="relative">
                        <Input
                          {...getFormFieldAriaProps({
                            error: passwordErrors.confirmPassword,
                            id: "settings-confirm-password",
                            required: true,
                          })}
                          type={showConfirmPassword ? "text" : "password"}
                          value={passwordForm.confirmPassword}
                          onChange={(event) => {
                            clearPasswordError("confirmPassword");
                            setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }));
                          }}
                          placeholder="Confirm new password"
                          disabled={isPasswordBusy}
                          className={passwordErrors.confirmPassword ? `${inputErrorClassName} pr-12` : "pr-12"}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Confirm the new password exactly to avoid locking yourself out.
                      </p>
                      {passwordErrors.confirmPassword ? (
                        <p id="settings-confirm-password-error" className={inlineErrorClassName} role="alert">
                          {passwordErrors.confirmPassword}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      If this workspace enables secure password change, request a verification code before saving.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={resetPasswordForm}
                        disabled={
                          isPasswordBusy ||
                          (!passwordForm.currentPassword &&
                            !passwordForm.newPassword &&
                            !passwordForm.confirmPassword &&
                            !passwordForm.verificationCode)
                        }
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handlePasswordSave()}
                        disabled={isPasswordBusy}
                        className="bg-primary text-primary-foreground"
                      >
                        {updatePasswordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Update Password
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-6">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-foreground">Multi-factor Authentication</h4>
                      <p className="text-sm text-muted-foreground">
                        Add an authenticator app so sign-in requires a second step after your password.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant={isMfaEnabled ? "outline" : "default"}
                        onClick={() => setMfaSetupOpen(true)}
                        disabled={isAnyMfaBusy}
                        className={isMfaEnabled ? "" : "bg-primary text-primary-foreground"}
                      >
                        {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        {isMfaEnabled ? "Add another authenticator" : "Set up authenticator app"}
                      </Button>
                      {isMfaEnabled ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setMfaDisableDialogOpen(true)}
                          disabled={isMfaDisableBusy}
                          className="border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
                        >
                          {mfaDisablePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                          Turn off MFA
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current assurance</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{currentAalLabel}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Your current signed-in assurance level.</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Target assurance</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{nextAalLabel}</p>
                      <p className="mt-1 text-sm text-muted-foreground">Where the account can step up after MFA.</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Authenticators</p>
                      <p className="mt-2 text-lg font-semibold text-foreground">{verifiedMfaFactors.length}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {unverifiedMfaFactorCount > 0
                          ? `${unverifiedMfaFactorCount} pending setup`
                          : isMfaEnabled
                            ? "Verified and available for sign-in"
                            : "No verified authenticator yet"}
                      </p>
                    </div>
                  </div>

                  {!isMfaEnabled ? (
                    <div className="mt-5">
                      <EmptyState
                        title="No authenticator app connected"
                        description="Set up a TOTP authenticator such as Google Authenticator, 1Password, Authy, or Microsoft Authenticator."
                        icon={Smartphone}
                        size="compact"
                        actions={[{ label: "Set up authenticator app", onClick: () => setMfaSetupOpen(true) }]}
                      />
                    </div>
                  ) : null}

                  {isMfaEnabled ? (
                    <div className="mt-5 space-y-3">
                      {verifiedMfaFactors.map((factor) => (
                        <div
                          key={factor.id}
                          className="flex flex-col gap-4 rounded-lg border border-border p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">
                                {factor.friendlyName || "Authenticator app"}
                              </p>
                              <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
                                Verified
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {factor.factorType.toUpperCase()} factor added {formatDateTime(factor.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Last challenge {factor.lastChallengedAt ? formatDateTime(factor.lastChallengedAt) : "Not yet recorded"}
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setFactorPendingRemoval(factor)}
                            disabled={isAnyMfaBusy}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {isMfaEnabled ? (
                    <div className="mt-5 rounded-xl border border-border bg-muted/20 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <h5 className="text-base font-semibold text-foreground">Backup recovery codes</h5>
                          <p className="text-sm text-muted-foreground">
                            Generate one-time backup codes so you can still reach the workspace if your authenticator
                            device is unavailable.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant={mfaRecoverySummaryQuery.data?.totalCodes ? "outline" : "default"}
                          onClick={() => void handleGenerateMfaRecoveryCodes()}
                          disabled={generateMfaRecoveryCodesMutation.isPending || isAnyMfaBusy}
                          className={mfaRecoverySummaryQuery.data?.totalCodes ? "" : "bg-primary text-primary-foreground"}
                        >
                          {generateMfaRecoveryCodesMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                          {mfaRecoverySummaryQuery.data?.totalCodes ? "Regenerate recovery codes" : "Generate recovery codes"}
                        </Button>
                      </div>

                      {mfaRecoverySummaryQuery.error ? (
                        <div className="mt-4 rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                          {getErrorMessage(
                            mfaRecoverySummaryQuery.error,
                            "We could not load your recovery-code summary.",
                          )}
                        </div>
                      ) : null}

                      {mfaRecoverySummaryQuery.isLoading ? (
                        <div className="mt-4 rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          Loading your backup-code summary...
                        </div>
                      ) : null}

                      {!mfaRecoverySummaryQuery.isLoading ? (
                        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                          <div className="rounded-lg border border-border bg-background p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Remaining codes</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">
                              {mfaRecoverySummaryQuery.data?.remainingCodes ?? 0}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Unused backup codes still available for this account.
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-background p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last generated</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">
                              {mfaRecoverySummaryQuery.data?.latestGeneratedAt
                                ? formatDateTime(mfaRecoverySummaryQuery.data.latestGeneratedAt)
                                : "Not generated"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Generating a new set immediately invalidates the old codes.
                            </p>
                          </div>
                          <div className="rounded-lg border border-border bg-background p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last used</p>
                            <p className="mt-2 text-lg font-semibold text-foreground">
                              {mfaRecoverySummaryQuery.data?.lastUsedAt
                                ? formatDateTime(mfaRecoverySummaryQuery.data.lastUsedAt)
                                : "Not used"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              Use a recovery code only when you cannot access your authenticator app.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {!mfaRecoverySummaryQuery.isLoading && !mfaRecoverySummaryQuery.data?.totalCodes ? (
                        <div className="mt-4">
                          <EmptyState
                            title="No backup recovery codes yet"
                            description="Generate a set now so you still have a secure recovery path if you lose access to your authenticator app."
                            icon={KeyRound}
                            size="compact"
                            actions={[{ label: "Generate recovery codes", onClick: () => void handleGenerateMfaRecoveryCodes() }]}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-border bg-background p-6">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-base font-semibold text-foreground">Privacy & Data Export</h4>
                      <p className="text-sm text-muted-foreground">
                        Control how future privacy-sensitive features behave, then download account or workspace data on demand.
                      </p>
                    </div>
                    <Badge variant="outline">Phase 2</Badge>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-5">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Privacy controls</p>
                        <h5 className="text-base font-semibold text-foreground">Choose what future systems can include</h5>
                      </div>

                      {hasPrivacyError ? (
                        <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                          {getErrorMessage(privacyPreferencesQuery.error, "We could not load your privacy preferences.")}
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {privacyOptions.map((option) => (
                          <div
                            key={option.key}
                            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background px-4 py-3"
                          >
                            <div className="space-y-1">
                              <p className="font-medium text-foreground">{option.label}</p>
                              <p className="text-sm text-muted-foreground">{option.description}</p>
                            </div>
                            <Switch
                              checked={privacyPreferences[option.key]}
                              onCheckedChange={(checked) =>
                                setPrivacyPreferences((current) => ({
                                  ...current,
                                  [option.key]: checked,
                                }))
                              }
                              disabled={isPrivacyBusy}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-end">
                        <Button
                          type="button"
                          onClick={() => void handlePrivacySave()}
                          disabled={isPrivacyBusy || !businessId || !isPrivacyDirty}
                          className="bg-primary text-primary-foreground"
                        >
                          {updatePrivacyPreferencesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Save Privacy Controls
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-border bg-background p-5">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">Data export</p>
                        <h5 className="text-base font-semibold text-foreground">Download JSON snapshots</h5>
                      </div>

                      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                        Account export includes your profile, memberships, preferences, and recent notifications. Workspace export includes business records and respects your current export privacy toggles.
                      </div>

                      <div className="space-y-3">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleAccountDataExport()}
                          disabled={isSecurityExportBusy}
                          className="w-full justify-between"
                        >
                          <span>Download account data</span>
                          {isSecurityExportBusy && securityExportStatus?.action === "account" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ShieldAlert className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void handleWorkspaceDataExport()}
                          disabled={isSecurityExportBusy || !canExportWorkspaceData}
                          className="w-full justify-between"
                        >
                          <span>Download workspace data</span>
                          {isSecurityExportBusy && securityExportStatus?.action === "workspace" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <PackageOpen className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {canExportWorkspaceData
                          ? "Workspace exports are available for owners, admins, and accountants."
                          : "Workspace exports require owner, admin, or accountant access in the current workspace."}
                      </p>

                      {securityExportStatus ? (
                        <OperationStatusNotice
                          description={securityExportStatus.description}
                          state={securityExportStatus.state}
                          title={securityExportStatus.title}
                          onRetry={
                            securityExportStatus.state === "error"
                              ? securityExportStatus.action === "account"
                                ? () => void handleAccountDataExport()
                                : () => void handleWorkspaceDataExport()
                              : undefined
                          }
                          retryLabel={
                            securityExportStatus.action === "account" ? "Retry account export" : "Retry workspace export"
                          }
                        />
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="business">
            {isInitialLoading ? (
              <SettingsSectionSkeleton variant="business" />
            ) : (
              <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">Business Information</h3>

              {!settings?.business ? (
                <EmptyState
                  title="Workspace details are still being prepared"
                  description="Once the business record is available, company settings and defaults will sync here."
                  icon={Building2}
                  size="compact"
                />
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="settings-business-name">Business Name</Label>
                  <Input
                    {...getFormFieldAriaProps({
                      error: businessErrors.name,
                      id: "settings-business-name",
                      required: true,
                    })}
                    value={business.name}
                    onChange={(event) => {
                      clearBusinessError("name");
                      setBusiness((current) => ({ ...current, name: event.target.value }));
                    }}
                    className={businessErrors.name ? inputErrorClassName : ""}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  />
                  {businessErrors.name ? (
                    <p id="settings-business-name-error" className={inlineErrorClassName} role="alert">
                      {businessErrors.name}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-business-address">Business Address</Label>
                  <Input
                    id="settings-business-address"
                    value={business.address}
                    onChange={(event) => setBusiness((current) => ({ ...current, address: event.target.value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-business-phone">Business Phone</Label>
                  <Input
                    {...getFormFieldAriaProps({
                      error: businessErrors.phone,
                      id: "settings-business-phone",
                      type: "tel",
                    })}
                    inputMode="tel"
                    pattern="[+0-9 ()\\-]+"
                    value={business.phone}
                    onChange={(event) => {
                      clearBusinessError("phone");
                      setBusiness((current) => ({ ...current, phone: filterPhoneInput(event.target.value) }));
                    }}
                    placeholder={phonePlaceholder}
                    className={businessErrors.phone ? inputErrorClassName : ""}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  />
                  <p className="text-xs text-muted-foreground">Use digits and an optional leading +, for example {phonePlaceholder}.</p>
                  {businessErrors.phone ? (
                    <p id="settings-business-phone-error" className={inlineErrorClassName} role="alert">
                      {businessErrors.phone}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-rc-number">RC Number</Label>
                  <Input
                    id="settings-rc-number"
                    value={business.rcNumber}
                    onChange={(event) => setBusiness((current) => ({ ...current, rcNumber: event.target.value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-tax-id">Tax ID (TIN)</Label>
                  <Input
                    id="settings-tax-id"
                    value={business.taxId}
                    onChange={(event) => setBusiness((current) => ({ ...current, taxId: event.target.value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select
                    value={business.currency}
                    onValueChange={(value) => setBusiness((current) => ({ ...current, currency: value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currencyOption) => (
                        <SelectItem key={currencyOption.value} value={currencyOption.value}>
                          {currencyOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("locale.labels.businessDefaultLanguage")}</Label>
                  <Select
                    value={business.language}
                    onValueChange={(value) => setBusiness((current) => ({ ...current, language: value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedLanguages.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("locale.labels.businessDefaultLocale")}</Label>
                  <Select
                    value={business.locale}
                    onValueChange={(value) => setBusiness((current) => ({ ...current, locale: value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedLocales.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fiscal Year Start</Label>
                  <Select
                    value={business.fiscalYear}
                    onValueChange={(value) => setBusiness((current) => ({ ...current, fiscalYear: value }))}
                    disabled={isInitialLoading || updateBusinessMutation.isPending || !settings?.business}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((month) => (
                        <SelectItem key={month} value={month}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div id="marketplace-routing" className="rounded-xl border border-border bg-background p-5 scroll-mt-20">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{t("locale.sections.businessEyebrow")}</p>
                  <h4 className="text-base font-semibold text-foreground">{t("locale.sections.businessTitle")}</h4>
                  <p className="text-sm text-muted-foreground">{t("locale.sections.businessDescription")}</p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("locale.datePreview")}</p>
                    <p className="mt-2 font-medium text-foreground">{businessPreviewDate}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{business.locale}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("locale.currencyPreview")}</p>
                    <p className="mt-2 font-medium text-foreground">{businessPreviewMoney}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{business.currency}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("locale.numberPreview")}</p>
                    <p className="mt-2 font-medium text-foreground">{businessPreviewNumber}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{business.language}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Finance surfaces</p>
                    <h4 className="text-base font-semibold text-foreground">Funding and marketplace routing now live on their own pages</h4>
                    <p className="text-sm text-muted-foreground">
                      Use the sidebar finance section for the dedicated workspace funding balance page and marketplace routing controls. This
                      settings area now stays focused on business profile setup.
                    </p>
                  </div>
                  <Badge variant="outline">Dedicated pages</Badge>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Workspace funding</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Review available balance, reserved funds, and funding status on the dedicated funding page.
                    </p>
                    <div className="mt-4 flex justify-end">
                      <Button type="button" variant="outline" onClick={() => navigate("/wallet")}>
                        Open Funding
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <p className="text-sm font-medium text-foreground">Marketplace Routing</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage Paystack subaccounts and split configuration on the dedicated routing page.
                    </p>
                    <div className="mt-4 flex justify-end">
                      <Button type="button" variant="outline" onClick={() => navigate("/marketplace-routing")}>
                        Open Routing
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleBusinessSave}
                  disabled={
                    isInitialLoading ||
                    updateBusinessMutation.isPending ||
                    !settings?.business?.id ||
                    !isBusinessDirty
                  }
                  className="bg-primary text-primary-foreground"
                >
                  {updateBusinessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("common.saveChanges")}
                </Button>
              </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="notifications">
            {isInitialLoading || (notificationPreferencesQuery.isLoading && !notificationPreferencesQuery.data) ? (
              <SettingsSectionSkeleton variant="notifications" />
            ) : (
              <div className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
              {hasNotificationError ? (
                <div className="rounded-lg border border-[#F8C9C9] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B42318]">
                  {getErrorMessage(notificationPreferencesQuery.error, "We could not load your notification preferences.")}
                </div>
              ) : null}
              <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5 text-accent" />
                  ) : (
                    <Sun className="h-5 w-5 text-warning" />
                  )}
                  <div>
                    <p className="font-medium text-foreground">Dark Mode</p>
                    <p className="text-sm text-muted-foreground">Switch between light and dark theme</p>
                  </div>
                </div>
                <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
              </div>

              <div className="space-y-3">
                {notificationOptions.map((option) => (
                  <div key={option.key} className="flex items-start justify-between gap-4 rounded-lg border border-border px-4 py-3">
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <Switch
                      checked={notificationPreferences[option.key]}
                      onCheckedChange={(checked) =>
                        setNotificationPreferences((current) => ({
                          ...current,
                          [option.key]: checked,
                        }))
                      }
                      disabled={notificationPreferencesQuery.isLoading || updateNotificationPreferencesMutation.isPending}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border px-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-primary" />
                      <p className="font-medium text-foreground">Scheduled Weekly Digest</p>
                      <Badge variant={notificationPreferences.email_digest && notificationPreferences.weekly_report ? "outline" : "secondary"}>
                        {notificationPreferences.email_digest && notificationPreferences.weekly_report ? "Active" : "Off"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      When both <span className="font-medium text-foreground">Email Digest</span> and <span className="font-medium text-foreground">Weekly Report</span> are enabled, Moniger sends an automated weekly digest every Monday at 08:00 UTC.
                    </p>
                  </div>
                </div>
                {scheduledDigestRunQuery.isLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">Loading the latest scheduled digest status...</p>
                ) : latestScheduledDigestRun ? (
                  <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-3 text-sm">
                    <p className="font-medium text-foreground">
                      Last automated digest: {latestScheduledDigestRun.status === "sent" ? "Sent" : "Failed"}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      Scheduled for {formatDateTime(latestScheduledDigestRun.scheduledFor)} with {latestScheduledDigestRun.itemCount} item{latestScheduledDigestRun.itemCount === 1 ? "" : "s"}.
                    </p>
                    {latestScheduledDigestRun.errorMessage ? (
                      <p className="mt-2 text-destructive">{latestScheduledDigestRun.errorMessage}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No automated weekly digest has been recorded yet for this workspace membership.
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-border px-4 py-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <p className="font-medium text-foreground">Email Delivery</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send a real backend digest preview email to {user?.email ?? "your account"} to verify delivery and content.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleSendDigestPreview()}
                    disabled={
                      isEmailDeliveryBusy ||
                      !businessId ||
                      !notificationPreferences.email_digest ||
                      updateNotificationPreferencesMutation.isPending
                    }
                    className="gap-2"
                  >
                    {sendDigestPreviewEmailMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Send Test Digest
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Enable the Email Digest toggle above before sending a preview. This uses the backend email delivery function instead of the browser mail app.
                </p>
              </div>

              {emailDeliveryStatus?.action === "digest-preview" ? (
                <OperationStatusNotice
                  title={emailDeliveryStatus.title}
                  description={emailDeliveryStatus.description}
                  state={emailDeliveryStatus.state}
                  onRetry={emailDeliveryStatus.state === "error" ? () => void handleSendDigestPreview() : undefined}
                  retryLabel="Send Again"
                />
              ) : null}

              <div className="flex justify-end">
                <Button
                  onClick={handleNotificationSave}
                  disabled={
                    notificationPreferencesQuery.isLoading ||
                    updateNotificationPreferencesMutation.isPending ||
                    !businessId ||
                    !isNotificationDirty
                  }
                  className="bg-primary text-primary-foreground"
                >
                  {updateNotificationPreferencesMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save Preferences
                </Button>
              </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        )}

        <Dialog open={inviteDialogOpen} onOpenChange={(open) => (open ? setInviteDialogOpen(true) : closeInviteDialog())}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Invite an existing user directly, or send a secure acceptance email to someone who still needs to create their moniger.net account.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-invite-email">Email Address</Label>
                <Input
                  {...getFormFieldAriaProps({
                    error: inviteErrors.email,
                    hint: "The teammate must already have a moniger.net account before you can add them here.",
                    id: "team-invite-email",
                    required: true,
                  })}
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => {
                    clearInviteError("email");
                    setInviteEmail(event.target.value);
                  }}
                  placeholder="teammate@example.com"
                  disabled={teamMutations.inviteMember.isPending}
                  className={inviteErrors.email ? inputErrorClassName : ""}
                />
                <p id="team-invite-email-hint" className="text-xs text-muted-foreground">
                  If they already have an account, access is granted immediately. Otherwise, they will receive an invite link to finish onboarding.
                </p>
                {inviteErrors.email ? (
                  <p id="team-invite-email-error" className={inlineErrorClassName} role="alert">
                    {inviteErrors.email}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="team-invite-role">Access Level</Label>
                <Select
                  value={inviteRole}
                  onValueChange={(value) => setInviteRole(value as Enums<"business_role">)}
                  disabled={teamMutations.inviteMember.isPending}
                >
                  <SelectTrigger id="team-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((roleOption) => (
                      <SelectItem key={roleOption.value} value={roleOption.value}>
                        {roleOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {roleOptions.find((roleOption) => roleOption.value === inviteRole)?.description}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeInviteDialog} disabled={teamMutations.inviteMember.isPending}>
                  Cancel
                </Button>
                <Button
                  onClick={() => void handleInviteMember()}
                  disabled={teamMutations.inviteMember.isPending}
                >
                  {teamMutations.inviteMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Send Invite
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(recoveryCodesDialogState)}
          onOpenChange={(open) => {
            if (!open) {
              setRecoveryCodesDialogState(null);
            }
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Save your recovery codes</DialogTitle>
              <DialogDescription>
                These backup codes are shown only once. Store them somewhere secure before closing this dialog.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Anyone with one of these codes can bypass your authenticator for a single session. Treat them like
                passwords and keep them out of shared notes or chats.
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Generated</p>
                    <p className="text-sm text-muted-foreground">
                      {recoveryCodesDialogState ? formatDateTime(recoveryCodesDialogState.generatedAt) : "Unavailable"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => void handleCopyRecoveryCodes()}>
                      <KeyRound className="h-4 w-4" />
                      Copy codes
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDownloadRecoveryCodes}>
                      <Save className="h-4 w-4" />
                      Download .txt
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {recoveryCodesDialogState?.codes.map((code) => (
                    <div
                      key={code}
                      className="rounded-lg border border-border bg-background px-4 py-3 font-mono text-sm font-semibold tracking-[0.2em] text-foreground"
                    >
                      {formatRecoveryCode(code)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  If you generate a new set later, every code shown here will stop working immediately.
                </p>
                <Button type="button" onClick={() => setRecoveryCodesDialogState(null)} className="bg-primary text-primary-foreground">
                  I stored these codes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={mfaSetupOpen}
          onOpenChange={(open) => {
            if (open) {
              setMfaSetupOpen(true);
              return;
            }

            void closeMfaSetupDialog();
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Set Up Authenticator App</DialogTitle>
              <DialogDescription>
                Give this authenticator a label, scan the QR code, then enter the current 6-digit code to verify it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="mfa-friendly-name">Authenticator Label</Label>
                <Input
                  {...getFormFieldAriaProps({
                    error: mfaErrors.friendlyName,
                    hint: "This name helps you recognize the authenticator later.",
                    id: "mfa-friendly-name",
                    required: true,
                  })}
                  value={mfaFriendlyName}
                  onChange={(event) => {
                    clearMfaError("friendlyName");
                    setMfaFriendlyName(event.target.value);
                  }}
                  placeholder="Primary authenticator"
                  disabled={Boolean(mfaSetupState) || mfaEnrollPending || mfaVerifyPending}
                  className={mfaErrors.friendlyName ? inputErrorClassName : ""}
                />
                <p id="mfa-friendly-name-hint" className="text-xs text-muted-foreground">
                  This name helps you recognize the authenticator later.
                </p>
                {mfaErrors.friendlyName ? (
                  <p id="mfa-friendly-name-error" className={inlineErrorClassName} role="alert">
                    {mfaErrors.friendlyName}
                  </p>
                ) : null}
              </div>

              {!mfaSetupState ? (
                <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Start setup to generate a QR code and secret for your authenticator app.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="rounded-xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <QrCode className="h-4 w-4" />
                      QR Code
                    </div>
                    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-white p-3">
                      <img
                        src={getMfaQrCodeDataUrl(mfaSetupState.qrCode)}
                        alt={`QR code for ${mfaSetupState.friendlyName}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                      <p className="text-sm font-medium text-foreground">Step 1</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Scan the QR code with Google Authenticator, Authy, 1Password, Microsoft Authenticator, or another TOTP app.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-secret">Manual setup key</Label>
                      <Input id="mfa-secret" value={mfaSetupState.secret} readOnly className="font-mono text-sm" />
                      <p className="text-xs text-muted-foreground">
                        If you cannot scan the code, enter this secret manually in your authenticator app.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mfa-verification-code">Authenticator Code</Label>
                      <Input
                        {...getFormFieldAriaProps({
                          error: mfaErrors.verificationCode,
                          hint: "Enter the current 6-digit code from your authenticator app.",
                          id: "mfa-verification-code",
                          required: true,
                        })}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={mfaVerificationCode}
                        onChange={(event) => {
                          clearMfaError("verificationCode");
                          setMfaVerificationCode(event.target.value);
                        }}
                        placeholder="123456"
                        disabled={mfaVerifyPending}
                        className={mfaErrors.verificationCode ? inputErrorClassName : ""}
                      />
                      <p id="mfa-verification-code-hint" className="text-xs text-muted-foreground">
                        Enter the current 6-digit code from your authenticator app.
                      </p>
                      {mfaErrors.verificationCode ? (
                        <p id="mfa-verification-code-error" className={inlineErrorClassName} role="alert">
                          {mfaErrors.verificationCode}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Closing this dialog before verification will discard the pending authenticator setup.
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => void closeMfaSetupDialog()} disabled={mfaVerifyPending}>
                    Cancel
                  </Button>
                  {!mfaSetupState ? (
                    <Button
                      type="button"
                      onClick={() => void handleStartMfaSetup()}
                      disabled={mfaEnrollPending}
                      className="bg-primary text-primary-foreground"
                    >
                      {mfaEnrollPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Generate Setup
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => void handleVerifyMfaSetup()}
                      disabled={mfaVerifyPending}
                      className="bg-primary text-primary-foreground"
                    >
                      {mfaVerifyPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Verify Authenticator
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={cancelSubscriptionDialogOpen}
          onOpenChange={(open) => !open && !cancelSubscriptionPending && setCancelSubscriptionDialogOpen(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel subscription renewal?</AlertDialogTitle>
              <AlertDialogDescription>
                Paystack renewal will be stopped. Your current {currentWorkspacePlan} plan remains available until the recorded renewal date; no new charge will be created after that date.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelSubscriptionPending}>Keep subscription</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleCancelSubscription()} disabled={cancelSubscriptionPending}>
                {cancelSubscriptionPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel renewal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(factorPendingRemoval)}
          onOpenChange={(open) => !open && !isAnyMfaBusy && setFactorPendingRemoval(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Authenticator?</AlertDialogTitle>
              <AlertDialogDescription>
                {factorPendingRemoval
                  ? `${factorPendingRemoval.friendlyName || "This authenticator"} will stop being accepted for sign-in verification.`
                  : "This authenticator will stop being accepted for sign-in verification."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isAnyMfaBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();

                  if (factorPendingRemoval) {
                    void handleRemoveMfaFactor(factorPendingRemoval);
                  }
                }}
                disabled={!factorPendingRemoval || isAnyMfaBusy}
              >
                {isAnyMfaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Remove Authenticator
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={mfaDisableDialogOpen}
          onOpenChange={(open) => !open && !isMfaDisableBusy && setMfaDisableDialogOpen(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Turn off multi-factor authentication?</AlertDialogTitle>
              <AlertDialogDescription>
                {verifiedMfaFactors.length > 0
                  ? `This will remove ${verifiedMfaFactors.length} verified authenticator${
                      verifiedMfaFactors.length === 1 ? "" : "s"
                    } and MFA will no longer be required for sign-in.`
                  : "This will remove your authenticator setup and MFA will no longer be required for sign-in."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMfaDisableBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleDisableMfa();
                }}
                disabled={isMfaDisableBusy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isMfaDisableBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Turn off MFA
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={Boolean(confirmSecurityAction)}
          onOpenChange={(open) => !open && !isSecurityBusy && setConfirmSecurityAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmSecurityAction === "global" ? "Sign Out Everywhere?" : "Sign Out Other Sessions?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmSecurityAction === "global"
                  ? "This will close every active session for your account, including this device."
                  : "This will close every other active session for your account while keeping this device signed in."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSecurityBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();

                  if (confirmSecurityAction) {
                    void handleScopedSignOut(confirmSecurityAction);
                  }
                }}
                disabled={!confirmSecurityAction || isSecurityBusy}
              >
                {isSecurityBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {confirmSecurityAction === "global" ? "Sign Out Everywhere" : "Sign Out Other Sessions"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(memberPendingRevoke)} onOpenChange={(open) => !open && setMemberPendingRevoke(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Revoke Workspace Access?</AlertDialogTitle>
              <AlertDialogDescription>
                {memberPendingRevoke
                  ? `${memberPendingRevoke.fullName} will lose access to this workspace immediately. You can restore access later from this page.`
                  : "This team member will lose access to this workspace immediately."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={teamMutations.updateMemberStatus.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();

                  if (memberPendingRevoke) {
                    void handleMemberStatusChange(memberPendingRevoke, "revoked");
                  }
                }}
                disabled={!memberPendingRevoke || teamMutations.updateMemberStatus.isPending}
              >
                {teamMutations.updateMemberStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Revoke Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
