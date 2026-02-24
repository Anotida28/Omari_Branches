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
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { glassPanelSx } from "../app/theme";
import { useAuth } from "../hooks/useAuth";
import { ReadOnlyBanner } from "../shared/components/RoleGuardWrapper";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/branches", label: "Branches", icon: Building2 },
  { to: "/metrics", label: "Metrics", icon: ChartColumn },
  { to: "/trends", label: "Trends", icon: LineChart },
  { to: "/expenses", label: "Expenses", icon: DollarSign },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/settings", label: "Settings", icon: Settings },
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
  const theme = useTheme();

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
                boxShadow: "0 10px 20px rgba(31, 78, 152, 0.26)",
                "& .MuiListItemIcon-root": {
                  color: "primary.contrastText",
                },
              },
              "&:not(.active):hover": {
                bgcolor: "rgba(31, 78, 152, 0.12)",
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
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerWidth = useMemo(
    () => (collapsed && !isMobile ? COLLAPSED_WIDTH : EXPANDED_WIDTH),
    [collapsed, isMobile],
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const sidebarContent = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: collapsed && !isMobile ? 1.2 : 2.2, py: 2.2 }}>
        <Stack direction="row" alignItems="center" spacing={1.4} justifyContent={collapsed ? "center" : "flex-start"}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2.2,
              bgcolor: "primary.main",
              color: "primary.contrastText",
              display: "inline-flex",
            }}
          >
            <DollarSign size={18} />
          </Box>
          {!collapsed || isMobile ? (
            <Box>
              <Typography variant="overline" sx={{ color: "text.secondary", fontWeight: 700 }}>
                Omari HQ
              </Typography>
              <Typography variant="subtitle1" sx={{ lineHeight: 1.2 }}>
                Branch System
              </Typography>
            </Box>
          ) : null}
        </Stack>
      </Box>
      <Divider />
      <SidebarLinks
        collapsed={collapsed && !isMobile}
        onNavigate={isMobile ? () => setMobileOpen(false) : undefined}
      />
      <Box sx={{ mt: "auto", p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Finance Operations Platform
        </Typography>
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
            borderRight: "1px solid rgba(255,255,255,0.4)",
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
            borderBottom: "1px solid rgba(255,255,255,0.45)",
            bgcolor: "rgba(255,255,255,0.76)",
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
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Omari Branch Management
              </Typography>
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
              {canWrite ? (
                <Button variant="outlined" size="small" onClick={() => navigate("/alerts")}>
                  Alerts
                </Button>
              ) : null}
              <Button
                variant="text"
                color="secondary"
                startIcon={<LogOut size={16} />}
                onClick={() => {
                  void handleLogout();
                }}
              >
                Logout
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        <Box component="main" sx={{ p: { xs: 2, sm: 3 }, minHeight: "calc(100vh - 64px)" }}>
          <Stack spacing={2.5}>
            <ReadOnlyBanner canWrite={canWrite} />
            <Outlet />
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
