import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  DollarSign,
  FileText,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  Box,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";

import { chartPalette, glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import { fetchDashboardOverview } from "../services/dashboard";
import { formatCurrency } from "../services/format";
import { fetchTrendsData } from "../services/trends";
import { ErrorState } from "../shared/components/ErrorState";
import { RankingList } from "../shared/components/RankingList";
import { StatCard } from "../shared/components/StatCard";

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const overviewQuery = useQuery({
    queryKey: ["dashboard", "overview"],
    queryFn: fetchDashboardOverview,
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

  if (overviewQuery.isError) {
    return (
      <section className="space-y-5 motion-fade-up">
        <ErrorState message={getErrorMessage(overviewQuery.error)} />
      </section>
    );
  }

  const rankings = overviewQuery.data?.rankings;

  return (
    <section className="space-y-5 motion-fade-up">
      <Box
        className="motion-stagger"
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
        {overviewQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <Paper key={index} sx={{ p: 2.2, ...glassPanelSx }}>
              <Skeleton width={130} />
              <Skeleton width={90} height={36} />
              <Skeleton width={160} />
            </Paper>
          ))
        ) : overviewQuery.data ? (
          <>
            <StatCard
              label="Total Branches"
              value={String(overviewQuery.data.totalBranches)}
              icon={<Building2 size={20} />}
            />
            <StatCard
              label="Total Expenses"
              value={String(overviewQuery.data.totalExpenses)}
              icon={<FileText size={20} />}
            />
            <StatCard
              label="Overdue Expenses"
              value={String(overviewQuery.data.overdueExpenses)}
              icon={<AlertTriangle size={20} />}
            />
            <StatCard
              label="Outstanding Balance"
              value={formatCurrency(overviewQuery.data.totalOutstandingBalance)}
              icon={<DollarSign size={20} />}
            />
          </>
        ) : null}
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            lg: "minmax(0, 1.8fr) minmax(0, 1fr)",
          },
        }}
      >
        <Paper sx={{ p: 2.2, ...glassPanelSx }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.2 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              Performance Snapshot
            </Typography>
            <Chip size="small" icon={<TrendingUp size={14} />} label="30 days" color="success" />
          </Stack>
          {trendsQuery.isLoading ? (
            <Skeleton variant="rounded" height={280} />
          ) : trendsQuery.isError ? (
            <Alert severity="warning">{getErrorMessage(trendsQuery.error)}</Alert>
          ) : trendsQuery.data?.cashTrend.length ? (
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendsQuery.data.cashTrend}>
                  <defs>
                    <linearGradient id="cashArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartPalette.primary} stopOpacity={0.34} />
                      <stop offset="95%" stopColor={chartPalette.primary} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="cashOnBranch"
                    stroke={chartPalette.primary}
                    fill="url(#cashArea)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No trend data available for selected window.
            </Typography>
          )}
        </Paper>

        <Paper sx={{ p: 2.2, ...glassPanelSx }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Branch Performance Rankings
          </Typography>
          <Stack spacing={1.2}>
            <RankingList
              title="Best Performing Branches"
              kind="top"
              items={
                (rankings?.top ?? []).map((item) => ({
                  branchId: item.branchId,
                  branchName: item.branchName,
                  city: item.city,
                  score: item.performanceScore,
                  netCashValue: item.netCashValue,
                }))
              }
            />
            <RankingList
              title="Lowest Performing Branches"
              kind="bottom"
              items={
                (rankings?.bottom ?? []).map((item) => ({
                  branchId: item.branchId,
                  branchName: item.branchName,
                  city: item.city,
                  score: item.performanceScore,
                  netCashValue: item.netCashValue,
                }))
              }
            />
          </Stack>
        </Paper>
      </Box>
    </section>
  );
}
