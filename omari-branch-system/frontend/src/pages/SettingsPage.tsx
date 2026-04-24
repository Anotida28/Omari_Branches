import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Mail, Plus, Trash2 } from "lucide-react";

import { Card, CardHeader } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../services/api";
import { sendTestEmail } from "../services/admin";
import {
  createRecipient,
  deleteRecipient,
  listRecipients,
  updateRecipient,
} from "../services/recipients";
import { ConfirmDialog } from "../shared/components/ConfirmDialog";

type HealthResponse = {
  ok: boolean;
  service: string;
};

const INITIAL_RECIPIENT_FORM = {
  email: "",
  name: "",
  isActive: true,
};

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Omari Email Test");
  const [message, setMessage] = useState("Testing bulk mailer delivery from Omari Branch Management.");
  const [formError, setFormError] = useState("");
  const [recipientForm, setRecipientForm] = useState(INITIAL_RECIPIENT_FORM);
  const [recipientFormError, setRecipientFormError] = useState("");
  const [recipientToDelete, setRecipientToDelete] = useState<{ id: string; email: string } | null>(
    null,
  );

  const healthQuery = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const { data } = await api.get<HealthResponse>("/health");
      return data;
    },
  });

  const recipientsQuery = useQuery({
    queryKey: ["reminder-recipients"],
    queryFn: listRecipients,
  });

  const createRecipientMutation = useMutation({
    mutationFn: createRecipient,
    onSuccess: () => {
      setRecipientForm(INITIAL_RECIPIENT_FORM);
      setRecipientFormError("");
      queryClient.invalidateQueries({ queryKey: ["reminder-recipients"] });
    },
  });

  const toggleRecipientMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateRecipient(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder-recipients"] });
    },
  });

  const deleteRecipientMutation = useMutation({
    mutationFn: deleteRecipient,
    onSuccess: () => {
      setRecipientToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["reminder-recipients"] });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: () => {
      setFormError("");
    },
  });

  const recipientMutationError = useMemo(() => {
    if (createRecipientMutation.isError) {
      return getErrorMessage(createRecipientMutation.error);
    }
    if (toggleRecipientMutation.isError) {
      return getErrorMessage(toggleRecipientMutation.error);
    }
    if (deleteRecipientMutation.isError) {
      return getErrorMessage(deleteRecipientMutation.error);
    }
    return "";
  }, [
    createRecipientMutation.error,
    createRecipientMutation.isError,
    deleteRecipientMutation.error,
    deleteRecipientMutation.isError,
    toggleRecipientMutation.error,
    toggleRecipientMutation.isError,
  ]);

  const testEmailError = useMemo(() => {
    if (testEmailMutation.isError) {
      return getErrorMessage(testEmailMutation.error);
    }
    return "";
  }, [
    testEmailMutation.error,
    testEmailMutation.isError,
  ]);
  const recipients = recipientsQuery.data ?? [];

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) {
      return;
    }

    if (!to.trim()) {
      setFormError("Recipient email is required.");
      return;
    }

    setFormError("");
    testEmailMutation.mutate({
      to: to.trim(),
      subject: subject.trim() || "Omari Email Test",
      message: message.trim() || "Email delivery test",
    });
  };

  const submitRecipient = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canWrite) {
      return;
    }

    const email = recipientForm.email.trim();
    if (!email) {
      setRecipientFormError("Recipient email is required.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setRecipientFormError("Invalid email format.");
      return;
    }

    setRecipientFormError("");
    createRecipientMutation.mutate({
      email,
      name: recipientForm.name.trim() || undefined,
      isActive: recipientForm.isActive,
    });
  };

  return (
    <section className="space-y-5 motion-fade-up">
      {!canWrite ? (
        <Alert severity="info" variant="outlined">
          You are in VIEWER mode. Configuration actions are disabled.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Reminder Recipients"
          subtitle="Shared HQ recipients who receive every reminder email"
        />
        <Stack spacing={2}>
          <Alert severity="info" variant="outlined">
            This list applies to all reminder emails across the system.
          </Alert>

          <Paper sx={{ p: 2, border: "1px solid rgba(15, 23, 42, 0.1)" }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Plus size={16} />
                <Typography variant="subtitle2">Add HQ recipient</Typography>
              </Stack>
              <form onSubmit={submitRecipient} className="space-y-3">
                <Stack spacing={2}>
                  <TextField
                    label="Recipient Email"
                    type="email"
                    value={recipientForm.email}
                    onChange={(event) =>
                      setRecipientForm((prev) => ({ ...prev, email: event.target.value }))
                    }
                    size="small"
                    disabled={!canWrite || createRecipientMutation.isPending}
                    required
                  />
                  <TextField
                    label="Name (optional)"
                    value={recipientForm.name}
                    onChange={(event) =>
                      setRecipientForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    size="small"
                    disabled={!canWrite || createRecipientMutation.isPending}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={recipientForm.isActive}
                        disabled={!canWrite || createRecipientMutation.isPending}
                        onChange={(_event, checked) =>
                          setRecipientForm((prev) => ({ ...prev, isActive: checked }))
                        }
                      />
                    }
                    label="Active recipient"
                  />
                  {recipientFormError ? <Alert severity="warning">{recipientFormError}</Alert> : null}
                  <Stack direction="row" justifyContent="flex-end">
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={!canWrite || createRecipientMutation.isPending}
                    >
                      {createRecipientMutation.isPending ? "Adding..." : "Add Recipient"}
                    </Button>
                  </Stack>
                </Stack>
              </form>
            </Stack>
          </Paper>

          {recipientMutationError ? <Alert severity="error">{recipientMutationError}</Alert> : null}

          {recipientsQuery.isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading reminder recipients...
            </Typography>
          ) : recipientsQuery.isError ? (
            <Alert severity="error">{getErrorMessage(recipientsQuery.error)}</Alert>
          ) : recipients.length === 0 ? (
            <Alert severity="warning" variant="outlined">
              No HQ reminder recipients are configured yet.
            </Alert>
          ) : (
            <Stack spacing={1}>
              {recipients.map((recipient) => (
                <Paper
                  key={recipient.id}
                  sx={{
                    px: 1.5,
                    py: 1.1,
                    border: "1px solid rgba(15, 23, 42, 0.1)",
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Stack
                        alignItems="center"
                        justifyContent="center"
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          bgcolor: recipient.isActive
                            ? "rgba(22, 163, 74, 0.14)"
                            : "rgba(100, 116, 139, 0.14)",
                          color: recipient.isActive ? "success.main" : "text.secondary",
                        }}
                      >
                        <Mail size={14} />
                      </Stack>
                      <Stack spacing={0.2}>
                        <Typography variant="body2" fontWeight={600}>
                          {recipient.email}
                        </Typography>
                        {recipient.name ? (
                          <Typography variant="caption" color="text.secondary">
                            {recipient.name}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <Chip
                        size="small"
                        color={recipient.isActive ? "success" : "default"}
                        label={recipient.isActive ? "ACTIVE" : "INACTIVE"}
                      />
                      <Switch
                        size="small"
                        checked={recipient.isActive}
                        disabled={!canWrite || toggleRecipientMutation.isPending}
                        onChange={(_event, checked) =>
                          toggleRecipientMutation.mutate({ id: recipient.id, isActive: checked })
                        }
                      />
                      <IconButton
                        size="small"
                        color="error"
                        disabled={!canWrite || deleteRecipientMutation.isPending}
                        onClick={() =>
                          setRecipientToDelete({ id: recipient.id, email: recipient.email })
                        }
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      </Card>

      <Card>
        <CardHeader title="Email Delivery Test" subtitle="Validate bulk mailer delivery from backend" />
        <form onSubmit={onSubmit} className="space-y-3">
          <Stack spacing={2}>
            <TextField
              label="Recipient Email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              size="small"
              type="email"
              disabled={!canWrite || testEmailMutation.isPending}
              required
            />
            <TextField
              label="Subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              size="small"
              disabled={!canWrite || testEmailMutation.isPending}
            />
            <TextField
              label="Message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              size="small"
              multiline
              minRows={4}
              disabled={!canWrite || testEmailMutation.isPending}
            />

            {formError ? <Alert severity="warning">{formError}</Alert> : null}
            {testEmailError ? <Alert severity="error">{testEmailError}</Alert> : null}
            {testEmailMutation.isSuccess ? (
              <Alert severity="success">
                {testEmailMutation.data.message} - Message ID: {testEmailMutation.data.messageId}
              </Alert>
            ) : null}

            <Stack direction="row" justifyContent="flex-end">
              <Button
                type="submit"
                variant="contained"
                disabled={!canWrite || testEmailMutation.isPending}
              >
                {testEmailMutation.isPending ? "Sending..." : "Send Test Email"}
              </Button>
            </Stack>
          </Stack>
        </form>
      </Card>

      <Card>
        <CardHeader title="System Info" subtitle="Environment and API health snapshot" />
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            API base URL: {import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:4000"}
          </Typography>
          {healthQuery.isLoading ? (
            <Typography variant="body2">Checking API health...</Typography>
          ) : healthQuery.isError ? (
            <Alert severity="error">{getErrorMessage(healthQuery.error)}</Alert>
          ) : (
            <Alert severity={healthQuery.data?.ok ? "success" : "warning"}>
              Service: {healthQuery.data?.service ?? "unknown"} | Health:{" "}
              {healthQuery.data?.ok ? "OK" : "Unhealthy"}
            </Alert>
          )}
        </Stack>
      </Card>

      <ConfirmDialog
        open={Boolean(recipientToDelete)}
        title="Remove Recipient"
        message={`Remove ${recipientToDelete?.email ?? "this recipient"} from HQ reminders?`}
        confirmLabel="Remove"
        onClose={() => setRecipientToDelete(null)}
        onConfirm={() => {
          if (recipientToDelete) {
            deleteRecipientMutation.mutate(recipientToDelete.id);
          }
        }}
        loading={deleteRecipientMutation.isPending}
      />
    </section>
  );
}
