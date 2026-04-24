import type { ReactNode } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import { Maximize2, X } from "lucide-react";

import { glassPanelSx } from "../../app/theme";

type FocusDialogProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function FocusDialog({ open, title, subtitle, onClose, children }: FocusDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          bgcolor: "background.default",
          backgroundImage: "none",
        },
      }}
    >
      <DialogTitle sx={{ ...glassPanelSx, borderRadius: 0, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" fontWeight={800}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton aria-label="Focus view" disabled>
              <Maximize2 size={18} />
            </IconButton>
            <IconButton aria-label="Close focus view" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ py: 2.5 }}>{children}</DialogContent>
    </Dialog>
  );
}
