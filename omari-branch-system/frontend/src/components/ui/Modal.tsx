import type { ReactNode } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";

import { X } from "lucide-react";

import { glassPanelSx } from "../../app/theme";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
};

function toDialogMaxWidth(maxWidthClassName: string): "sm" | "md" | "lg" {
  if (maxWidthClassName.includes("max-w-2xl")) {
    return "md";
  }
  if (maxWidthClassName.includes("max-w-3xl")) {
    return "lg";
  }
  return "sm";
}

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  maxWidthClassName = "max-w-2xl",
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={toDialogMaxWidth(maxWidthClassName)}
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ ...glassPanelSx, borderRadius: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} aria-label="Close">
            <X size={18} />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ maxHeight: "70vh", pt: 2.2 }}>{children}</DialogContent>
      {footer ? <DialogActions sx={{ px: 3, pb: 2 }}>{footer}</DialogActions> : null}
    </Dialog>
  );
}
