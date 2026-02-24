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
          "radial-gradient(1200px 560px at -15% -22%, rgba(78, 105, 93, 0.3), transparent 55%), radial-gradient(900px 500px at 110% 10%, rgba(164, 178, 170, 0.45), transparent 60%), linear-gradient(180deg, #c4cbc6 0%, #aeb7b1 100%)",
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
            borderRadius: 4,
            bgcolor: "rgba(255,255,255,0.2)",
            transform: "rotate(-14deg)",
          },
          "&::before": {
            width: 184,
            height: 184,
            top: 28,
            left: { xs: 4, md: 36 },
          },
          "&::after": {
            width: 146,
            height: 146,
            right: { xs: 8, md: 50 },
            bottom: 34,
          },
        }}
      />

      <Paper
        className="motion-fade-up"
        sx={{
          width: "100%",
          maxWidth: 1160,
          mx: "auto",
          borderRadius: { xs: 4, md: 5.5 },
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.62)",
          boxShadow: "0 30px 60px rgba(18, 39, 23, 0.14)",
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: "minmax(430px, 1fr) minmax(420px, 1fr)",
          },
          "@keyframes login-card-rise": {
            from: { opacity: 0, transform: "translateY(10px)" },
            to: { opacity: 1, transform: "translateY(0)" },
          },
          animation: "login-card-rise 420ms ease-out both",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Box
          sx={{
            px: { xs: 2.8, sm: 4.6, md: 5.2 },
            py: { xs: 3.2, md: 4.4 },
            bgcolor: "rgba(255, 255, 255, 0.96)",
            display: "flex",
            flexDirection: "column",
            minHeight: { md: 660 },
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: { xs: 4, md: 5.2 },
            }}
          >
            <Box sx={{ width: "100%", maxWidth: 460 }}>
              <Box sx={{ mb: 3.2, textAlign: "center" }}>
                <Box
                  component="img"
                  src={logoImage}
                  alt="Omari Branch System"
                  sx={{
                    height: { xs: 64, md: 78 },
                    width: "auto",
                    maxWidth: "100%",
                    display: "inline-block",
                  }}
                />
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontSize: { xs: 15, md: 16 } }}>
                  Sign in to continue managing branch operations.
                </Typography>
              </Box>

              <form onSubmit={onSubmit} noValidate>
                <Stack spacing={2.1} className="motion-stagger">
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.7 }}>
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
                          bgcolor: "rgba(243, 247, 244, 0.94)",
                          borderRadius: 2.2,
                          "& input": {
                            py: 1.6,
                          },
                          "& fieldset": { borderColor: "rgba(0,0,0,0)" },
                          "&:hover fieldset": { borderColor: "#b9c8be" },
                          "&.Mui-focused fieldset": { borderColor: "#2f8c68" },
                        },
                      }}
                    />
                  </Box>

                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.7 }}>
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
                          bgcolor: "rgba(243, 247, 244, 0.94)",
                          borderRadius: 2.2,
                          "& input": {
                            py: 1.6,
                          },
                          "& fieldset": { borderColor: "rgba(0,0,0,0)" },
                          "&:hover fieldset": { borderColor: "#b9c8be" },
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
                      mt: 0.6,
                      py: 1.45,
                      fontSize: "1rem",
                      bgcolor: "#0c5f3f",
                      borderRadius: 2.3,
                      boxShadow: "0 10px 22px rgba(12, 95, 63, 0.24)",
                      "&:hover": { bgcolor: "#0a4a31", boxShadow: "0 12px 24px rgba(10, 74, 49, 0.28)" },
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
            minHeight: 660,
            overflow: "hidden",
          }}
        >
          <Box
            component="img"
            src={loginHero}
            alt=""
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scale(1.05)",
              "@keyframes hero-drift": {
                from: { transform: "scale(1.05) translate(0, 0)" },
                to: { transform: "scale(1.1) translate(-10px, 8px)" },
              },
              animation: "hero-drift 16s ease-in-out infinite alternate",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(25, 46, 34, 0.2) 0%, rgba(10, 16, 12, 0.58) 100%)",
            }}
          />
          <Paper
            sx={{
              position: "absolute",
              left: 36,
              right: 36,
              bottom: 34,
              p: 2.7,
              borderRadius: 3,
              bgcolor: "rgba(248, 250, 248, 0.2)",
              border: "1px solid rgba(255,255,255,0.38)",
              backdropFilter: "blur(10px)",
              color: "white",
            }}
          >
            <Typography variant="h6" sx={{ mb: 1, color: "inherit", maxWidth: 360 }}>
              Real-time branch visibility starts with one secure login.
            </Typography>
          </Paper>
        </Box>
      </Paper>
    </Box>
  );
}
