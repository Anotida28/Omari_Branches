import { Box, Paper, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { glassPanelSx } from "../../app/theme";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
};

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Paper
      sx={{
        p: 2.2,
        ...glassPanelSx,
        borderColor: "rgba(22, 82, 55, 0.12)",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, opacity: 0.86 }}>
            {label}
          </Typography>
          <Typography variant="h5" color="text.primary" sx={{ mt: 0.7 }}>
            {value}
          </Typography>
          {hint ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {hint}
            </Typography>
          ) : null}
        </Box>
        {icon ? (
          <Box
            sx={{
              p: 1.2,
              borderRadius: 2,
              color: "primary.main",
              bgcolor: "rgba(12, 95, 63, 0.12)",
            }}
          >
            {icon}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
}
