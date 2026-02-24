import {
  AppBar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  BarChart3,
  Bell,
  Building2,
  ChartColumn,
  DollarSign,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Shield,
  SidebarClose,
  SidebarOpen,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { glassPanelSx } from "../app/theme";
import logoImage from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";
import { ReadOnlyBanner } from "../shared/components/RoleGuardWrapper";

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    subtitle: "Executive finance visibility across branches",
    icon: LayoutDashboard,
  },
  {
    to: "/branches",
    label: "Branches",
    subtitle: "Manage branch locations, active status, and alert recipients",
    icon: Building2,
  },
  {
    to: "/metrics",
    label: "Metrics",
    subtitle: "Track branch cash movement and operational balances",
    icon: ChartColumn,
  },
  {
    to: "/trends",
    label: "Trends",
    subtitle: "Cash movement, exposure, and alerts health analytics",
    icon: LineChart,
  },
  {
    to: "/reports",
    label: "Reports",
    subtitle: "Generate summary snapshots and export branch-level finance data",
    icon: BarChart3,
  },
  {
    to: "/expenses",
    label: "Expenses",
    subtitle: "Track expense lifecycle, balances, payments, and supporting documents",
    icon: DollarSign,
  },
  {
    to: "/alerts",
    label: "Alerts",
    subtitle: "Monitor notification reliability and rule outcomes across branches",
    icon: Bell,
  },
  {
    to: "/settings",
    label: "Settings",
    subtitle: "System settings, operational checks, and role visibility",
    icon: Settings,
  },
];

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 88;

function SidebarLinks({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <List sx={{ px: 1, py: 1.2 }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={onNavigate}
            sx={{
              mb: 0.7,
              minHeight: 44,
              borderRadius: 2.5,
              px: collapsed ? 1.2 : 1.6,
              justifyContent: collapsed ? "center" : "flex-start",
              color: "text.secondary",
              "&.active": {
                bgcolor: "primary.main",
                color: "primary.contrastText",
                boxShadow: "0 10px 20px rgba(12, 95, 63, 0.26)",
                "& .MuiListItemIcon-root": {
                  color: "primary.contrastText",
                },
              },
              "&:not(.active):hover": {
                bgcolor: "rgba(12, 95, 63, 0.11)",
                color: "text.primary",
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: collapsed ? 0 : 34,
                justifyContent: "center",
                color: "inherit",
              }}
            >
              <Icon size={18} />
            </ListItemIcon>
            {!collapsed ? (
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
              />
            ) : null}
          </ListItemButton>
        );
      })}
    </List>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const canWrite = user?.role === "FULL_ACCESS";
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSidebarCollapsed = collapsed && !isMobile;

  const drawerWidth = useMemo(
    () => (collapsed && !isMobile ? COLLAPSED_WIDTH : EXPANDED_WIDTH),
    [collapsed, isMobile],
  );
  const currentPage = useMemo(() => {
    if (location.pathname === "/") {
      return navItems[0];
    }
    return navItems.find((item) => item.to !== "/" && location.pathname.startsWith(item.to)) ?? navItems[0];
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebarContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: isSidebarCollapsed ? 1.2 : 2.2, py: 2.2 }}>
        <Stack direction="row" alignItems="center" justifyContent="center">
          <Box
            component="img"
            src={logoImage}
            alt="Omari Branch System"
            sx={{
              width: isSidebarCollapsed ? 72 : 112,
              height: "auto",
              borderRadius: 1.8,
              objectFit: "contain",
            }}
          />
        </Stack>
      </Box>
      <Divider />
      <SidebarLinks
        collapsed={isSidebarCollapsed}
        onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
      />
      <Box sx={{ mt: "auto" }}>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          {isSidebarCollapsed ? (
            <Tooltip title="Logout">
              <IconButton
                onClick={() => {
                  void handleLogout();
                }}
                sx={{ mb: 1, mx: "auto", display: "flex" }}
              >
                <LogOut size={18} />
              </IconButton>
            </Tooltip>
          ) : (
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LogOut size={16} />}
              onClick={() => {
                void handleLogout();
              }}
              sx={{ mb: 1 }}
            >
              Logout
            </Button>
          )}
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", textAlign: isSidebarCollapsed ? "center" : "left" }}
          >
          Finance Operations Platform
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ minHeight: "100vh", display: "flex" }}>
      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        PaperProps={{
          sx: {
            width: drawerWidth,
            overflowX: "hidden",
            ...glassPanelSx,
            borderRight: "1px solid rgba(255,255,255,0.56)",
            borderRadius: 0,
            transition: "width 0.2s ease",
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          ml: isMobile ? 0 : `${drawerWidth}px`,
          transition: "margin-left 0.2s ease",
        }}
      >
        <AppBar
          position="sticky"
          color="transparent"
          elevation={0}
          sx={{
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.6)",
            bgcolor: "rgba(255,255,255,0.8)",
          }}
        >
          <Toolbar sx={{ justifyContent: "space-between", gap: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {isMobile ? (
                <IconButton onClick={() => setMobileOpen(true)} aria-label="Open sidebar">
                  <Menu size={18} />
                </IconButton>
              ) : (
                <Tooltip title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
                  <IconButton onClick={() => setCollapsed((prev) => !prev)} aria-label="Toggle sidebar">
                    {collapsed ? <SidebarOpen size={18} /> : <SidebarClose size={18} />}
                  </IconButton>
                </Tooltip>
              )}
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={700} sx={{ fontSize: { xs: 17, sm: 20 }, lineHeight: 1.2 }}>
                  {currentPage.label}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: { xs: "none", md: "block" },
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: { md: 340, lg: 520 },
                  }}
                >
                  {currentPage.subtitle}
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              {!canWrite ? (
                <Chip
                  icon={<Shield size={14} />}
                  label="VIEWER"
                  size="small"
                  variant="outlined"
                />
              ) : (
                <Chip
                  icon={<Shield size={14} />}
                  label="FULL_ACCESS"
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              )}
              <Chip label={user?.username ?? "unknown"} size="small" />
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, sm: 3 }, minHeight: "calc(100vh - 64px)" }}>
          <Stack spacing={3}>
            <ReadOnlyBanner canWrite={canWrite} />
            <Outlet />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
