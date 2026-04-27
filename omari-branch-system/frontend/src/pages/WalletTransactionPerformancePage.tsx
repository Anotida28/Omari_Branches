import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, CalendarClock, Gauge, TrendingUp, Users } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Divider,
  Paper,
  Stack,
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
import { fetchWalletTransactionPerformance } from "../services/wallet";
import { FilterBar } from "../shared/components/FilterBar";
import { FocusDialog } from "../shared/components/FocusDialog";
import { StatCard } from "../shared/components/StatCard";

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

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) { next.delete(key); return; }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const performanceQuery = useQuery({
    queryKey: ["wallet", "transaction-performance", { dateFrom, dateTo, currency }],
    queryFn: () => fetchWalletTransactionPerformance({ dateFrom, dateTo, currency }),
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
        <Alert severity="info">Loading transaction performance...</Alert>
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
