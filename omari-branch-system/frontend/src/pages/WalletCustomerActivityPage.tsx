import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, CalendarClock, Repeat2, UserPlus, Users } from "lucide-react";
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
import { formatDate } from "../services/format";
import { fetchWalletCustomerActivityGrowth } from "../services/wallet";
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

export default function WalletCustomerActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<"dailyActivity" | "frequency" | null>(null);
  const [dailyActivityMode, setDailyActivityMode] = useState<ChartMode>("line");
  const [frequencyMode, setFrequencyMode] = useState<ChartMode>("bar");

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

  const activityQuery = useQuery({
    queryKey: ["wallet", "customer-activity", { dateFrom, dateTo, currency }],
    queryFn: () => fetchWalletCustomerActivityGrowth({ dateFrom, dateTo, currency }),
    staleTime: 5 * 60 * 1000,
  });

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

      {activityQuery.isError ? <Alert severity="error">{getErrorMessage(activityQuery.error)}</Alert> : null}

      {activityQuery.isLoading ? (
        <Stack spacing={2}>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
            {Array.from({ length: 4 }).map((_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </Box>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.6fr 1fr" } }}>
            <ChartSkeleton height={300} />
            <ChartSkeleton height={300} />
          </Box>
        </Stack>
      ) : activityQuery.data ? (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
            <StatCard label="Active Customers" value={formatCount(activityQuery.data.kpis.activeCustomers)} icon={<Users size={20} />} />
            <StatCard label="New Customers" value={formatCount(activityQuery.data.kpis.newCustomers)} icon={<UserPlus size={20} />} />
            <StatCard label="Returning Customers" value={formatCount(activityQuery.data.kpis.returningCustomers)} icon={<Repeat2 size={20} />} />
            <StatCard label="Avg Tx per Active Customer" value={formatCount(activityQuery.data.kpis.averageTransactionsPerActiveCustomer)} icon={<Activity size={20} />} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.6fr 1fr" } }}>
            <ChartCard
              title="Daily Customer Activity"
              subtitle="Active, new, and returning customers over the selected period"
              onExpand={() => setFocusedChart("dailyActivity")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={dailyActivityMode} onChange={setDailyActivityMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {dailyActivityMode === "line" ? (
                    <LineChart data={activityQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="activeCustomers" name="Active" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="newCustomers" name="New" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="returningCustomers" name="Returning" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={activityQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="activeCustomers" name="Active" fill={chartPalette.primary} />
                      <Bar dataKey="newCustomers" name="New" fill={chartPalette.warning} />
                      <Bar dataKey="returningCustomers" name="Returning" fill={chartPalette.secondary} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard
              title="Activity Frequency"
              subtitle="Customer distribution by transaction frequency"
              onExpand={() => setFocusedChart("frequency")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={frequencyMode} onChange={setFrequencyMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {frequencyMode === "bar" ? (
                    <BarChart data={activityQuery.data.frequencyBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="customers" name="Customers" fill={chartPalette.primary} />
                    </BarChart>
                  ) : (
                    <LineChart data={activityQuery.data.frequencyBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="customers" name="Customers" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Box>

          <Paper sx={{ p: 2.2, ...glassPanelSx }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.2 }}>Monthly Growth Summary</Typography>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
              {activityQuery.data.monthlyTrend.map((point) => (
                <Paper key={point.period} variant="outlined" sx={{ p: 1.4, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                  <Stack spacing={0.4}>
                    <Typography variant="subtitle2" fontWeight={700}>{point.period}</Typography>
                    <Typography variant="body2">Active: {formatCount(point.activeCustomers)}</Typography>
                    <Typography variant="body2">New: {formatCount(point.newCustomers)}</Typography>
                    <Typography variant="body2">Returning: {formatCount(point.returningCustomers)}</Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          </Paper>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(activityQuery.data.period.dateFrom)} to {formatDate(activityQuery.data.period.dateTo)}.
          </Alert>
        </>
      ) : null}

      {activityQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusedChart === "dailyActivity" ? "Daily Customer Activity" : "Activity Frequency"}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
              <StatCard label="Active Customers" value={formatCount(activityQuery.data.kpis.activeCustomers)} />
              <StatCard label="New Customers" value={formatCount(activityQuery.data.kpis.newCustomers)} />
              <StatCard label="Returning" value={formatCount(activityQuery.data.kpis.returningCustomers)} />
              <StatCard label="Avg Tx / Customer" value={formatCount(activityQuery.data.kpis.averageTransactionsPerActiveCustomer)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "dailyActivity" ? (
                <ChartModeToggle mode={dailyActivityMode} onChange={setDailyActivityMode} />
              ) : (
                <ChartModeToggle mode={frequencyMode} onChange={setFrequencyMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "dailyActivity" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {dailyActivityMode === "line" ? (
                      <LineChart data={activityQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="activeCustomers" name="Active" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="newCustomers" name="New" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="returningCustomers" name="Returning" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={activityQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="activeCustomers" name="Active" fill={chartPalette.primary} />
                        <Bar dataKey="newCustomers" name="New" fill={chartPalette.warning} />
                        <Bar dataKey="returningCustomers" name="Returning" fill={chartPalette.secondary} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {frequencyMode === "bar" ? (
                      <BarChart data={activityQuery.data.frequencyBuckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="customers" name="Customers" fill={chartPalette.primary} />
                      </BarChart>
                    ) : (
                      <LineChart data={activityQuery.data.frequencyBuckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="customers" name="Customers" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Monthly detail</Typography>
              {activityQuery.data.monthlyTrend.slice(-6).map((point) => (
                <Paper key={point.period} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{point.period}</Typography>
                    <Typography variant="body2">Active {formatCount(point.activeCustomers)} | New {formatCount(point.newCustomers)} | Returning {formatCount(point.returningCustomers)}</Typography>
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
