import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useState } from "react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import loginHero from "../assets/login-hero.jpg";
import logoImage from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";

type FieldErrors = {
  username: string;
  password: string;
};

const INITIAL_FIELD_ERRORS: FieldErrors = {
  username: "",
  password: "",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(INITIAL_FIELD_ERRORS);
  const [authError, setAuthError] = useState("");
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from =
    typeof (location.state as { from?: unknown } | null)?.from === "string"
      ? ((location.state as { from: string }).from || "/")
      : "/";

  const updateCapsLockState = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState("CapsLock"));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextFieldErrors: FieldErrors = {
      username: "",
      password: "",
    };

    if (!username.trim()) {
      nextFieldErrors.username = "Username is required.";
    }
    if (!password) {
      nextFieldErrors.password = "Password is required.";
    }

    setFieldErrors(nextFieldErrors);
    setAuthError("");

    if (nextFieldErrors.username || nextFieldErrors.password) {
      return;
    }

    setIsSubmitting(true);

    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (submitError) {
      if (axios.isAxiosError(submitError)) {
        if (!submitError.response) {
          setAuthError(
            "Network error: unable to reach the server. Check your connection and try again.",
          );
        } else if (submitError.response.status === 401) {
          setAuthError("Invalid username or password.");
        } else if (submitError.response.status >= 500) {
          setAuthError("Server error while signing in. Please try again shortly.");
        } else {
          setAuthError(getErrorMessage(submitError));
        }
      } else {
        setAuthError(getErrorMessage(submitError));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        px: { xs: 2, md: 4 },
        py: { xs: 3, md: 4 },
        position: "relative",
        background:
          "radial-gradient(1200px 560px at -15% -22%, rgba(32, 130, 90, 0.22), transparent 55%), radial-gradient(900px 460px at 110% 10%, rgba(171, 208, 187, 0.42), transparent 60%), linear-gradient(180deg, #d8eadf 0%, #cae0d2 100%)",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          "&::before, &::after": {
            content: '""',
            position: "absolute",
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.22)",
            transform: "rotate(-14deg)",
          },
          "&::before": {
            width: 170,
            height: 170,
            top: 30,
            left: { xs: 8, md: 40 },
          },
          "&::after": {
            width: 130,
            height: 130,
            right: { xs: 10, md: 56 },
            bottom: 40,
          },
        }}
      />

      <Paper
        sx={{
          width: "100%",
          maxWidth: 1120,
          mx: "auto",
          borderRadius: { xs: 4, md: 5 },
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.6)",
          boxShadow: "0 25px 50px rgba(18, 39, 23, 0.12)",
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(380px, 0.95fr) minmax(420px, 1.05fr)",
          },
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            px: { xs: 2.6, sm: 4 },
            py: { xs: 3, md: 4 },
            bgcolor: "rgba(255, 255, 255, 0.96)",
            display: "flex",
            flexDirection: "column",
            minHeight: { md: 640 },
          }}
        >
          <Stack direction="row" alignItems="center">
            <Box
              component="img"
              src={logoImage}
              alt="Omari Branch System"
              sx={{ height: 44, width: "auto" }}
            />
          </Stack>

          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: { xs: 4, md: 5 },
            }}
          >
            <Box sx={{ width: "100%", maxWidth: 440 }}>
              <Box sx={{ mb: 3.2, textAlign: "center" }}>
                <Typography variant="h4" sx={{ fontSize: { xs: "2rem", md: "2.35rem" } }}>
                  Welcome Back
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                  Sign in to continue managing branch operations.
                </Typography>
              </Box>

              <form onSubmit={onSubmit} noValidate>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.7 }}>
                      Username
                    </Typography>
                    <TextField
                      id="username"
                      type="text"
                      autoComplete="username"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        if (fieldErrors.username) {
                          setFieldErrors((prev) => ({ ...prev, username: "" }));
                        }
                        if (authError) {
                          setAuthError("");
                        }
                      }}
                      placeholder="e.g. admin"
                      fullWidth
                      error={Boolean(fieldErrors.username)}
                      helperText={fieldErrors.username || " "}
                      InputProps={{
                        sx: {
                          bgcolor: "#f3f5f6",
                          "& fieldset": { borderColor: "transparent" },
                          "&:hover fieldset": { borderColor: "#cad5cb" },
                          "&.Mui-focused fieldset": { borderColor: "#2f8c68" },
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.7 }}>
                      Password
                    </Typography>
                    <TextField
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: "" }));
                        }
                        if (authError) {
                          setAuthError("");
                        }
                      }}
                      onKeyUp={updateCapsLockState}
                      onKeyDown={updateCapsLockState}
                      onBlur={() => setCapsLockOn(false)}
                      placeholder="Enter your password"
                      fullWidth
                      error={Boolean(fieldErrors.password)}
                      helperText={fieldErrors.password || " "}
                      InputProps={{
                        sx: {
                          bgcolor: "#f3f5f6",
                          "& fieldset": { borderColor: "transparent" },
                          "&:hover fieldset": { borderColor: "#cad5cb" },
                          "&.Mui-focused fieldset": { borderColor: "#2f8c68" },
                        },
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              edge="end"
                              aria-label={showPassword ? "Hide password" : "Show password"}
                              onClick={() => setShowPassword((prev) => !prev)}
                              tabIndex={-1}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    {capsLockOn ? (
                      <Stack
                        direction="row"
                        spacing={0.6}
                        alignItems="center"
                        sx={{ mt: -0.3, mb: 0.4, color: "warning.main" }}
                      >
                        <AlertTriangle size={14} />
                        <Typography variant="caption">Caps Lock is on.</Typography>
                      </Stack>
                    ) : null}
                  </Box>

                  {authError ? (
                    <Alert severity="error" role="alert" aria-live="assertive">
                      {authError}
                    </Alert>
                  ) : null}

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={isSubmitting}
                    sx={{
                      mt: 0.8,
                      py: 1.35,
                      fontSize: "1rem",
                      bgcolor: "#0c5f3f",
                      "&:hover": { bgcolor: "#0a4a31" },
                    }}
                  >
                    {isSubmitting ? "Signing in..." : "Sign in"}
                  </Button>
                </Stack>
              </form>
            </Box>
          </Box>
        </Box>

        <Box
          sx={{
            display: { xs: "none", md: "block" },
            position: "relative",
            minHeight: 640,
            backgroundImage: `url(${loginHero})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(35,55,42,0.2) 0%, rgba(13,20,16,0.42) 100%)",
            }}
          />
          <Paper
            sx={{
              position: "absolute",
              left: 36,
              right: 36,
              bottom: 34,
              p: 2.6,
              borderRadius: 3,
              bgcolor: "rgba(248, 250, 248, 0.2)",
              border: "1px solid rgba(255,255,255,0.38)",
              backdropFilter: "blur(8px)",
              color: "white",
            }}
          >
            <Typography variant="h6" sx={{ mb: 1, color: "inherit", maxWidth: 360 }}>
              Real-time branch visibility starts with one secure login.
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(245, 250, 246, 0.9)", maxWidth: 360 }}>
              Track expenses, monitor balances, and keep every branch aligned from HQ.
            </Typography>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}
