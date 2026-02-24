import { alpha, createTheme } from "@mui/material/styles";

const primaryBlue = "#1f4e98";
const primaryBlueDark = "#163f7d";
const neutralBg = "#0b1220";
const neutralSurface = "#f7f9fc";

export const glassPanelSx = {
  backdropFilter: "blur(12px)",
  backgroundColor: "rgba(255, 255, 255, 0.78)",
  border: "1px solid rgba(255, 255, 255, 0.45)",
  boxShadow: "0 10px 26px rgba(15, 23, 42, 0.08)",
};

export const omariTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: primaryBlue,
      dark: primaryBlueDark,
      light: "#3f6db2",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#475569",
    },
    background: {
      default: neutralSurface,
      paper: "#ffffff",
    },
    text: {
      primary: neutralBg,
      secondary: "#556070",
    },
    divider: alpha("#0f172a", 0.12),
  },
  shape: {
    borderRadius: 14,
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
            "radial-gradient(1200px 600px at -10% -15%, rgba(31, 78, 152, 0.16), transparent 55%), radial-gradient(1100px 600px at 120% -20%, rgba(56, 189, 248, 0.15), transparent 50%), linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: "#455466",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          fontSize: "0.72rem",
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
        },
      },
    },
  },
});

