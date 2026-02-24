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
        ...sx,
      }}
    >
      {children}
    </Paper>
  );
}

