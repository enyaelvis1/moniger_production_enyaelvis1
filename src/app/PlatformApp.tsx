import { Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import ProtectedRoute from "@/components/ProtectedRoute";
import WorkspaceSubscriptionGate from "@/components/app/WorkspaceSubscriptionGate";
import AppProviders from "@/app/AppProviders";
import { lazyWithReload } from "@/lib/lazy-with-reload";

const LoginPage = lazyWithReload(() => import("../pages/Login.tsx"));
const RegisterPage = lazyWithReload(() => import("../pages/Register.tsx"));
const AcceptInvitePage = lazyWithReload(() => import("../pages/AcceptInvite.tsx"));
const Dashboard = lazyWithReload(() => import("../pages/Dashboard.tsx"));
const WalletPage = lazyWithReload(() => import("../pages/Wallet.tsx"));
const WalletFundingConfirmedPage = lazyWithReload(() => import("../pages/WalletFundingConfirmed.tsx"));
const MarketplaceRoutingPage = lazyWithReload(() => import("../pages/MarketplaceRouting.tsx"));
const InvoicesPage = lazyWithReload(() => import("../pages/Invoices.tsx"));
const BillsPage = lazyWithReload(() => import("../pages/Bills.tsx"));
const VendorsPage = lazyWithReload(() => import("../pages/Vendors.tsx"));
const CustomersPage = lazyWithReload(() => import("../pages/Customers.tsx"));
const PaymentsPage = lazyWithReload(() => import("../pages/Payments.tsx"));
const ReportsPage = lazyWithReload(() => import("../pages/Reports.tsx"));
const AuditTrailPage = lazyWithReload(() => import("../pages/AuditTrail.tsx"));
const SettingsPage = lazyWithReload(() => import("../pages/Settings.tsx"));
const SubscriptionManagementPage = lazyWithReload(() => import("../pages/SubscriptionManagement.tsx"));
const TeamPage = lazyWithReload(() => import("../pages/Team.tsx"));
const NotFound = lazyWithReload(() => import("../pages/NotFound.tsx"));

const PlatformApp = () => (
  <AppProviders>
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/dashboard" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="dashboard"><Dashboard /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="funding"><WalletPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/wallet/confirmed" element={<ProtectedRoute><WalletFundingConfirmedPage /></ProtectedRoute>} />
        <Route path="/marketplace-routing" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="marketplaceRouting"><MarketplaceRoutingPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="invoices"><InvoicesPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/bills" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="bills"><BillsPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="vendors"><VendorsPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="customers"><CustomersPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="payments"><PaymentsPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="reports"><ReportsPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="team"><TeamPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/audit-trail" element={<ProtectedRoute><WorkspaceSubscriptionGate feature="auditTrail"><AuditTrailPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/subscription" element={<ProtectedRoute><SubscriptionManagementPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </AppProviders>
);

export default PlatformApp;
