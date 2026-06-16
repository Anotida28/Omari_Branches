import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import AppLayout from "../layouts/AppLayout";
import LoginPage from "../pages/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";
import { SuperAdminRoute } from "./SuperAdminRoute";

const DashboardPage = lazy(() => import("../pages/DashboardPage"));
const BranchesPage = lazy(() => import("../pages/BranchesPage"));
const MetricsPage = lazy(() => import("../pages/MetricsPage"));
const TrendsPage = lazy(() => import("../pages/TrendsPage"));
const ReportsPage = lazy(() => import("../pages/ReportsPage"));
const ExpensesPage = lazy(() => import("../pages/ExpensesPage"));
const AlertsPage = lazy(() => import("../pages/AlertsPage"));
const SettingsPage = lazy(() => import("../pages/SettingsPage"));
const WalletOverviewPage = lazy(() => import("../pages/WalletOverviewPage"));
const WalletCustomerActivityPage = lazy(() => import("../pages/WalletCustomerActivityPage"));
const WalletRetentionDormancyPage = lazy(() => import("../pages/WalletRetentionDormancyPage"));
const WalletTransactionPerformancePage = lazy(() => import("../pages/WalletTransactionPerformancePage"));
const WalletRevenuePerformancePage = lazy(() => import("../pages/WalletRevenuePerformancePage"));
const WalletLiquidityPage = lazy(() => import("../pages/WalletLiquidityPage"));
const WalletCustomer360Page = lazy(() => import("../pages/WalletCustomer360Page"));
const WalletInsightsAlertsPage = lazy(() => import("../pages/WalletInsightsAlertsPage"));
const WalletVisaAnalyticsPage = lazy(() => import("../pages/WalletVisaAnalyticsPage"));
const UsersPage = lazy(() => import("../pages/UsersPage"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#55675d]">
      Loading...
    </div>
  );
}

export function AppRoutes() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#eef5f0] text-sm text-[#55675d]">
        Loading...
      </div>
    );
  }

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />}
        />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/branches" element={<BranchesPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/trends" element={<TrendsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/expenses" element={<ExpensesPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/wallet/overview" element={<WalletOverviewPage />} />
          <Route path="/wallet/customer-activity" element={<WalletCustomerActivityPage />} />
          <Route path="/wallet/retention-dormancy" element={<WalletRetentionDormancyPage />} />
          <Route path="/wallet/transaction-performance" element={<WalletTransactionPerformancePage />} />
          <Route path="/wallet/revenue" element={<WalletRevenuePerformancePage />} />
          <Route path="/wallet/revenue-performance" element={<Navigate to="/wallet/revenue" replace />} />
          <Route path="/wallet/liquidity" element={<WalletLiquidityPage />} />
          <Route path="/wallet/customer-360" element={<WalletCustomer360Page />} />
          <Route path="/wallet/insights-alerts" element={<WalletInsightsAlertsPage />} />
          <Route path="/wallet/visa-analytics" element={<WalletVisaAnalyticsPage />} />
          <Route
            path="/users"
            element={
              <SuperAdminRoute>
                <UsersPage />
              </SuperAdminRoute>
            }
          />
        </Route>

        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
        />
      </Routes>
    </Suspense>
  );
}
