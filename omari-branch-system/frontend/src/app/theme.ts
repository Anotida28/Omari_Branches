import { alpha, createTheme } from "@mui/material/styles";

const primaryGreen = "#0c5f3f";
const primaryGreenDark = "#0a4a31";
const primaryGreenLight = "#2f8c68";
const softHighlight = "#e6f4ed";
const neutralBg = "#102017";
const neutralSurface = "#f3f7f4";

export const chartPalette = {
  primary: "#1b7f57",
  secondary: "#37a170",
  tertiary: "#73c394",
  warning: "#c98b2c",
  danger: "#c44b45",
  mutedGrid: "#d9e4dc",
};

export const glassPanelSx = {
  backdropFilter: "blur(14px)",
  backgroundColor: "rgba(255, 255, 255, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.58)",
  boxShadow: "0 10px 28px rgba(10, 36, 22, 0.08)",
};

export const omariTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: primaryGreen,
      dark: primaryGreenDark,
      light: primaryGreenLight,
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#4d5f54",
    },
    success: {
      main: "#1e8b5f",
      light: "#d8f0e5",
      dark: "#0f6a45",
    },
    warning: {
      main: "#b88424",
      light: "#f4e8cd",
      dark: "#875f13",
    },
    error: {
      main: "#c44b45",
      light: "#f8dfde",
      dark: "#98332f",
    },
    background: {
      default: neutralSurface,
      paper: "#ffffff",
    },
    text: {
      primary: neutralBg,
      secondary: "#5b6b62",
    },
    divider: alpha("#1f3328", 0.12),
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    fontFamily: `"Manrope", "Segoe UI", "Arial", sans-serif`,
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h6: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    subtitle1: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: "100vh",
          background:
            "radial-gradient(1200px 620px at -12% -20%, rgba(43, 132, 91, 0.16), transparent 55%), radial-gradient(1000px 560px at 120% -20%, rgba(154, 201, 175, 0.24), transparent 52%), linear-gradient(180deg, #f6fbf7 0%, #eef5f0 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: "box-shadow 180ms ease, border-color 180ms ease, transform 180ms ease",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          paddingTop: 10,
          paddingBottom: 10,
        },
        head: {
          fontWeight: 700,
          color: "#4f6056",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          fontSize: "0.72rem",
          backgroundColor: alpha("#f4f8f5", 0.82),
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: "background-color 150ms ease",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingInline: 14,
          transition: "background-color 140ms ease, border-color 140ms ease, color 140ms ease",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        outlined: {
          borderColor: alpha(primaryGreen, 0.2),
          backgroundColor: alpha(primaryGreen, 0.04),
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: "none",
          border: "1px solid rgba(255,255,255,0.62)",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#ffffff", 0.92),
          transition: "border-color 140ms ease, box-shadow 140ms ease",
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: {
          color: primaryGreen,
        },
      },
    },
  },
});
