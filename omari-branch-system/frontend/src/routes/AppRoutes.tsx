import { Navigate, Route, Routes } from "react-router-dom";

import { useApiKey } from "../hooks/useApiKey";
import AppLayout from "../layouts/AppLayout";
import ApiKeyPage from "../pages/ApiKeyPage";
import BranchesPage from "../pages/BranchesPage";
import DashboardPage from "../pages/DashboardPage";
import ExpensesPage from "../pages/ExpensesPage";
import MetricsPage from "../pages/MetricsPage";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
  const { apiKey, isReady } = useApiKey();

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
        path="/api-key"
        element={apiKey ? <Navigate to="/" replace /> : <ApiKeyPage />}
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
        <Route path="/expenses" element={<ExpensesPage />} />
      </Route>

      <Route path="*" element={<Navigate to={apiKey ? "/" : "/api-key"} replace />} />
    </Routes>
  );
}
