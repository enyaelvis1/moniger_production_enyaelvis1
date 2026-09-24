import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import AppProviders from "./app/AppProviders";
import AnalyticsBridge from "@/components/app/AnalyticsBridge";
import RouteLoadingScreen from "@/components/app/RouteLoadingScreen";
import SessionTimeoutManager from "@/components/app/SessionTimeoutManager";

const Index = lazy(() => import("./pages/Index.tsx"));
const AboutPage = lazy(() => import("./pages/About.tsx"));
const ContactPage = lazy(() => import("./pages/Contact.tsx"));
const HelpCentrePage = lazy(() => import("./pages/HelpCentre.tsx"));
const PrivacyPage = lazy(() => import("./pages/Privacy.tsx"));
const PricingPage = lazy(() => import("./pages/Pricing.tsx"));
const PricingConfirmedPage = lazy(() => import("./pages/PricingConfirmed.tsx"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPassword.tsx"));
const ForgotPasswordConfirmedPage = lazy(() => import("./pages/ForgotPasswordConfirmed.tsx"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPassword.tsx"));
const ResetPasswordConfirmedPage = lazy(() => import("./pages/ResetPasswordConfirmed.tsx"));
const SecurityPage = lazy(() => import("./pages/Security.tsx"));
const SupportPage = lazy(() => import("./pages/Support.tsx"));
const TermsPage = lazy(() => import("./pages/Terms.tsx"));
const ChangelogPage = lazy(() => import("./pages/Changelog.tsx"));
const InvoicingPage = lazy(() => import("./pages/Features/Invoicing.tsx"));
const BillPaymentsPage = lazy(() => import("./pages/Features/BillPayments.tsx"));
const VendorManagementPage = lazy(() => import("./pages/Features/VendorManagement.tsx"));
const PayInvoicePage = lazy(() => import("./pages/PayInvoice.tsx"));
const PayInvoiceConfirmedPage = lazy(() => import("./pages/PayInvoiceConfirmed.tsx"));
const AdminApp = lazy(() => import("./app/AdminApp.tsx"));
const PlatformApp = lazy(() => import("./app/PlatformApp.tsx"));

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
