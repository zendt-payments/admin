import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import ScrollToTop from "./components/ScrollToTop";

// Eager — these are on the critical path (launch / auth) and tiny.
import LaunchScreen from "./components/LaunchScreen";
import SplashScreen from "./components/SplashScreen";
import Login from "./components/login";
import PayCheckoutPage from "./components/PayCheckoutPage";

// Eager — dashboard home tab is the critical path after auth.
import DashboardSummary from "./components/dashboard/Summary";

const CardManagementPage = lazy(() => import("./components/dashboard/CardManagementPage"));
const ProfileHub = lazy(() => import("./components/dashboard/ProfileHub"));

const Signup = lazy(() => import("./components/Signup"));
const ForgotPasswordPage = lazy(() => import("./components/auth/ForgotPasswordPage"));
const Dashboard = lazy(() => import("./components/Dashboard"));
const DashboardTransactions = lazy(() => import("./components/dashboard/Transactions"));
const BusinessProfilePage = lazy(() => import("./components/dashboard/BusinessProfilePage"));
const SettingsPage = lazy(() => import("./components/dashboard/SettingsPage"));
const ChangePasswordPage = lazy(() => import("./components/dashboard/ChangePasswordPage"));
const ProfileSettingsPage = lazy(() => import("./components/dashboard/ProfileSettingsPage"));
const KycEntry = lazy(() => import("./components/dashboard/KycEntry"));
const AdminPage = lazy(() => import("./components/admin/AdminPage"));
const AdminRegisterPage = lazy(() => import("./components/admin/AdminRegisterPage"));
const PricingPage = lazy(() => import("./components/dashboard/PricingPage"));
const HelpPage = lazy(() => import("./components/dashboard/HelpPage"));
const InvoicePage = lazy(() => import("./components/dashboard/InvoicePage"));
const InvoiceOptionsPage = lazy(() => import("./components/dashboard/InvoiceOptionsPage"));
const PaymentLinksPage = lazy(() => import("./components/dashboard/PaymentLinksPage"));
const PaymentStatusPage = lazy(() => import("./components/dashboard/PaymentStatusPage"));
const PaymentLinkCreatePage = lazy(() => import("./components/dashboard/PaymentLinkCreatePage"));
const BusinessProfileEditPage = lazy(() => import("./components/dashboard/BusinessProfileEditPage"));
const AddClientPage = lazy(() => import("./components/dashboard/AddClientPage"));
const BankAccountsPage = lazy(() => import("./components/dashboard/BankAccountsPage"));
const BankAccountDetailPage = lazy(() => import("./components/dashboard/BankAccountDetailPage"));
const ReferralPage = lazy(() => import("./components/dashboard/ReferralPage"));
const SpendingDetailsPage = lazy(() => import("./components/dashboard/SpendingDetailsPage"));
const InvoiceSuccessPage = lazy(() => import("./components/dashboard/InvoiceSuccessPage"));
const InvoiceListPage = lazy(() => import("./components/dashboard/InvoiceListPage"));
const ClientsPage = lazy(() => import("./components/dashboard/ClientsPage"));
const UpdateClientPage = lazy(() => import("./components/dashboard/UpdateClientPage"));

import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { SocketProvider } from "./context/SocketProvider";
import { getSessionItem } from "./lib/storage";
import { AvatarProvider } from "./context/AvatarContext";
import { TEST_MODE } from "./services/testMode";
import { MotionProvider, PageTransition } from "./components/motion";
import { useNativeBackButton } from "./hooks/useNativeBackButton";

/** Legacy payment links used `/public/pay` (backend path) on the SPA host. */
function PublicPayRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/pay${search}`} replace />;
}

function TestModeBadge() {
  if (!TEST_MODE) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        textAlign: "center",
        fontSize: 10,
        letterSpacing: 1,
        padding: "2px 6px",
        background: "rgba(255, 196, 0, 0.92)",
        color: "#000",
        fontWeight: 600,
        pointerEvents: "none",
      }}
    >
      TEST BUILD — no backend
    </div>
  );
}

/**
 * Top-level Suspense fallback. Matches the body bg (#141414) exactly so any
 * brief moment between an old page unmounting and a new lazy chunk loading is
 * imperceptible — no color jump, no black flash.
 *
 * The inner Suspense boundaries inside AnimatedOutlet/PageTransition keep the
 * page shell mounted, so this top-level fallback should rarely show in practice.
 */
function RouteFallback() {
  return (
    <div className="min-h-screen bg-[#141414] pt-safe pb-safe" aria-busy="true" aria-label="Loading" />
  );
}

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Wait for Cognito session restore on refresh; otherwise isAuthenticated is briefly false
  // and we incorrectly send users to /login, then Login redirects to /dashboard/home.
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-[#141414] pt-safe pb-safe"
        aria-busy="true"
        aria-label="Loading session"
      />
    );
  }

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );
}

function SplashGuard() {
  const location = useLocation();
  const hasSeenSplash = getSessionItem("hasSeenSplash");

  // If user hasn't seen splash in this session and not already on splash screen
  if (!hasSeenSplash && location.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function NativeBackHandler() {
  useNativeBackButton();
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocketProvider>
          <AvatarProvider>
            <BrowserRouter>
              <NativeBackHandler />
              <MotionProvider>
                <TestModeBadge />
                <ScrollToTop />
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* Customer-facing Zwitch Layer checkout (no auth / splash). */}
                    <Route path="/pay" element={<PayCheckoutPage />} />
                    <Route path="/public/pay" element={<PublicPayRedirect />} />

                    <Route element={<PageTransition mode="scale" />}>
                      <Route path="/" element={<LaunchScreen />} />
                      <Route path="/splash" element={<SplashScreen />} />
                    </Route>

                    <Route element={<SplashGuard />}>
                      {/*
                       * `/dashboard/*` uses Dashboard's AnimatedOutlet only — avoid stacking
                       * PageTransition scale on nested route changes (lighter on Android WebViews).
                       */}
                      <Route element={<PageTransition mode="fade" />}>
                        <Route path="/login" element={<Login />} />
                        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/admin/register" element={<AdminRegisterPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                      </Route>

                      <Route element={<RequireAuth />}>
                        <Route path="/dashboard" element={<Dashboard />}>
                          <Route index element={<Navigate to="home" replace />} />
                          <Route path="home" element={<DashboardSummary />} />
                          <Route path="summary" element={<Navigate to="home" replace />} />
                          <Route path="card-management" element={<CardManagementPage />} />
                          <Route path="transactions" element={<DashboardTransactions />} />
                          <Route path="profile" element={<ProfileHub />} />
                          <Route path="profile-settings" element={<ProfileSettingsPage />} />
                          <Route path="business-profile" element={<BusinessProfilePage />} />
                          <Route path="business-profile/edit" element={<BusinessProfileEditPage />} />
                          <Route path="settings" element={<SettingsPage />} />
                          <Route path="change-password" element={<ChangePasswordPage />} />
                          <Route path="bank-accounts" element={<BankAccountsPage />} />
                          <Route path="bank-account/:id" element={<BankAccountDetailPage />} />
                          <Route path="kyc" element={<KycEntry />} />
                          <Route path="pricing" element={<PricingPage />} />
                          <Route path="help" element={<HelpPage />} />
                          <Route path="invoice-options" element={<InvoiceOptionsPage />} />
                          <Route path="invoices" element={<InvoiceListPage />} />
                          <Route path="invoice" element={<InvoicePage />} />
                          <Route path="invoice/success" element={<InvoiceSuccessPage />} />
                          <Route path="payment-status" element={<PaymentStatusPage />} />
                          <Route path="payment-links" element={<PaymentLinksPage />} />
                          <Route path="payment-links/new" element={<PaymentLinkCreatePage />} />
                          <Route path="clients" element={<ClientsPage />} />
                          <Route path="add-client" element={<AddClientPage />} />
                          <Route path="update-client" element={<UpdateClientPage />} />
                          <Route path="monthly-spend" element={<SpendingDetailsPage />} />
                          <Route
                            path="explore"
                            element={<Navigate to="/dashboard/monthly-spend" replace />}
                          />
                          <Route
                            path="spending-details"
                            element={<Navigate to="/dashboard/monthly-spend" replace />}
                          />
                          <Route path="referral" element={<ReferralPage />} />
                          <Route
                            path="settlement"
                            element={<Navigate to="/dashboard/transactions" replace />}
                          />
                        </Route>
                      </Route>
                    </Route>

                    <Route path="*" element={<Navigate to="/login" replace />} />
                  </Routes>
                </Suspense>
              </MotionProvider>
            </BrowserRouter>
          </AvatarProvider>
        </SocketProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
