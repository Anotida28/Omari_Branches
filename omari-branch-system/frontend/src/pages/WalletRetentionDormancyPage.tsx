import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, RefreshCcw, ShieldAlert, UserCheck, UserX } from "lucide-react";
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
import { fetchWalletRetentionDormancy } from "../services/wallet";
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

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
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

export default function WalletRetentionDormancyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<"inactivity" | "reactivation" | "cohorts" | null>(null);
  const [inactivityMode, setInactivityMode] = useState<ChartMode>("bar");
  const [reactivationMode, setReactivationMode] = useState<ChartMode>("line");
  const [cohortsMode, setCohortsMode] = useState<ChartMode>("bar");

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

  const retentionQuery = useQuery({
    queryKey: ["wallet", "retention-dormancy", { dateFrom, dateTo, currency }],
    queryFn: () => fetchWalletRetentionDormancy({ dateFrom, dateTo, asOfDate: dateTo, currency }),
    staleTime: 5 * 60 * 1000,
  });

  const focusTitle =
    focusedChart === "inactivity" ? "Inactivity Buckets"
    : focusedChart === "reactivation" ? "Reactivation Trend"
    : "Retention Cohorts";

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

      {retentionQuery.isError ? <Alert severity="error">{getErrorMessage(retentionQuery.error)}</Alert> : null}

      {retentionQuery.isLoading ? (
        <Alert severity="info">Loading retention and dormancy...</Alert>
      ) : retentionQuery.data ? (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
            <StatCard label="Active Customers A30" value={formatCount(retentionQuery.data.kpis.activeCustomersA30)} icon={<UserCheck size={20} />} />
            <StatCard label="Dormant Customers 90+" value={formatCount(retentionQuery.data.kpis.dormantCustomers90Plus)} icon={<UserX size={20} />} />
            <StatCard label="Dormancy Rate" value={formatPercent(retentionQuery.data.kpis.dormancyRate)} icon={<ShieldAlert size={20} />} />
            <StatCard label="Reactivated Customers" value={formatCount(retentionQuery.data.kpis.reactivatedCustomers)} icon={<RefreshCcw size={20} />} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1fr 1fr" } }}>
            <ChartCard
              title="Inactivity Buckets"
              subtitle="Customer count grouped by days since last transaction"
              onExpand={() => setFocusedChart("inactivity")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={inactivityMode} onChange={setInactivityMode} />
              </Stack>
              <Box sx={{ height: 290 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {inactivityMode === "bar" ? (
                    <BarChart data={retentionQuery.data.inactivityBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="customers" name="Customers" fill={chartPalette.warning} />
                    </BarChart>
                  ) : (
                    <LineChart data={retentionQuery.data.inactivityBuckets}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="customers" name="Customers" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard
              title="Reactivation Trend"
              subtitle="Dormant customers reactivated over the selected period"
              onExpand={() => setFocusedChart("reactivation")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={reactivationMode} onChange={setReactivationMode} />
              </Stack>
              <Box sx={{ height: 290 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {reactivationMode === "line" ? (
                    <LineChart data={retentionQuery.data.reactivationTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="reactivatedCustomers" name="Reactivated" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={retentionQuery.data.reactivationTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="reactivatedCustomers" name="Reactivated" fill={chartPalette.primary} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Box>

          <ChartCard
            title="Retention Cohorts"
            subtitle="Active vs dormant customers segmented by acquisition month"
            onExpand={() => setFocusedChart("cohorts")}
          >
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ChartModeToggle mode={cohortsMode} onChange={setCohortsMode} />
            </Stack>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {cohortsMode === "bar" ? (
                  <BarChart data={retentionQuery.data.cohorts.slice(0, 18)}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="active30Customers" name="Active A30" fill={chartPalette.primary} />
                    <Bar dataKey="dormant90Customers" name="Dormant 90+" fill={chartPalette.danger} />
                  </BarChart>
                ) : (
                  <LineChart data={retentionQuery.data.cohorts.slice(0, 18)}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="active30Customers" name="Active A30" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="dormant90Customers" name="Dormant 90+" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Box>
          </ChartCard>

          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            {retentionQuery.data.cohorts.slice(0, 6).map((cohort) => (
              <Paper key={cohort.cohortMonth} variant="outlined" sx={{ p: 1.4, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="subtitle2" fontWeight={700}>{cohort.cohortMonth}</Typography>
                  <Typography variant="body2">Customers: {formatCount(cohort.customers)}</Typography>
                  <Typography variant="body2">Active A30: {formatCount(cohort.active30Customers)} ({formatPercent(cohort.active30Rate)})</Typography>
                  <Typography variant="body2">Dormant 90+: {formatCount(cohort.dormant90Customers)} ({formatPercent(cohort.dormant90Rate)})</Typography>
                </Stack>
              </Paper>
            ))}
          </Box>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(retentionQuery.data.period.dateFrom)} to {formatDate(retentionQuery.data.period.dateTo)}.
          </Alert>
        </>
      ) : null}

      {retentionQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusTitle}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
              <StatCard label="Active A30" value={formatCount(retentionQuery.data.kpis.activeCustomersA30)} />
              <StatCard label="Dormant 90+" value={formatCount(retentionQuery.data.kpis.dormantCustomers90Plus)} />
              <StatCard label="Dormancy Rate" value={formatPercent(retentionQuery.data.kpis.dormancyRate)} />
              <StatCard label="Reactivated" value={formatCount(retentionQuery.data.kpis.reactivatedCustomers)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "inactivity" ? (
                <ChartModeToggle mode={inactivityMode} onChange={setInactivityMode} />
              ) : focusedChart === "reactivation" ? (
                <ChartModeToggle mode={reactivationMode} onChange={setReactivationMode} />
              ) : (
                <ChartModeToggle mode={cohortsMode} onChange={setCohortsMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "inactivity" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {inactivityMode === "bar" ? (
                      <BarChart data={retentionQuery.data.inactivityBuckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="customers" name="Customers" fill={chartPalette.warning} />
                      </BarChart>
                    ) : (
                      <LineChart data={retentionQuery.data.inactivityBuckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="customers" name="Customers" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "reactivation" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {reactivationMode === "line" ? (
                      <LineChart data={retentionQuery.data.reactivationTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="reactivatedCustomers" name="Reactivated" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={retentionQuery.data.reactivationTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="reactivatedCustomers" name="Reactivated" fill={chartPalette.primary} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {cohortsMode === "bar" ? (
                      <BarChart data={retentionQuery.data.cohorts.slice(0, 18)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="active30Customers" name="Active A30" fill={chartPalette.primary} />
                        <Bar dataKey="dormant90Customers" name="Dormant 90+" fill={chartPalette.danger} />
                      </BarChart>
                    ) : (
                      <LineChart data={retentionQuery.data.cohorts.slice(0, 18)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="cohortMonth" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="active30Customers" name="Active A30" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="dormant90Customers" name="Dormant 90+" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Cohort detail</Typography>
              {retentionQuery.data.cohorts.slice(0, 6).map((cohort) => (
                <Paper key={cohort.cohortMonth} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{cohort.cohortMonth}</Typography>
                    <Typography variant="body2">Active A30 {formatCount(cohort.active30Customers)} ({formatPercent(cohort.active30Rate)}) | Dormant 90+ {formatCount(cohort.dormant90Customers)} ({formatPercent(cohort.dormant90Rate)})</Typography>
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
