import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import AlertsPage from "../features/alerts/AlertsPage";
import BranchesPage from "../features/branches/BranchesPage";
import DashboardPage from "../features/dashboard/DashboardPage";
import ExpensesPage from "../features/expenses/ExpensesPage";
import MetricsPage from "../features/metrics/MetricsPage";
import ReportsPage from "../features/reports/ReportsPage";
import SettingsPage from "../features/settings/SettingsPage";
import { useAuth } from "../hooks/useAuth";
import AppLayout from "../layout/AppShell";
import LoginPage from "../pages/LoginPage";
import { ProtectedRoute } from "./ProtectedRoute";

const TrendsPage = lazy(() => import("../features/trends/TrendsPage"));

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
        <Route
          path="/trends"
          element={
            <Suspense
              fallback={
                <div className="rounded-md border border-emerald-900/10 bg-white p-4 text-sm text-[#55675d]">
                  Loading trends...
                </div>
              }
            >
              <TrendsPage />
            </Suspense>
          }
        />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
