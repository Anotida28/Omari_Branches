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
  ChevronDown,
  ChevronUp,
  DollarSign,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Shield,
  SidebarClose,
  SidebarOpen,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { glassPanelSx } from "../app/theme";
import logoImage from "../assets/logo.png";
import { useAuth } from "../hooks/useAuth";
import { ReadOnlyBanner } from "../shared/components/RoleGuardWrapper";

type NavItem = {
  to: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
};

type NavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

const remittanceCenterItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    subtitle: "Branch performance and reminder visibility",
    icon: LayoutDashboard,
  },
  {
    to: "/branches",
    label: "Branches",
    subtitle: "Manage branch locations, active status, and mapped agent lines",
    icon: Building2,
  },
  {
    to: "/metrics",
    label: "Metrics",
    subtitle: "Review imported branch cash movement and balances",
    icon: ChartColumn,
  },
  {
    to: "/trends",
    label: "Trends",
    subtitle: "Branch cash movement and reminder exposure analytics",
    icon: LineChart,
  },
  {
    to: "/reports",
    label: "Reports",
    subtitle: "Export branch performance and reminder summaries",
    icon: BarChart3,
  },
  {
    to: "/expenses",
    label: "Reminders",
    subtitle: "Manage reminder records and due dates",
    icon: DollarSign,
  },
  {
    to: "/alerts",
    label: "Reminder Logs",
    subtitle: "Review reminder delivery history and failures",
    icon: Bell,
  },
  {
    to: "/settings",
    label: "Settings",
    subtitle: "HQ reminder recipients, email tests, and system checks",
    icon: Settings,
  },
];

const navSections: NavSection[] = [
  {
    id: "remittance-center",
    label: "Remittance Center",
    icon: Building2,
    items: remittanceCenterItems,
  },
  {
    id: "wallet",
    label: "Wallet",
    icon: Wallet,
    items: [
      {
        to: "/wallet/overview",
        label: "Wallet Overview",
        subtitle: "Executive wallet and customer activity KPIs",
        icon: Wallet,
      },
    ],
  },
];

const navItems = navSections.flatMap((section) => section.items);

const EXPANDED_WIDTH = 280;
const COLLAPSED_WIDTH = 88;

function SidebarLinks({
  collapsed,
  expandedSections,
  onToggleSection,
  onNavigate,
}: {
  collapsed: boolean;
  expandedSections: Record<string, boolean>;
  onToggleSection: (sectionId: string) => void;
  onNavigate?: () => void;
}) {
  if (collapsed) {
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
                px: 1.2,
                justifyContent: "center",
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
                  minWidth: 0,
                  justifyContent: "center",
                  color: "inherit",
                }}
              >
                <Icon size={18} />
              </ListItemIcon>
            </ListItemButton>
          );
        })}
      </List>
    );
  }

  return (
    <List sx={{ px: 1, py: 1.2 }}>
      {navSections.map((section) => {
        const SectionIcon = section.icon;
        const isOpen = expandedSections[section.id] ?? false;
        const hasItems = section.items.length > 0;

        return (
          <Box key={section.id} sx={{ mb: 0.8 }}>
            <ListItemButton
              onClick={() => onToggleSection(section.id)}
              sx={{
                mb: 0.4,
                minHeight: 44,
                borderRadius: 2.5,
                px: 1.6,
                color: "text.secondary",
                "&:hover": {
                  bgcolor: "rgba(12, 95, 63, 0.11)",
                  color: "text.primary",
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 34,
                  justifyContent: "center",
                  color: "inherit",
                }}
              >
                <SectionIcon size={18} />
              </ListItemIcon>
              <ListItemText
                primary={section.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
              />
              {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </ListItemButton>

            {isOpen && hasItems
              ? section.items.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <ListItemButton
                      key={item.to}
                      component={NavLink}
                      to={item.to}
                      onClick={onNavigate}
                      sx={{
                        mb: 0.5,
                        ml: 1.2,
                        minHeight: 40,
                        borderRadius: 2,
                        px: 1.4,
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
                          minWidth: 30,
                          justifyContent: "center",
                          color: "inherit",
                        }}
                      >
                        <ItemIcon size={16} />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 13.5, fontWeight: 600 }}
                      />
                    </ListItemButton>
                  );
                })
              : null}

            {isOpen && !hasItems ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", ml: 7, mt: 0.2, mb: 0.6 }}
              >
                Wallet modules coming soon
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </List>
  );
}

export default function AppLayout() {
  const { user, canWrite, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    "remittance-center": true,
    wallet: false,
  });
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

  const handleToggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
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
        expandedSections={expandedSections}
        onToggleSection={handleToggleSection}
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
            Branch Performance & Reminders
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
                  label={user?.role ?? "FULL_ACCESS"}
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
