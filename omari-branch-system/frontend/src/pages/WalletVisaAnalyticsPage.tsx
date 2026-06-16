import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CreditCard, DollarSign, Percent, TrendingUp, Users } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSearchParams } from "react-router-dom";

import { chartPalette, glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import { formatCurrency, formatDate } from "../services/format";
import { fetchWalletVisaAnalytics } from "../services/wallet";
import { ChartSkeleton } from "../shared/components/ChartSkeleton";
import { FilterBar } from "../shared/components/FilterBar";
import { FocusDialog } from "../shared/components/FocusDialog";
import { StatCard } from "../shared/components/StatCard";
import { StatCardSkeleton } from "../shared/components/StatCardSkeleton";

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
}

const presets = [
  {
    label: "Last 30",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -29)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "Last 60",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -59)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "Last 90",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -89)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "MTD",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(startOfMonth(today)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "QTD",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(startOfQuarter(today)), dateTo: toInputDate(today) };
    },
  },
];

type ChartMode = "line" | "bar";

function ChartModeToggle({ mode, onChange }: { mode: ChartMode; onChange: (mode: ChartMode) => void }) {
  return (
    <ButtonGroup size="small" variant="outlined" aria-label="Chart type toggle">
      <Button variant={mode === "line" ? "contained" : "outlined"} onClick={() => onChange("line")}>Line</Button>
      <Button variant={mode === "bar" ? "contained" : "outlined"} onClick={() => onChange("bar")}>Bar</Button>
    </ButtonGroup>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  onExpand,
  minHeight = 300,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onExpand?: () => void;
  minHeight?: number;
}) {
  return (
    <Paper sx={{ p: 2.2, ...glassPanelSx, minHeight }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ mb: 1.3 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Box>
        {onExpand ? <Button size="small" variant="outlined" onClick={onExpand}>Expand</Button> : null}
      </Stack>
      {children}
    </Paper>
  );
}

const TYPE_COLORS: Record<string, string> = {
  "VISA PreAuth": "#3b82f6",
  "VISA Purchase Completion": chartPalette.primary,
  "VISA Card Refund": chartPalette.warning,
  "VISA Withdrawal": chartPalette.danger,
};

function typeColor(type: string): string {
  return TYPE_COLORS[type] ?? chartPalette.tertiary;
}

type FocusedChart = "dailyVolume" | "monthlyTrend" | null;

export default function WalletVisaAnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<FocusedChart>(null);
  const [dailyMode, setDailyMode] = useState<ChartMode>("bar");
  const [monthlyMode, setMonthlyMode] = useState<ChartMode>("bar");

  const initialDateTo = toInputDate(new Date());
  const initialDateFrom = toInputDate(shiftDays(new Date(), -29));
  const dateFrom = searchParams.get("dateFrom") ?? initialDateFrom;
  const dateTo = searchParams.get("dateTo") ?? initialDateTo;

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) { next.delete(key); return; }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const visaQuery = useQuery({
    queryKey: ["wallet", "visa-analytics", { dateFrom, dateTo }],
    queryFn: () => fetchWalletVisaAnalytics({ dateFrom, dateTo, currency: "USD" }),
    staleTime: 5 * 60 * 1000,
  });

  const focusTitle = focusedChart === "dailyVolume" ? "Daily VISA Volume" : "Monthly VISA Trend";

  return (
    <section className="space-y-5 motion-fade-up">
      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} alignItems={{ xs: "stretch", lg: "center" }}>
          <Chip label="USD only" size="small" color="primary" variant="outlined" />
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap" }}>
            {presets.map((preset) => (
              <Button key={preset.label} onClick={() => updateParams(preset.getRange())}>{preset.label}</Button>
            ))}
          </ButtonGroup>
          <TextField
            type="date" label="Date From" value={dateFrom}
            onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />
          <TextField
            type="date" label="Date To" value={dateTo}
            onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }} sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />
          <Button variant="outlined" onClick={() => setSearchParams({}, { replace: true })} sx={{ width: { xs: "100%", lg: "auto" }, whiteSpace: "nowrap" }}>
            Reset Filters
          </Button>
        </Stack>
      </FilterBar>

      {visaQuery.isError ? <Alert severity="error">{getErrorMessage(visaQuery.error)}</Alert> : null}

      {visaQuery.isLoading ? (
        <Stack spacing={2}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" } }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={90} />
            ))}
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.5fr 1fr" } }}>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </Box>
        </Stack>
      ) : visaQuery.data ? (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
            <StatCard label="Total Transactions" value={formatCount(visaQuery.data.kpis.totalVolume)} icon={<CreditCard size={20} />} />
            <StatCard label="Total Value" value={formatCurrency(visaQuery.data.kpis.totalValue)} icon={<DollarSign size={20} />} />
            <StatCard label="Avg Transaction Value" value={formatCurrency(visaQuery.data.kpis.avgTransactionValue)} icon={<TrendingUp size={20} />} />
            <StatCard label="Total Commission" value={formatCurrency(visaQuery.data.kpis.totalCommission)} icon={<DollarSign size={20} />} />
            <StatCard label="Commission Rate" value={formatPercent(visaQuery.data.kpis.commissionRate)} icon={<Percent size={20} />} />
            <StatCard label="Unique VISA Customers" value={formatCount(visaQuery.data.kpis.uniqueCustomers)} icon={<Users size={20} />} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" } }}>
            {[
              { label: "Pre-Auth", value: visaQuery.data.kpis.preAuthVolume, color: TYPE_COLORS["VISA PreAuth"] },
              { label: "Purchases", value: visaQuery.data.kpis.purchaseVolume, color: TYPE_COLORS["VISA Purchase Completion"] },
              { label: "Refunds", value: visaQuery.data.kpis.refundVolume, color: TYPE_COLORS["VISA Card Refund"] },
              { label: "Withdrawals", value: visaQuery.data.kpis.withdrawalVolume, color: TYPE_COLORS["VISA Withdrawal"] },
            ].map((item) => (
              <Paper key={item.label} variant="outlined" sx={{ p: 1.6, borderLeft: `4px solid ${item.color}`, borderColor: `${item.color} !important` }}>
                <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                <Typography variant="h6" fontWeight={700}>{formatCount(item.value)}</Typography>
                <Typography variant="caption" color="text.secondary">transactions</Typography>
              </Paper>
            ))}
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.5fr 1fr" } }}>
            <ChartCard
              title="Daily Transaction Volume"
              subtitle="VISA transactions by type over the selected period"
              onExpand={() => setFocusedChart("dailyVolume")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={dailyMode} onChange={setDailyMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyMode === "bar" ? (
                    <BarChart data={visaQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatCount(Number(v))} />
                      <Legend />
                      <Bar dataKey="preAuthVolume" name="Pre-Auth" stackId="a" fill={TYPE_COLORS["VISA PreAuth"]} />
                      <Bar dataKey="purchaseVolume" name="Purchase" stackId="a" fill={TYPE_COLORS["VISA Purchase Completion"]} />
                      <Bar dataKey="refundVolume" name="Refund" stackId="a" fill={TYPE_COLORS["VISA Card Refund"]} />
                      <Bar dataKey="withdrawalVolume" name="Withdrawal" stackId="a" fill={TYPE_COLORS["VISA Withdrawal"]} />
                    </BarChart>
                  ) : (
                    <LineChart data={visaQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => formatCount(Number(v))} />
                      <Legend />
                      <Line type="monotone" dataKey="preAuthVolume" name="Pre-Auth" stroke={TYPE_COLORS["VISA PreAuth"]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="purchaseVolume" name="Purchase" stroke={TYPE_COLORS["VISA Purchase Completion"]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="refundVolume" name="Refund" stroke={TYPE_COLORS["VISA Card Refund"]} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="withdrawalVolume" name="Withdrawal" stroke={TYPE_COLORS["VISA Withdrawal"]} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard
              title="Transaction Type Breakdown"
              subtitle="Volume share and value by VISA transaction type"
            >
              <Table size="small" sx={{ mt: 1 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Type</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Volume</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Value</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, fontSize: 12 }}>Share</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visaQuery.data.typeBreakdown.map((row) => (
                    <TableRow key={row.transactionType} hover>
                      <TableCell sx={{ fontSize: 12 }}>
                        <Stack direction="row" alignItems="center" spacing={0.8}>
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: typeColor(row.transactionType), flexShrink: 0 }} />
                          <span>{row.transactionType.replace("VISA ", "")}</span>
                        </Stack>
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{formatCount(row.volume)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>{formatCurrency(row.totalValue)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 12 }}>
                        <Chip label={`${row.percentage}%`} size="small" variant="outlined" color={row.percentage > 40 ? "primary" : "default"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ChartCard>
          </Box>

          <ChartCard
            title="Monthly VISA Trend"
            subtitle="Monthly volume and total value trend"
            onExpand={() => setFocusedChart("monthlyTrend")}
          >
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ChartModeToggle mode={monthlyMode} onChange={setMonthlyMode} />
            </Stack>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                {monthlyMode === "bar" ? (
                  <ComposedChart data={visaQuery.data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v, name) => name === "Value" ? formatCurrency(Number(v)) : formatCount(Number(v))} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalVolume" name="Volume" fill={chartPalette.primary} />
                    <Line yAxisId="right" type="monotone" dataKey="totalValue" name="Value" stroke={chartPalette.warning} strokeWidth={2} />
                  </ComposedChart>
                ) : (
                  <LineChart data={visaQuery.data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    <Legend />
                    <Line type="monotone" dataKey="totalValue" name="Total Value" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="totalCommission" name="Commission" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Box>
          </ChartCard>

          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            {visaQuery.data.monthlyTrend.slice(-6).map((point) => (
              <Paper key={point.period} variant="outlined" sx={{ p: 1.4, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="subtitle2" fontWeight={700}>{point.period}</Typography>
                  <Typography variant="body2">Volume: {formatCount(point.totalVolume)}</Typography>
                  <Typography variant="body2">Value: {formatCurrency(point.totalValue)}</Typography>
                  <Typography variant="body2">Commission: {formatCurrency(point.totalCommission)}</Typography>
                  <Typography variant="body2" color="text.secondary">Customers: {formatCount(point.uniqueCustomers)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Box>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(visaQuery.data.period.dateFrom)} to {formatDate(visaQuery.data.period.dateTo)}.
            Freshness: {new Date(visaQuery.data.metadata.dataFreshnessTimestamp).toLocaleString("en-US")}.
            VISA transactions are USD only.
          </Alert>
        </>
      ) : null}

      {visaQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusTitle}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" } }}>
              <StatCard label="Total Volume" value={formatCount(visaQuery.data.kpis.totalVolume)} />
              <StatCard label="Total Value" value={formatCurrency(visaQuery.data.kpis.totalValue)} />
              <StatCard label="Commission Rate" value={formatPercent(visaQuery.data.kpis.commissionRate)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "dailyVolume" ? (
                <ChartModeToggle mode={dailyMode} onChange={setDailyMode} />
              ) : (
                <ChartModeToggle mode={monthlyMode} onChange={setMonthlyMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "dailyVolume" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {dailyMode === "bar" ? (
                      <BarChart data={visaQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatCount(Number(v))} />
                        <Legend />
                        <Bar dataKey="preAuthVolume" name="Pre-Auth" stackId="a" fill={TYPE_COLORS["VISA PreAuth"]} />
                        <Bar dataKey="purchaseVolume" name="Purchase" stackId="a" fill={TYPE_COLORS["VISA Purchase Completion"]} />
                        <Bar dataKey="refundVolume" name="Refund" stackId="a" fill={TYPE_COLORS["VISA Card Refund"]} />
                        <Bar dataKey="withdrawalVolume" name="Withdrawal" stackId="a" fill={TYPE_COLORS["VISA Withdrawal"]} />
                      </BarChart>
                    ) : (
                      <LineChart data={visaQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatCount(Number(v))} />
                        <Legend />
                        <Line type="monotone" dataKey="preAuthVolume" name="Pre-Auth" stroke={TYPE_COLORS["VISA PreAuth"]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="purchaseVolume" name="Purchase" stroke={TYPE_COLORS["VISA Purchase Completion"]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="refundVolume" name="Refund" stroke={TYPE_COLORS["VISA Card Refund"]} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="withdrawalVolume" name="Withdrawal" stroke={TYPE_COLORS["VISA Withdrawal"]} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {monthlyMode === "bar" ? (
                      <ComposedChart data={visaQuery.data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, name) => name === "Value" ? formatCurrency(Number(v)) : formatCount(Number(v))} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalVolume" name="Volume" fill={chartPalette.primary} />
                        <Line yAxisId="right" type="monotone" dataKey="totalValue" name="Value" stroke={chartPalette.warning} strokeWidth={2} />
                      </ComposedChart>
                    ) : (
                      <LineChart data={visaQuery.data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Legend />
                        <Line type="monotone" dataKey="totalValue" name="Total Value" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="totalCommission" name="Commission" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Monthly detail</Typography>
              {visaQuery.data.monthlyTrend.slice(-6).map((point) => (
                <Paper key={point.period} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{point.period}</Typography>
                    <Typography variant="body2">
                      Volume {formatCount(point.totalVolume)} | Value {formatCurrency(point.totalValue)} | Commission {formatCurrency(point.totalCommission)}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        </FocusDialog>
      ) : null}
    </section>
  );
}
