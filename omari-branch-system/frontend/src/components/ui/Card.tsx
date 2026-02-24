import type { HTMLAttributes, ReactNode } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";

import { cn } from "./cn";
import { glassPanelSx } from "../../app/theme";

type CardProps = HTMLAttributes<HTMLDivElement>;

type CardHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function Card({ className, ...props }: CardProps) {
  return (
    <Paper
      elevation={0}
      className={cn(
        "rounded-lg border border-emerald-900/10 bg-white p-5",
        className,
      )}
      sx={glassPanelSx}
      {...props}
    />
  );
}

export function CardHeader({ title, subtitle, actions }: CardHeaderProps) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.2} sx={{ mb: 2 }}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "text.primary" }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.2 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {actions ? <Box>{actions}</Box> : null}
    </Stack>
  );
}
