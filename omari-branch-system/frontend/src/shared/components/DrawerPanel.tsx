import { Box, Drawer, IconButton, Stack, Typography } from "@mui/material";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { glassPanelSx } from "../../app/theme";

type DrawerPanelProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
};

export function DrawerPanel({
  open,
  title,
  onClose,
  children,
  width = 760,
}: DrawerPanelProps) {
  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: width },
        },
      }}
    >
      <Box sx={{ p: 2.2, ...glassPanelSx, borderRadius: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose}>
            <X size={18} />
          </IconButton>
        </Stack>
      </Box>
      <Box sx={{ p: 2.5, overflowY: "auto", flex: 1 }}>{children}</Box>
    </Drawer>
  );
}

