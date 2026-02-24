import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Stack, TextField, Typography } from "@mui/material";

import { Card, CardHeader } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { api, getErrorMessage } from "../services/api";
import { sendTestEmail } from "../services/admin";
import { PageHeader } from "../shared/components/PageHeader";

type HealthResponse = {
  ok: boolean;
  service: string;
};

export default function SettingsPage() {
  const { user, canWrite } = useAuth();
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("Omari Email Test");
  const [message, setMessage] = useState("Testing SMTP delivery from Omari Branch Management.");
  const [formError, setFormError] = useState("");

  const healthQuery = useQuery({
    queryKey: ["system-health"],
    queryFn: async () => {
      const { data } = await api.get<HealthResponse>("/health");
      return data;
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: () => {
      setFormError("");
    },
  });

  const mutationError = useMemo(() => {
    if (!testEmailMutation.isError) {
      return "";
    }
    return getErrorMessage(testEmailMutation.error);
  }, [testEmailMutation.error, testEmailMutation.isError]);

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
      message: message.trim() || "SMTP test email",
    });
  };

  return (
    <section className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="System settings, operational checks, and role visibility"
      />

      {!canWrite ? (
        <Alert severity="info" variant="outlined">
          You are in VIEWER mode. Configuration actions are disabled.
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="User Management" subtitle="Role and account access overview" />
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Current user
          </Typography>
          <Typography variant="subtitle1" color="text.primary">
            {user?.username ?? "Unknown"} ({user?.role ?? "N/A"})
          </Typography>
          <Alert severity="info" variant="outlined">
            Full user CRUD endpoints are not yet exposed by backend. This panel is ready for integration.
          </Alert>
        </Stack>
      </Card>

      <Card>
        <CardHeader title="Email Configuration" subtitle="Validate SMTP delivery from backend" />
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
            {mutationError ? <Alert severity="error">{mutationError}</Alert> : null}
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
    </section>
  );
}

