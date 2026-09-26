import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import AppProviders from "@/app/AppProviders";
import AdminRoute from "@/admin/components/AdminRoute";
import AdminLayout from "@/admin/components/AdminLayout";
import { lazyWithReload } from "@/lib/lazy-with-reload";

const AdminDashboardPage = lazyWithReload(() => import("@/admin/pages/AdminDashboardPage"));
const AdminPlatformMetricsPage = lazyWithReload(() => import("@/admin/pages/AdminPlatformMetricsPage"));
const AdminBusinessesPage = lazyWithReload(() => import("@/admin/pages/AdminBusinessesPage"));
const AdminVendorsPage = lazyWithReload(() => import("@/admin/pages/AdminVendorsPage"));
const AdminBusinessInvoicesPage = lazyWithReload(() => import("@/admin/pages/AdminBusinessInvoicesPage"));
const AdminBanksPage = lazyWithReload(() => import("@/admin/pages/AdminBanksPage"));
const AdminCategoriesPage = lazyWithReload(() => import("@/admin/pages/AdminCategoriesPage"));
const AdminUsersPage = lazyWithReload(() => import("@/admin/pages/AdminUsersPage"));
const AdminSubscriptionsPage = lazyWithReload(() => import("@/admin/pages/AdminSubscriptionsPage"));
const AdminPaymentsPage = lazyWithReload(() => import("@/admin/pages/AdminPaymentsPage"));
const AdminReceivablesPage = lazyWithReload(() => import("@/admin/pages/AdminReceivablesPage"));
const AdminPayoutsPage = lazyWithReload(() => import("@/admin/pages/AdminPayoutsPage"));
const AdminAnnouncementsPage = lazyWithReload(() => import("@/admin/pages/AdminAnnouncementsPage"));
const AdminContentPage = lazyWithReload(() => import("@/admin/pages/AdminContentPage"));
const AdminSignupAlertsPage = lazyWithReload(() => import("@/admin/pages/AdminSignupAlertsPage"));
const AdminSupportPage = lazyWithReload(() => import("@/admin/pages/AdminSupportPage"));
const AdminAuditPage = lazyWithReload(() => import("@/admin/pages/AdminAuditPage"));
const AdminHealthPage = lazyWithReload(() => import("@/admin/pages/AdminHealthPage"));
const AdminSettingsPage = lazyWithReload(() => import("@/admin/pages/AdminSettingsPage"));

const AdminApp = () => (
  <AppProviders>
    <Suspense fallback={<RouteLoadingScreen />}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="metrics" element={<AdminPlatformMetricsPage />} />
            <Route path="businesses" element={<AdminBusinessesPage />} />
            <Route path="vendors" element={<AdminVendorsPage />} />
            <Route path="banks" element={<AdminBanksPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="businesses/:businessId/invoices" element={<AdminBusinessInvoicesPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
            <Route path="payments" element={<AdminPaymentsPage />} />
            <Route path="receivables" element={<AdminReceivablesPage />} />
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
