import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import ProtectedRoute from "@/components/ProtectedRoute";
import WorkspaceSubscriptionGate from "@/components/app/WorkspaceSubscriptionGate";
import AppProviders from "@/app/AppProviders";

const LoginPage = lazy(() => import("../pages/Login.tsx"));
const RegisterPage = lazy(() => import("../pages/Register.tsx"));
const AcceptInvitePage = lazy(() => import("../pages/AcceptInvite.tsx"));
const Dashboard = lazy(() => import("../pages/Dashboard.tsx"));
const WalletPage = lazy(() => import("../pages/Wallet.tsx"));
const WalletFundingConfirmedPage = lazy(() => import("../pages/WalletFundingConfirmed.tsx"));
const MarketplaceRoutingPage = lazy(() => import("../pages/MarketplaceRouting.tsx"));
const InvoicesPage = lazy(() => import("../pages/Invoices.tsx"));
const BillsPage = lazy(() => import("../pages/Bills.tsx"));
const VendorsPage = lazy(() => import("../pages/Vendors.tsx"));
const CustomersPage = lazy(() => import("../pages/Customers.tsx"));
const PaymentsPage = lazy(() => import("../pages/Payments.tsx"));
const ReportsPage = lazy(() => import("../pages/Reports.tsx"));
const AuditTrailPage = lazy(() => import("../pages/AuditTrail.tsx"));
const SettingsPage = lazy(() => import("../pages/Settings.tsx"));
const TeamPage = lazy(() => import("../pages/Team.tsx"));
const NotFound = lazy(() => import("../pages/NotFound.tsx"));

const PlatformApp = () => (
  <AppProviders>
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><WalletPage /></ProtectedRoute>} />
        <Route path="/wallet/confirmed" element={<ProtectedRoute><WalletFundingConfirmedPage /></ProtectedRoute>} />
        <Route path="/marketplace-routing" element={<ProtectedRoute><MarketplaceRoutingPage /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
        <Route path="/bills" element={<ProtectedRoute><BillsPage /></ProtectedRoute>} />
        <Route path="/vendors" element={<ProtectedRoute><VendorsPage /></ProtectedRoute>} />
        <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
        <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><WorkspaceSubscriptionGate><ReportsPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/team" element={<ProtectedRoute><TeamPage /></ProtectedRoute>} />
        <Route path="/audit-trail" element={<ProtectedRoute><WorkspaceSubscriptionGate><AuditTrailPage /></WorkspaceSubscriptionGate></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  </AppProviders>
);

export default PlatformApp;
