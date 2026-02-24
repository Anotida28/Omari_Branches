import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import AppLayout from "../layouts/AppLayout";
import AlertsPage from "../pages/AlertsPage";
import BranchesPage from "../pages/BranchesPage";
import DashboardPage from "../pages/DashboardPage";
import ExpensesPage from "../pages/ExpensesPage";
import LoginPage from "../pages/LoginPage";
import MetricsPage from "../pages/MetricsPage";
import { ProtectedRoute } from "./ProtectedRoute";

const TrendsPage = lazy(() => import("../pages/TrendsPage"));

export function AppRoutes() {
  const { isReady, isAuthenticated } = useAuth();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
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
                <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
                  Loading trends...
                </div>
              }
            >
              <TrendsPage />
            </Suspense>
          }
        />
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>

      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? "/" : "/login"} replace />}
      />
    </Routes>
  );
}
