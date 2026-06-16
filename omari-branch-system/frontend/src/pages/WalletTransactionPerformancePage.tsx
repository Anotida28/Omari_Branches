import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, CalendarClock, Gauge, TrendingUp, Users } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
  Cell,
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
import { fetchWalletTransactionPerformance } from "../services/wallet";
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
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
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

export default function WalletTransactionPerformancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<"dailyValue" | "dailyVolume" | "monthlyProd" | null>(null);
  const [dailyValueMode, setDailyValueMode] = useState<ChartMode>("line");
  const [dailyVolumeMode, setDailyVolumeMode] = useState<ChartMode>("bar");
  const [monthlyProdMode, setMonthlyProdMode] = useState<ChartMode>("bar");

  const initialDateTo = toInputDate(new Date());
  const initialDateFrom = toInputDate(shiftDays(new Date(), -29));
  const dateFrom = searchParams.get("dateFrom") ?? initialDateFrom;
  const dateTo = searchParams.get("dateTo") ?? initialDateTo;
  const currency = (searchParams.get("currency") ?? "USD") as "USD" | "ZWL";
  const useCase = searchParams.get("useCase") ?? "";

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) { next.delete(key); return; }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const performanceQuery = useQuery({
    queryKey: ["wallet", "transaction-performance", { dateFrom, dateTo, currency, useCase }],
    queryFn: () => fetchWalletTransactionPerformance({ dateFrom, dateTo, currency, useCase: useCase || undefined }),
    staleTime: 5 * 60 * 1000,
  });

  const focusTitle =
    focusedChart === "dailyValue" ? "Daily Value Trend"
    : focusedChart === "dailyVolume" ? "Daily Volume Mix"
    : "Monthly Productivity";

  return (
    <section className="space-y-5 motion-fade-up">
      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} alignItems={{ xs: "stretch", lg: "center" }}>
          <ButtonGroup size="small" variant="outlined">
            {(["USD", "ZWL"] as const).map((c) => (
              <Button key={c} variant={currency === c ? "contained" : "outlined"} onClick={() => updateParams({ currency: c })}>{c}</Button>
            ))}
          </ButtonGroup>
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap" }}>
            {presets.map((preset) => (
              <Button key={preset.label} onClick={() => updateParams(preset.getRange())}>{preset.label}</Button>
            ))}
          </ButtonGroup>
          <FormControl size="small" sx={{ minWidth: { xs: "100%", lg: 200 } }}>
            <InputLabel>Use Case</InputLabel>
            <Select
              label="Use Case"
              value={useCase}
              onChange={(e) => updateParams({ useCase: e.target.value || undefined })}
            >
              <MenuItem value="">All Transactions</MenuItem>
              {(performanceQuery.data?.availableUseCases ?? []).map((uc) => (
                <MenuItem key={uc} value={uc}>{uc}</MenuItem>
              ))}
            </Select>
          </FormControl>
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

      {performanceQuery.isError ? <Alert severity="error">{getErrorMessage(performanceQuery.error)}</Alert> : null}

      {performanceQuery.isLoading ? (
        <Stack spacing={2}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </Box>
          <ChartSkeleton height={260} />
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.35fr 1fr" } }}>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </Box>
        </Stack>
      ) : performanceQuery.data ? (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" } }}>
            <StatCard label="Deposit Value" value={formatCurrency(performanceQuery.data.kpis.depositValue)} icon={<TrendingUp size={20} />} />
            <StatCard label="Withdrawal Value" value={formatCurrency(performanceQuery.data.kpis.withdrawalValue)} icon={<ArrowDownUp size={20} />} />
            <StatCard label="Net Flow" value={formatCurrency(performanceQuery.data.kpis.netFlowValue)} icon={<Gauge size={20} />} />
            <StatCard label="Active Customers" value={formatCount(performanceQuery.data.kpis.activeCustomers)} icon={<Users size={20} />} />
            <StatCard label="Value per Active Customer" value={formatCurrency(performanceQuery.data.kpis.valuePerActiveCustomer)} icon={<TrendingUp size={20} />} />
            <StatCard label="Volume per Active Customer" value={formatCount(performanceQuery.data.kpis.volumePerActiveCustomer)} icon={<Gauge size={20} />} />
          </Box>

          {/* Transaction Value Distribution */}
          {performanceQuery.data.distribution.length > 0 && (
            <Paper sx={{ p: 2.2, ...glassPanelSx }}>
              <Typography variant="subtitle1" fontWeight={700}>Transaction Value Distribution</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Volume of transactions by average transaction size — shows where activity is concentrated
              </Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={performanceQuery.data.distribution} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => new Intl.NumberFormat("en-US", { notation: "compact" }).format(v)} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "Volume"
                          ? [new Intl.NumberFormat("en-US").format(Number(value)), "Volume"]
                          : [`${Number(value).toFixed(1)}%`, "Share"]
                      }
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalVolume" name="Volume" radius={[6, 6, 0, 0]}>
                      {performanceQuery.data.distribution.map((_, i) => (
                        <Cell key={i} fill={["#73c394", "#1b7f57", "#2563eb", "#c98b2c", "#c44b45", "#7c3aed"][i % 6]} />
                      ))}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="percentage" name="Share" stroke={chartPalette.warning} strokeWidth={2} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          )}

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.35fr 1fr" } }}>
            <ChartCard
              title="Daily Value Trend"
              subtitle="Deposit, withdrawal, and net flow values over the selected period"
              onExpand={() => setFocusedChart("dailyValue")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={dailyValueMode} onChange={setDailyValueMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyValueMode === "line" ? (
                    <LineChart data={performanceQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="depositValue" name="Deposits" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="withdrawalValue" name="Withdrawals" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="netFlowValue" name="Net Flow" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={performanceQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="depositValue" name="Deposits" fill={chartPalette.primary} />
                      <Bar dataKey="withdrawalValue" name="Withdrawals" fill={chartPalette.warning} />
                      <Bar dataKey="netFlowValue" name="Net Flow" fill={chartPalette.secondary} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard
              title="Daily Volume Mix"
              subtitle="Deposit and withdrawal transaction counts by day"
              onExpand={() => setFocusedChart("dailyVolume")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={dailyVolumeMode} onChange={setDailyVolumeMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyVolumeMode === "bar" ? (
                    <BarChart data={performanceQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="depositVolume" name="Deposits" fill={chartPalette.primary} />
                      <Bar dataKey="withdrawalVolume" name="Withdrawals" fill={chartPalette.warning} />
                    </BarChart>
                  ) : (
                    <LineChart data={performanceQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="depositVolume" name="Deposits" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="withdrawalVolume" name="Withdrawals" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Box>

          <ChartCard
            title="Monthly Productivity"
            subtitle="Total transaction value and value per active customer by month"
            onExpand={() => setFocusedChart("monthlyProd")}
          >
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ChartModeToggle mode={monthlyProdMode} onChange={setMonthlyProdMode} />
            </Stack>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {monthlyProdMode === "bar" ? (
                  <ComposedChart data={performanceQuery.data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalTransactionValue" name="Value" fill={chartPalette.primary} />
                    <Line yAxisId="right" type="monotone" dataKey="valuePerActiveCustomer" name="Value per Customer" stroke={chartPalette.danger} strokeWidth={2} />
                  </ComposedChart>
                ) : (
                  <LineChart data={performanceQuery.data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="totalTransactionValue" name="Value" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="valuePerActiveCustomer" name="Value per Customer" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Box>
          </ChartCard>

          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            {performanceQuery.data.monthlyTrend.slice(-6).map((point) => (
              <Paper key={point.period} variant="outlined" sx={{ p: 1.4, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="subtitle2" fontWeight={700}>{point.period}</Typography>
                  <Typography variant="body2">Value: {formatCurrency(point.totalTransactionValue)}</Typography>
                  <Typography variant="body2">Volume: {formatCount(point.totalTransactionVolume)}</Typography>
                  <Typography variant="body2">Net Flow: {formatCurrency(point.netFlowValue)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Box>

          {/* Deposit Method Profitability */}
          {performanceQuery.data.profitabilityByDepositMethod.length > 0 && (
            <Paper sx={{ p: 2.2, ...glassPanelSx }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>Deposit Method Profitability</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Commission earned per deposit channel over the selected period
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Deposit Method</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Volume</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Total Value</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Avg Amount</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Commission</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>Rate</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {performanceQuery.data.profitabilityByDepositMethod.map((row) => (
                    <TableRow key={row.method} hover>
                      <TableCell>{row.method}</TableCell>
                      <TableCell align="right">{new Intl.NumberFormat("en-US").format(row.volume)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.totalValue)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.avgAmount)}</TableCell>
                      <TableCell align="right">{formatCurrency(row.totalCommission)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${row.commissionRate.toFixed(2)}%`}
                          size="small"
                          color={row.commissionRate > 1 ? "success" : "default"}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(performanceQuery.data.period.dateFrom)} to {formatDate(performanceQuery.data.period.dateTo)}.
            Freshness: {new Date(performanceQuery.data.metadata.dataFreshnessTimestamp).toLocaleString("en-US")}.
          </Alert>
        </>
      ) : null}

      {performanceQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusTitle}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" } }}>
              <StatCard label="Deposit Value" value={formatCurrency(performanceQuery.data.kpis.depositValue)} />
              <StatCard label="Withdrawal Value" value={formatCurrency(performanceQuery.data.kpis.withdrawalValue)} />
              <StatCard label="Net Flow" value={formatCurrency(performanceQuery.data.kpis.netFlowValue)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "dailyValue" ? (
                <ChartModeToggle mode={dailyValueMode} onChange={setDailyValueMode} />
              ) : focusedChart === "dailyVolume" ? (
                <ChartModeToggle mode={dailyVolumeMode} onChange={setDailyVolumeMode} />
              ) : (
                <ChartModeToggle mode={monthlyProdMode} onChange={setMonthlyProdMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "dailyValue" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {dailyValueMode === "line" ? (
                      <LineChart data={performanceQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="depositValue" name="Deposits" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="withdrawalValue" name="Withdrawals" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="netFlowValue" name="Net Flow" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={performanceQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="depositValue" name="Deposits" fill={chartPalette.primary} />
                        <Bar dataKey="withdrawalValue" name="Withdrawals" fill={chartPalette.warning} />
                        <Bar dataKey="netFlowValue" name="Net Flow" fill={chartPalette.secondary} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "dailyVolume" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {dailyVolumeMode === "bar" ? (
                      <BarChart data={performanceQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="depositVolume" name="Deposits" fill={chartPalette.primary} />
                        <Bar dataKey="withdrawalVolume" name="Withdrawals" fill={chartPalette.warning} />
                      </BarChart>
                    ) : (
                      <LineChart data={performanceQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="depositVolume" name="Deposits" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="withdrawalVolume" name="Withdrawals" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {monthlyProdMode === "bar" ? (
                      <ComposedChart data={performanceQuery.data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalTransactionValue" name="Value" fill={chartPalette.primary} />
                        <Line yAxisId="right" type="monotone" dataKey="valuePerActiveCustomer" name="Value per Customer" stroke={chartPalette.danger} strokeWidth={2} />
                      </ComposedChart>
                    ) : (
                      <LineChart data={performanceQuery.data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="totalTransactionValue" name="Value" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="valuePerActiveCustomer" name="Value per Customer" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Monthly detail</Typography>
              {performanceQuery.data.monthlyTrend.slice(-6).map((point) => (
                <Paper key={point.period} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{point.period}</Typography>
                    <Typography variant="body2">Value {formatCurrency(point.totalTransactionValue)} | Volume {formatCount(point.totalTransactionVolume)} | Net Flow {formatCurrency(point.netFlowValue)}</Typography>
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
