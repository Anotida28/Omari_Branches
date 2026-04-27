import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarClock, Percent, Receipt, TrendingUp, Users } from "lucide-react";
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
import { fetchWalletRevenuePerformance } from "../services/wallet";
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

export default function WalletRevenuePerformancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<"dailyCommission" | "dailyQuality" | "monthlyEfficiency" | null>(null);
  const [dailyCommissionMode, setDailyCommissionMode] = useState<ChartMode>("line");
  const [dailyQualityMode, setDailyQualityMode] = useState<ChartMode>("bar");
  const [monthlyEfficiencyMode, setMonthlyEfficiencyMode] = useState<ChartMode>("bar");

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

  const revenueQuery = useQuery({
    queryKey: ["wallet", "revenue-performance", { dateFrom, dateTo, currency }],
    queryFn: () => fetchWalletRevenuePerformance({ dateFrom, dateTo, currency }),
  });

  const focusTitle =
    focusedChart === "dailyCommission" ? "Daily Commission Trend"
    : focusedChart === "dailyQuality" ? "Daily Revenue Quality"
    : "Monthly Revenue Efficiency";

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

      {revenueQuery.isError ? <Alert severity="error">{getErrorMessage(revenueQuery.error)}</Alert> : null}

      {revenueQuery.isLoading ? (
        <Alert severity="info">Loading wallet revenue...</Alert>
      ) : revenueQuery.data ? (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
            <StatCard label="Total Commission" value={formatCurrency(revenueQuery.data.kpis.totalCommission)} icon={<Banknote size={20} />} />
            <StatCard label="Commission per Tx" value={formatCurrency(revenueQuery.data.kpis.commissionPerTransaction)} icon={<Receipt size={20} />} />
            <StatCard label="Commission per Customer" value={formatCurrency(revenueQuery.data.kpis.commissionPerActiveCustomer)} icon={<Users size={20} />} />
            <StatCard label="Commission Rate" value={formatPercent(revenueQuery.data.kpis.commissionRate)} icon={<Percent size={20} />} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.35fr 1fr" } }}>
            <ChartCard
              title="Daily Commission Trend"
              subtitle="Total, deposit, and withdrawal commission over the selected period"
              onExpand={() => setFocusedChart("dailyCommission")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={dailyCommissionMode} onChange={setDailyCommissionMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyCommissionMode === "line" ? (
                    <LineChart data={revenueQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="totalCommission" name="Total Commission" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="depositCommission" name="Deposit Commission" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="withdrawalCommission" name="Withdrawal Commission" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={revenueQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="totalCommission" name="Total Commission" fill={chartPalette.primary} />
                      <Bar dataKey="depositCommission" name="Deposit Commission" fill={chartPalette.secondary} />
                      <Bar dataKey="withdrawalCommission" name="Withdrawal Commission" fill={chartPalette.warning} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard
              title="Daily Revenue Quality"
              subtitle="Commission per transaction and commission rate by day"
              onExpand={() => setFocusedChart("dailyQuality")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={dailyQualityMode} onChange={setDailyQualityMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyQualityMode === "bar" ? (
                    <ComposedChart data={revenueQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="commissionPerTransaction" name="Commission per Tx" fill={chartPalette.primary} />
                      <Line yAxisId="right" type="monotone" dataKey="commissionRate" name="Commission Rate %" stroke={chartPalette.danger} strokeWidth={2} />
                    </ComposedChart>
                  ) : (
                    <LineChart data={revenueQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="commissionPerTransaction" name="Commission per Tx" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="commissionRate" name="Commission Rate %" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Box>

          <ChartCard
            title="Monthly Revenue Efficiency"
            subtitle="Commission earned and commission per active customer by month"
            onExpand={() => setFocusedChart("monthlyEfficiency")}
          >
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ChartModeToggle mode={monthlyEfficiencyMode} onChange={setMonthlyEfficiencyMode} />
            </Stack>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {monthlyEfficiencyMode === "bar" ? (
                  <ComposedChart data={revenueQuery.data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalCommission" name="Commission" fill={chartPalette.primary} />
                    <Line yAxisId="right" type="monotone" dataKey="commissionPerActiveCustomer" name="Commission per Customer" stroke={chartPalette.warning} strokeWidth={2} />
                  </ComposedChart>
                ) : (
                  <LineChart data={revenueQuery.data.monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="totalCommission" name="Commission" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="commissionPerActiveCustomer" name="Commission per Customer" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Box>
          </ChartCard>

          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            {revenueQuery.data.monthlyTrend.slice(-6).map((point) => (
              <Paper key={point.period} variant="outlined" sx={{ p: 1.4, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="subtitle2" fontWeight={700}>{point.period}</Typography>
                  <Typography variant="body2">Commission: {formatCurrency(point.totalCommission)}</Typography>
                  <Typography variant="body2">Per Tx: {formatCurrency(point.commissionPerTransaction)}</Typography>
                  <Typography variant="body2">Rate: {formatPercent(point.commissionRate)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Box>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(revenueQuery.data.period.dateFrom)} to {formatDate(revenueQuery.data.period.dateTo)}.
            Freshness: {new Date(revenueQuery.data.metadata.dataFreshnessTimestamp).toLocaleString("en-US")}.
          </Alert>
        </>
      ) : null}

      {revenueQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusTitle}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
              <StatCard label="Total Commission" value={formatCurrency(revenueQuery.data.kpis.totalCommission)} />
              <StatCard label="Per Transaction" value={formatCurrency(revenueQuery.data.kpis.commissionPerTransaction)} />
              <StatCard label="Per Customer" value={formatCurrency(revenueQuery.data.kpis.commissionPerActiveCustomer)} />
              <StatCard label="Commission Rate" value={formatPercent(revenueQuery.data.kpis.commissionRate)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "dailyCommission" ? (
                <ChartModeToggle mode={dailyCommissionMode} onChange={setDailyCommissionMode} />
              ) : focusedChart === "dailyQuality" ? (
                <ChartModeToggle mode={dailyQualityMode} onChange={setDailyQualityMode} />
              ) : (
                <ChartModeToggle mode={monthlyEfficiencyMode} onChange={setMonthlyEfficiencyMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "dailyCommission" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {dailyCommissionMode === "line" ? (
                      <LineChart data={revenueQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="totalCommission" name="Total Commission" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="depositCommission" name="Deposit Commission" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="withdrawalCommission" name="Withdrawal Commission" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={revenueQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="totalCommission" name="Total Commission" fill={chartPalette.primary} />
                        <Bar dataKey="depositCommission" name="Deposit Commission" fill={chartPalette.secondary} />
                        <Bar dataKey="withdrawalCommission" name="Withdrawal Commission" fill={chartPalette.warning} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "dailyQuality" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {dailyQualityMode === "bar" ? (
                      <ComposedChart data={revenueQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="commissionPerTransaction" name="Commission per Tx" fill={chartPalette.primary} />
                        <Line yAxisId="right" type="monotone" dataKey="commissionRate" name="Commission Rate %" stroke={chartPalette.danger} strokeWidth={2} />
                      </ComposedChart>
                    ) : (
                      <LineChart data={revenueQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="commissionPerTransaction" name="Commission per Tx" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="commissionRate" name="Commission Rate %" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {monthlyEfficiencyMode === "bar" ? (
                      <ComposedChart data={revenueQuery.data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar yAxisId="left" dataKey="totalCommission" name="Commission" fill={chartPalette.primary} />
                        <Line yAxisId="right" type="monotone" dataKey="commissionPerActiveCustomer" name="Commission per Customer" stroke={chartPalette.warning} strokeWidth={2} />
                      </ComposedChart>
                    ) : (
                      <LineChart data={revenueQuery.data.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="totalCommission" name="Commission" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="commissionPerActiveCustomer" name="Commission per Customer" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Monthly detail</Typography>
              {revenueQuery.data.monthlyTrend.slice(-6).map((point) => (
                <Paper key={point.period} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{point.period}</Typography>
                    <Typography variant="body2">Commission {formatCurrency(point.totalCommission)} | Per Tx {formatCurrency(point.commissionPerTransaction)} | Rate {formatPercent(point.commissionRate)}</Typography>
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
