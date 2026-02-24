import { FormEvent, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { glassPanelSx } from "../app/theme";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from =
    typeof (location.state as { from?: unknown } | null)?.from === "string"
      ? ((location.state as { from: string }).from || "/")
      : "/";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
      }}
    >
      <Paper sx={{ width: "100%", maxWidth: 430, p: 3, ...glassPanelSx }}>
        <Stack direction="row" alignItems="center" spacing={1.3} sx={{ mb: 2.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "inline-flex",
            }}
          >
            <LockKeyhole size={16} />
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Omari Branch System
            </Typography>
            <Typography variant="h6">Sign in</Typography>
          </Box>
        </Stack>

        <form onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              id="username"
              label="Username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              size="small"
              placeholder="admin"
            />

            <TextField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              size="small"
              placeholder="Enter password"
            />

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
