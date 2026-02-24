import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Bell, Building2, DollarSign, FileText, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Alert,
  Box,
  Button,
  Chip,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";

import { glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import { listAlertLogs } from "../services/alerts";
import { fetchDashboardStats } from "../services/dashboard";
import { formatCurrency } from "../services/format";
import { fetchTrendsData } from "../services/trends";
import { ErrorState } from "../shared/components/ErrorState";
import { PageHeader } from "../shared/components/PageHeader";
import { StatCard } from "../shared/components/StatCard";

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const statsQuery = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: fetchDashboardStats,
  });

  const alertsQuery = useQuery({
    queryKey: ["dashboard", "recent-alerts"],
    queryFn: () => listAlertLogs({ page: 1, pageSize: 6 }),
  });

  const trendsQuery = useQuery({
    queryKey: ["dashboard", "chart-snapshot"],
    queryFn: () => {
      const today = new Date();
      const from = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      return fetchTrendsData({
        dateFrom: toInputDate(from),
        dateTo: toInputDate(today),
      });
    },
  });

  if (statsQuery.isLoading) {
    return (
      <section className="space-y-4">
        <PageHeader title="Dashboard" subtitle="Enterprise finance and operations snapshot" />
        <Paper sx={{ p: 3, ...glassPanelSx }}>
          <Typography variant="body2" color="text.secondary">
            Loading dashboard...
          </Typography>
        </Paper>
      </section>
    );
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <section className="space-y-4">
        <PageHeader title="Dashboard" subtitle="Enterprise finance and operations snapshot" />
        <ErrorState message={getErrorMessage(statsQuery.error)} />
      </section>
    );
  }

  const stats = statsQuery.data;
  const quickLinks = [
    { label: "Manage Branches", to: "/branches" },
    { label: "Review Expenses", to: "/expenses" },
    { label: "Inspect Alerts", to: "/alerts" },
    { label: "View Trends", to: "/trends" },
  ];

  return (
    <section className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="High-level HQ finance snapshot across all branches"
        actions={
          <Stack direction="row" spacing={1}>
            <Button component={Link} to="/expenses" variant="contained" endIcon={<ArrowRight size={16} />}>
              Add Expense
            </Button>
            <Button component={Link} to="/alerts" variant="outlined">
              Alerts
            </Button>
          </Stack>
        }
      />

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        <StatCard
          label="Total Branches"
          value={String(stats.totalBranches)}
          icon={<Building2 size={20} />}
        />
        <StatCard
          label="Total Expenses"
          value={String(stats.totalExpenses)}
          icon={<FileText size={20} />}
        />
        <StatCard
          label="Overdue Expenses"
          value={String(stats.overdueExpenses)}
          icon={<AlertTriangle size={20} />}
        />
        <StatCard
          label="Outstanding Balance"
          value={formatCurrency(stats.totalOutstandingBalance)}
          icon={<DollarSign size={20} />}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 2fr) minmax(0, 1fr)",
          },
        }}
      >
        <Paper sx={{ p: 2.2, ...glassPanelSx }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Performance Snapshot
              </Typography>
              <Chip size="small" icon={<TrendingUp size={14} />} label="30 days" />
            </Stack>
            {trendsQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading chart...
              </Typography>
            ) : trendsQuery.isError ? (
              <Alert severity="warning">{getErrorMessage(trendsQuery.error)}</Alert>
            ) : trendsQuery.data?.cashTrend.length ? (
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendsQuery.data.cashTrend}>
                    <defs>
                      <linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#1f4e98" stopOpacity={0.36} />
                        <stop offset="95%" stopColor="#1f4e98" stopOpacity={0.04} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#d8e2f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="cashOnBranch" stroke="#1f4e98" fill="url(#cashArea)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No trend data available for selected window.
              </Typography>
            )}
        </Paper>

        <Stack spacing={2}>
          <Paper sx={{ p: 2.2, ...glassPanelSx }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Quick Links
            </Typography>
            <Stack spacing={0.8}>
              {quickLinks.map((item) => (
                <MuiLink
                  component={Link}
                  key={item.to}
                  to={item.to}
                  underline="none"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    p: 1.2,
                    borderRadius: 2,
                    color: "text.primary",
                    bgcolor: "rgba(255,255,255,0.72)",
                    "&:hover": {
                      bgcolor: "rgba(31, 78, 152, 0.1)",
                    },
                  }}
                >
                  <span>{item.label}</span>
                  <ArrowRight size={14} />
                </MuiLink>
              ))}
            </Stack>
          </Paper>

          <Paper sx={{ p: 2.2, ...glassPanelSx }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Bell size={16} />
              <Typography variant="subtitle1" fontWeight={700}>
                Recent Alerts
              </Typography>
            </Stack>
            {alertsQuery.isLoading ? (
              <Typography variant="body2" color="text.secondary">
                Loading recent activity...
              </Typography>
            ) : alertsQuery.isError ? (
              <Alert severity="warning">{getErrorMessage(alertsQuery.error)}</Alert>
            ) : (alertsQuery.data?.items.length ?? 0) === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No recent alerts found.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {alertsQuery.data?.items.slice(0, 5).map((item) => (
                  <Box key={item.id} sx={{ p: 1, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.7)" }}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.branch.displayName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.rule.description}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Stack>
      </Box>
    </section>
  );
}
