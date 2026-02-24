import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Paper variant="outlined" sx={{ p: 4, borderStyle: "dashed", textAlign: "center" }}>
      <Stack spacing={1.2} alignItems="center">
        {icon ? (
          <Box sx={{ color: "text.secondary", opacity: 0.8 }}>
            {icon}
          </Box>
        ) : null}
        <Typography variant="subtitle1" color="text.primary">
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        ) : null}
        {actionLabel && onAction ? (
          <Button variant="contained" onClick={onAction} sx={{ mt: 1 }}>
            {actionLabel}
          </Button>
        ) : null}
      </Stack>
    </Paper>
  );
}

