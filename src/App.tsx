import { Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppProviders from "./app/AppProviders";
import AnalyticsBridge from "@/components/app/AnalyticsBridge";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import SessionTimeoutManager from "@/components/app/SessionTimeoutManager";
import { lazyWithReload } from "@/lib/lazy-with-reload";

const Index = lazyWithReload(() => import("./pages/Index.tsx"));
const AboutPage = lazyWithReload(() => import("./pages/About.tsx"));
const ContactPage = lazyWithReload(() => import("./pages/Contact.tsx"));
const HelpCentrePage = lazyWithReload(() => import("./pages/HelpCentre.tsx"));
const PrivacyPage = lazyWithReload(() => import("./pages/Privacy.tsx"));
const PricingPage = lazyWithReload(() => import("./pages/Pricing.tsx"));
const PricingConfirmedPage = lazyWithReload(() => import("./pages/PricingConfirmed.tsx"));
const ForgotPasswordPage = lazyWithReload(() => import("./pages/ForgotPassword.tsx"));
const ForgotPasswordConfirmedPage = lazyWithReload(() => import("./pages/ForgotPasswordConfirmed.tsx"));
const ResetPasswordPage = lazyWithReload(() => import("./pages/ResetPassword.tsx"));
const ResetPasswordConfirmedPage = lazyWithReload(() => import("./pages/ResetPasswordConfirmed.tsx"));
const SecurityPage = lazyWithReload(() => import("./pages/Security.tsx"));
const SupportPage = lazyWithReload(() => import("./pages/Support.tsx"));
const TermsPage = lazyWithReload(() => import("./pages/Terms.tsx"));
const ChangelogPage = lazyWithReload(() => import("./pages/Changelog.tsx"));
const InvoicingPage = lazyWithReload(() => import("./pages/Features/Invoicing.tsx"));
const BillPaymentsPage = lazyWithReload(() => import("./pages/Features/BillPayments.tsx"));
const VendorManagementPage = lazyWithReload(() => import("./pages/Features/VendorManagement.tsx"));
const PayInvoicePage = lazyWithReload(() => import("./pages/PayInvoice.tsx"));
const PayInvoiceConfirmedPage = lazyWithReload(() => import("./pages/PayInvoiceConfirmed.tsx"));
const AdminApp = lazyWithReload(() => import("./app/AdminApp.tsx"));
const PlatformApp = lazyWithReload(() => import("./app/PlatformApp.tsx"));

const App = () => (
  <AppProviders>
    <BrowserRouter>
      <AnalyticsBridge />
      <SessionTimeoutManager />
      <Suspense fallback={<RouteLoadingScreen />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/help-centre" element={<HelpCentrePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/pricing/confirmed" element={<PricingConfirmedPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/forgot-password/confirmed" element={<ForgotPasswordConfirmedPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/reset-password/confirmed" element={<ResetPasswordConfirmedPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/features/invoicing" element={<InvoicingPage />} />
          <Route path="/features/bill-payments" element={<BillPaymentsPage />} />
          <Route path="/features/vendor-management" element={<VendorManagementPage />} />
          <Route path="/pay/:paymentToken" element={<PayInvoicePage />} />
          <Route path="/pay/:paymentToken/confirmed" element={<PayInvoiceConfirmedPage />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<PlatformApp />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </AppProviders>
);

export default App;
