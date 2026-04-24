import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  DollarSign,
  Activity,
  FileText,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
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
import { FocusDialog } from "../shared/components/FocusDialog";
import { RankingList } from "../shared/components/RankingList";
import { StatCard } from "../shared/components/StatCard";

type PerformanceTooltipProps = {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: Record<string, unknown> }>;
  label?: string;
};

function PerformanceTooltip({ active, payload, label }: PerformanceTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload as
    | {
        eFloatBalance?: number;
        cashInVolume?: number;
        cashOutVolume?: number;
        totalTransactionVolume?: number;
        cashInValue?: number;
        cashOutValue?: number;
        totalTransactionValue?: number;
        totalCommission?: number;
        netCashValue?: number;
      }
    | undefined;

  return (
    <Paper sx={{ p: 1.5, border: "1px solid rgba(15, 23, 42, 0.12)" }}>
      <Stack spacing={0.4}>
        <Typography variant="subtitle2" fontWeight={700}>
          {label}
        </Typography>
        <Typography variant="body2">E-Float: {formatCurrency(row?.eFloatBalance ?? 0)}</Typography>
        <Typography variant="body2">Cash In Value: {formatCurrency(row?.cashInValue ?? 0)}</Typography>
        <Typography variant="body2">Cash Out Value: {formatCurrency(row?.cashOutValue ?? 0)}</Typography>
        <Typography variant="body2">Txn Value: {formatCurrency(row?.totalTransactionValue ?? 0)}</Typography>
        <Typography variant="body2">Commission: {formatCurrency(row?.totalCommission ?? 0)}</Typography>
        <Typography variant="body2">Net Cash: {formatCurrency(row?.netCashValue ?? 0)}</Typography>
        <Typography variant="body2">
          Volumes: {row?.cashInVolume ?? 0} in / {row?.cashOutVolume ?? 0} out / {row?.totalTransactionVolume ?? 0} total
        </Typography>
      </Stack>
    </Paper>
  );
}

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type ChartMode = "line" | "bar";

function ChartModeToggle({
  mode,
  onChange,
}: {
  mode: ChartMode;
  onChange: (mode: ChartMode) => void;
}) {
  return (
    <ButtonGroup size="small" variant="outlined" aria-label="Chart type toggle">
      <Button variant={mode === "line" ? "contained" : "outlined"} onClick={() => onChange("line")}>
        Line
      </Button>
      <Button variant={mode === "bar" ? "contained" : "outlined"} onClick={() => onChange("bar")}>
        Bar
      </Button>
    </ButtonGroup>
  );
}

export default function DashboardPage() {
  const [performanceExpanded, setPerformanceExpanded] = useState(false);
  const [performanceMode, setPerformanceMode] = useState<ChartMode>("line");
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

  const leaders = overviewQuery.data?.leaders;

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
              label="Total Reminders"
              value={String(overviewQuery.data.totalExpenses)}
              icon={<FileText size={20} />}
            />
            <StatCard
              label="Reminder Amount"
              value={formatCurrency(overviewQuery.data.totalReminderAmount)}
              icon={<DollarSign size={20} />}
            />
            <StatCard
              label="Latest Total E-Float"
              value={formatCurrency(overviewQuery.data.latestTotalEFloat)}
              hint={overviewQuery.data.latestMetricDate ?? "No metric snapshot yet"}
              icon={<Wallet size={20} />}
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip size="small" icon={<TrendingUp size={14} />} label="30 days" color="success" />
              <ChartModeToggle mode={performanceMode} onChange={setPerformanceMode} />
              <Button size="small" variant="outlined" onClick={() => setPerformanceExpanded(true)}>
                Expand
              </Button>
            </Stack>
          </Stack>
          {trendsQuery.data ? (
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                },
                mb: 1.5,
              }}
            >
              <Paper variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="caption" color="text.secondary">
                    Latest E-Float
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {formatCurrency(trendsQuery.data.kpis.latestTotalEFloat)}
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="caption" color="text.secondary">
                    Transaction Value
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {formatCurrency(trendsQuery.data.kpis.totalTransactionValue)}
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="caption" color="text.secondary">
                    Transaction Volume
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {trendsQuery.data.kpis.totalTransactionVolume.toLocaleString()}
                  </Typography>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="caption" color="text.secondary">
                    Commission
                  </Typography>
                  <Typography variant="subtitle1" fontWeight={700}>
                    {formatCurrency(trendsQuery.data.kpis.totalCommission)}
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          ) : null}
          {trendsQuery.isLoading ? (
            <Skeleton variant="rounded" height={280} />
          ) : trendsQuery.isError ? (
            <Alert severity="warning">{getErrorMessage(trendsQuery.error)}</Alert>
          ) : trendsQuery.data?.cashTrend.length ? (
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                {performanceMode === "line" ? (
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
                    <Tooltip content={<PerformanceTooltip />} />
                    <Area type="monotone" dataKey="eFloatBalance" stroke={chartPalette.primary} fill="url(#cashArea)" strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <BarChart data={trendsQuery.data.cashTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip content={<PerformanceTooltip />} />
                    <Bar dataKey="eFloatBalance" fill={chartPalette.primary} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No trend data available for selected window.
            </Typography>
          )}
          {trendsQuery.data?.cashTrend.length ? (
            <>
              <Divider sx={{ my: 1.5 }} />
              <Box
                sx={{
                  display: "grid",
                  gap: 1,
                  gridTemplateColumns: {
                    xs: "1fr",
                    md: "repeat(2, minmax(0, 1fr))",
                  },
                }}
              >
                {trendsQuery.data.cashTrend.slice(-4).map((point) => (
                  <Paper key={point.date} variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2" fontWeight={700}>
                          {point.date}
                        </Typography>
                        <Chip size="small" icon={<Activity size={12} />} label="daily snapshot" variant="outlined" />
                      </Stack>
                      <Typography variant="body2">E-Float: {formatCurrency(point.eFloatBalance)}</Typography>
                      <Typography variant="body2">Cash In: {formatCurrency(point.cashInValue)} across {point.cashInVolume} txns</Typography>
                      <Typography variant="body2">Cash Out: {formatCurrency(point.cashOutValue)} across {point.cashOutVolume} txns</Typography>
                      <Typography variant="body2">Txn Value: {formatCurrency(point.totalTransactionValue)}</Typography>
                      <Typography variant="body2">Commission: {formatCurrency(point.totalCommission)}</Typography>
                      <Typography variant="body2">Net Cash: {formatCurrency(point.netCashValue)}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </>
          ) : null}
        </Paper>

        {trendsQuery.data ? (
          <FocusDialog
            open={performanceExpanded}
            onClose={() => setPerformanceExpanded(false)}
            title="Performance Snapshot"
            subtitle="Expanded analytics view with more room for the chart and daily breakdown."
          >
            <Stack spacing={2}>
              <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
                <StatCard label="Latest E-Float" value={formatCurrency(trendsQuery.data.kpis.latestTotalEFloat)} />
                <StatCard label="Transaction Value" value={formatCurrency(trendsQuery.data.kpis.totalTransactionValue)} />
                <StatCard label="Transaction Volume" value={trendsQuery.data.kpis.totalTransactionVolume.toLocaleString()} />
                <StatCard label="Commission" value={formatCurrency(trendsQuery.data.kpis.totalCommission)} />
              </Box>

              <Paper sx={{ p: 2, ...glassPanelSx }}>
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                  <ChartModeToggle mode={performanceMode} onChange={setPerformanceMode} />
                </Stack>
                <Box sx={{ height: "62vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {performanceMode === "line" ? (
                      <AreaChart data={trendsQuery.data.cashTrend}>
                        <defs>
                          <linearGradient id="cashAreaExpand" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={chartPalette.primary} stopOpacity={0.34} />
                            <stop offset="95%" stopColor={chartPalette.primary} stopOpacity={0.04} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<PerformanceTooltip />} />
                        <Area type="monotone" dataKey="eFloatBalance" stroke={chartPalette.primary} fill="url(#cashAreaExpand)" strokeWidth={2} />
                      </AreaChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip content={<PerformanceTooltip />} />
                        <Bar dataKey="eFloatBalance" fill={chartPalette.primary} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              </Paper>

              <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
                {trendsQuery.data.cashTrend.slice(-8).map((point) => (
                  <Paper key={point.date} variant="outlined" sx={{ p: 1.4 }}>
                    <Stack spacing={0.4}>
                      <Typography variant="subtitle2" fontWeight={700}>{point.date}</Typography>
                      <Typography variant="body2">E-Float: {formatCurrency(point.eFloatBalance)}</Typography>
                      <Typography variant="body2">Cash In: {formatCurrency(point.cashInValue)} | Cash Out: {formatCurrency(point.cashOutValue)}</Typography>
                      <Typography variant="body2">Txn Value: {formatCurrency(point.totalTransactionValue)} | Commission: {formatCurrency(point.totalCommission)}</Typography>
                      <Typography variant="body2">Net Cash: {formatCurrency(point.netCashValue)}</Typography>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Stack>
          </FocusDialog>
        ) : null}

        <Paper sx={{ p: 2.2, ...glassPanelSx }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Branch Leaders
          </Typography>
          <Stack spacing={1.2}>
            <RankingList
              title="Highest E-Float Branches"
              metricLabel="Latest e-float"
              secondaryLabel="Window txn value"
              items={
                (leaders?.byEFloat ?? []).map((item) => ({
                  branchId: item.branchId,
                  branchName: item.branchName,
                  city: item.city,
                  metricValue: item.metricValue,
                  secondaryValue: item.secondaryValue,
                }))
              }
            />
            <RankingList
              title="Highest Commission Branches"
              metricLabel="Window commission"
              secondaryLabel="Window txn value"
              items={
                (leaders?.byCommission ?? []).map((item) => ({
                  branchId: item.branchId,
                  branchName: item.branchName,
                  city: item.city,
                  metricValue: item.metricValue,
                  secondaryValue: item.secondaryValue,
                }))
              }
            />
          </Stack>
        </Paper>
      </Box>
    </section>
  );
}
