import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ToastContainer } from './components/common/ToastContainer';
import { OfflineIndicator } from './components/common/OfflineIndicator';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const VerifyOtpPage = lazy(() => import('./pages/VerifyOtpPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const FindStoragePage = lazy(() => import('./pages/FindStoragePage'));
const StorageDetailsPage = lazy(() => import('./pages/StorageDetailsPage'));
const BookingWizardPage = lazy(() => import('./pages/BookingWizardPage'));
const BookingConfirmationPage = lazy(() => import('./pages/BookingConfirmationPage'));
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage'));
const BookingDetailsPage = lazy(() => import('./pages/BookingDetailsPage'));
const MyInventoryPage = lazy(() => import('./pages/MyInventoryPage'));
const AddInventoryPage = lazy(() => import('./pages/AddInventoryPage'));
const QRScannerPage = lazy(() => import('./pages/QRScannerPage'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage'));
const TransactionHistoryPage = lazy(() => import('./pages/TransactionHistoryPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SupportPage = lazy(() => import('./pages/SupportPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#07111E] p-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="font-display text-2xl font-bold text-[#0B1F3A] dark:text-white">Something went wrong</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              An unexpected display error occurred. Reload the page to continue.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#0B1F3A] dark:bg-teal-600 px-4 py-2 text-xs font-semibold text-white"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#07111E]">
      <div className="w-7 h-7 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  const initSession = useAppStore((s) => s.initSession);

  useEffect(() => {
    initSession();
  }, [initSession]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/storage" element={<FindStoragePage />} />
            <Route path="/storage/:id" element={<StorageDetailsPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/faq" element={<FaqPage />} />

            {/* Protected Customer Routes */}
            <Route path="/verify-otp" element={<ProtectedRoute><VerifyOtpPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/book" element={<ProtectedRoute><BookingWizardPage /></ProtectedRoute>} />
            <Route path="/book/:facilityId" element={<ProtectedRoute><BookingWizardPage /></ProtectedRoute>} />
            <Route path="/booking-confirmation/:id" element={<ProtectedRoute><BookingConfirmationPage /></ProtectedRoute>} />
            <Route path="/bookings" element={<ProtectedRoute><MyBookingsPage /></ProtectedRoute>} />
            <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetailsPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><MyInventoryPage /></ProtectedRoute>} />
            <Route path="/inventory/add" element={<ProtectedRoute><AddInventoryPage /></ProtectedRoute>} />
            <Route path="/qr-scanner" element={<ProtectedRoute><QRScannerPage /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionHistoryPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

            {/* 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
        <ToastContainer />
        <OfflineIndicator />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
