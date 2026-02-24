import { Paper, type PaperProps } from "@mui/material";
import type { ReactNode } from "react";

import { glassPanelSx } from "../../app/theme";

type FilterBarProps = PaperProps & {
  children: ReactNode;
};

export function FilterBar({ children, sx, ...props }: FilterBarProps) {
  return (
    <Paper
      {...props}
      sx={{
        p: 2,
        ...glassPanelSx,
        borderColor: "rgba(13, 63, 42, 0.14)",
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}
