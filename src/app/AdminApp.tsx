import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import AppProviders from "@/app/AppProviders";
import AdminRoute from "@/admin/components/AdminRoute";
import AdminLayout from "@/admin/components/AdminLayout";

const AdminDashboardPage = lazy(() => import("@/admin/pages/AdminDashboardPage"));
const AdminPlatformMetricsPage = lazy(() => import("@/admin/pages/AdminPlatformMetricsPage"));
const AdminBusinessesPage = lazy(() => import("@/admin/pages/AdminBusinessesPage"));
const AdminBusinessInvoicesPage = lazy(() => import("@/admin/pages/AdminBusinessInvoicesPage"));
const AdminBanksPage = lazy(() => import("@/admin/pages/AdminBanksPage"));
const AdminCategoriesPage = lazy(() => import("@/admin/pages/AdminCategoriesPage"));
const AdminUsersPage = lazy(() => import("@/admin/pages/AdminUsersPage"));
const AdminSubscriptionsPage = lazy(() => import("@/admin/pages/AdminSubscriptionsPage"));
const AdminPaymentsPage = lazy(() => import("@/admin/pages/AdminPaymentsPage"));
const AdminPayoutsPage = lazy(() => import("@/admin/pages/AdminPayoutsPage"));
const AdminAnnouncementsPage = lazy(() => import("@/admin/pages/AdminAnnouncementsPage"));
const AdminContentPage = lazy(() => import("@/admin/pages/AdminContentPage"));
const AdminSignupAlertsPage = lazy(() => import("@/admin/pages/AdminSignupAlertsPage"));
const AdminSupportPage = lazy(() => import("@/admin/pages/AdminSupportPage"));
const AdminAuditPage = lazy(() => import("@/admin/pages/AdminAuditPage"));
const AdminHealthPage = lazy(() => import("@/admin/pages/AdminHealthPage"));
const AdminSettingsPage = lazy(() => import("@/admin/pages/AdminSettingsPage"));

const AdminApp = () => (
  <AppProviders>
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="metrics" element={<AdminPlatformMetricsPage />} />
            <Route path="businesses" element={<AdminBusinessesPage />} />
            <Route path="banks" element={<AdminBanksPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="businesses/:businessId/invoices" element={<AdminBusinessInvoicesPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="payouts" element={<AdminPayoutsPage />} />
            <Route path="announcements" element={<AdminAnnouncementsPage />} />
            <Route path="content" element={<AdminContentPage />} />
            <Route path="signup-alerts" element={<AdminSignupAlertsPage />} />
            <Route path="support" element={<AdminSupportPage />} />
            <Route path="audit" element={<AdminAuditPage />} />
            <Route path="health" element={<AdminHealthPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Suspense>
  </AppProviders>
);

export default AdminApp;
