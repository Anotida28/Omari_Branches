import { Alert, Box, Tooltip } from "@mui/material";
import type { ReactNode } from "react";

type RoleGuardWrapperProps = {
  canWrite: boolean;
  children: ReactNode;
  hideWhenReadOnly?: boolean;
};

export function RoleGuardWrapper({
  canWrite,
  children,
  hideWhenReadOnly = false,
}: RoleGuardWrapperProps) {
  if (canWrite) {
    return <>{children}</>;
  }

  if (hideWhenReadOnly) {
    return null;
  }

  return (
    <Tooltip title="Read-only mode (VIEWER role)">
      <Box sx={{ opacity: 0.6, pointerEvents: "none" }}>{children}</Box>
    </Tooltip>
  );
}

export function ReadOnlyBanner({ canWrite }: { canWrite: boolean }) {
  if (canWrite) {
    return null;
  }

  return (
    <Alert severity="info" variant="outlined">
      You are in read-only mode. Create, update, and delete actions are disabled.
    </Alert>
  );
}

