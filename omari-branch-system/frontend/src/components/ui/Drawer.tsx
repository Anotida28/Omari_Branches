import type { ReactNode } from "react";
import { Box, Drawer as MuiDrawer, IconButton, Stack, Typography } from "@mui/material";

import { X } from "lucide-react";

import { glassPanelSx } from "../../app/theme";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  widthClassName?: string;
};

function toDrawerWidth(widthClassName: string): number {
  if (widthClassName.includes("max-w-2xl")) {
    return 880;
  }
  if (widthClassName.includes("max-w-xl")) {
    return 760;
  }
  return 780;
}

export function Drawer({
  open,
  title,
  onClose,
  children,
  widthClassName = "w-full max-w-2xl",
}: DrawerProps) {
  return (
    <MuiDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: toDrawerWidth(widthClassName) },
        },
      }}
    >
      <Box sx={{ ...glassPanelSx, borderRadius: 0, px: 2.4, py: 1.6 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <X size={18} />
          </IconButton>
        </Stack>
      </Box>
      <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", px: 2.4, py: 2 }}>
        {children}
      </Box>
    </MuiDrawer>
  );
}
