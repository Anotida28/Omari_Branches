import type { ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useApiKey } from "../hooks/useApiKey";

type ProtectedRouteProps = {
  children: ReactElement;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { apiKey } = useApiKey();
  const location = useLocation();

  if (!apiKey) {
    return <Navigate to="/api-key" replace state={{ from: location.pathname }} />;
  }

  return children;
}
