import { Box, Stack, Typography, type SxProps, type Theme } from "@mui/material";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  sx?: SxProps<Theme>;
};

export function PageHeader({ title, subtitle, actions, sx }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      gap={2}
      sx={sx}
    >
      <Box>
        <Typography variant="h5" color="text.primary">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box>{actions}</Box> : null}
    </Stack>
  );
}

