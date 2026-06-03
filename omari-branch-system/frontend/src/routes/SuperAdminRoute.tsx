import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

type Props = { children: ReactElement };

export function SuperAdminRoute({ children }: Props) {
  const { user } = useAuth();

  if (user?.role !== "SUPER_ADMIN") {
    return <Navigate to="/" replace />;
  }

  return children;
}
