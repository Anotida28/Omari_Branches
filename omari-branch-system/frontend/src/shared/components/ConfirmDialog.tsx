import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onClose,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error" disabled={loading}>
          {loading ? "Please wait..." : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

