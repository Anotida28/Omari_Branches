import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { chartPalette, glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency } from "../services/format";
import { fetchTrendsData } from "../services/trends";
import { ErrorState } from "../shared/components/ErrorState";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";

const PIE_COLORS = [
  chartPalette.primary,
  chartPalette.secondary,
  chartPalette.tertiary,
  chartPalette.warning,
  chartPalette.danger,
];

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatCompactCurrency(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (absolute >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatTooltipMoney(value: number | string | undefined): string {
  return formatCurrency(Number(value ?? 0));
}

function formatTooltipLabel(label: unknown): string {
  return formatDateLabel(String(label ?? ""));
}

function ChartCard({
  title,
  subtitle,
  children,
  minHeight = 300,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  minHeight?: number;
}) {
  return (
    <Paper sx={{ p: 2.2, ...glassPanelSx, minHeight }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.3 }}>
        {subtitle}
      </Typography>
      {children}
    </Paper>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <Box
      sx={{
        height: 260,
        borderRadius: 2,
        border: "1px dashed rgba(16, 32, 23, 0.22)",
        display: "grid",
        placeItems: "center",
        color: "text.secondary",
      }}
    >
      <Typography variant="body2">{message}</Typography>
    </Box>
  );
}

export default function TrendsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialDateTo = toInputDate(new Date());
  const initialDateFrom = toInputDate(shiftDays(new Date(), -60));

  const branchId = searchParams.get("branchId") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? initialDateFrom;
  const dateTo = searchParams.get("dateTo") ?? initialDateTo;

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-trends"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const trendsQuery = useQuery({
    queryKey: ["trends", { branchId, dateFrom, dateTo }],
    queryFn: () =>
      fetchTrendsData({
        branchId: branchId || undefined,
        dateFrom,
        dateTo,
      }),
  });

  const branchName = useMemo(() => {
    if (!branchId) {
      return "All Branches";
    }
    return (
      branchesQuery.data?.items.find((branch) => branch.id === branchId)?.displayName ??
      "Selected Branch"
    );
  }, [branchId, branchesQuery.data?.items]);

  const errorMessage = (() => {
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (trendsQuery.isError) {
      return getErrorMessage(trendsQuery.error);
    }
    return "";
  })();

  if (errorMessage) {
    return (
      <section className="space-y-5 motion-fade-up">
        <ErrorState message={errorMessage} />
      </section>
    );
  }

  return (
    <section className="space-y-5 motion-fade-up">
      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2}>
          <TextField
            select
            label="Branch"
            value={branchId}
            onChange={(event) => updateParams({ branchId: event.target.value || undefined })}
            sx={{ minWidth: { xs: "100%", lg: 220 } }}
          >
            <MenuItem value="">All branches</MenuItem>
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.displayName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Date From"
            type="date"
            value={dateFrom}
            onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />

          <TextField
            label="Date To"
            type="date"
            value={dateTo}
            onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />

          <Button
            variant="outlined"
            onClick={() => setSearchParams({}, { replace: true })}
            sx={{ width: { xs: "100%", lg: "auto" }, whiteSpace: "nowrap" }}
          >
            Reset Filters
          </Button>
        </Stack>
      </FilterBar>

      {trendsQuery.isLoading ? (
        <Paper sx={{ p: 3, ...glassPanelSx }}>
          <Typography variant="body2" color="text.secondary">
            Loading analytics...
          </Typography>
        </Paper>
      ) : trendsQuery.data ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            <StatCard
              label="Total Cash on Branch"
              value={formatCurrency(trendsQuery.data.kpis.totalCashOnBranch)}
              hint={branchName}
            />
            <StatCard
              label="Outstanding Balance"
              value={formatCurrency(trendsQuery.data.kpis.totalOutstandingBalance)}
              hint="All unpaid balances"
            />
            <StatCard
              label="Overdue Amount"
              value={formatCurrency(trendsQuery.data.kpis.overdueAmount)}
              hint={`${trendsQuery.data.kpis.overdueCount} overdue expenses`}
            />
            <StatCard
              label="Due in 7 Days"
              value={formatCurrency(trendsQuery.data.kpis.dueNext7Amount)}
              hint="Next 7-day exposure"
            />
            <StatCard
              label="Alert Failure Rate"
              value={`${trendsQuery.data.kpis.alertFailureRate.toFixed(1)}%`}
              hint="FAILED / (FAILED + SENT)"
            />
            <StatCard
              label="Window"
              value={`${formatDateLabel(dateFrom)} - ${formatDateLabel(dateTo)}`}
              hint={branchName}
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                xl: "repeat(2, minmax(0, 1fr))",
              },
            }}
          >
            <ChartCard title="Cash on Branch Trend" subtitle="Daily total cash position">
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsQuery.data.cashTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                      <Line
                        type="monotone"
                        dataKey="cashOnBranch"
                        stroke={chartPalette.primary}
                        strokeWidth={2}
                        dot={false}
                        name="Cash on Branch"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Cash Composition" subtitle="Cash balance vs e-float vs vault">
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendsQuery.data.cashTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="cashBalance"
                        stackId="cash"
                        stroke={chartPalette.primary}
                        fill="#9bd4b8"
                        name="Cash Balance"
                      />
                      <Area
                        type="monotone"
                        dataKey="eFloatBalance"
                        stackId="cash"
                        stroke={chartPalette.secondary}
                        fill="#b5e0c9"
                        name="E-Float"
                      />
                      <Area
                        type="monotone"
                        dataKey="cashInVault"
                        stackId="cash"
                        stroke={chartPalette.tertiary}
                        fill="#d0eadc"
                        name="Cash in Vault"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Cash In / Out + Net" subtitle="Operational movement per day">
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendsQuery.data.cashTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                      <Legend />
                      <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                      <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                      <Line
                        type="monotone"
                        dataKey="netCashValue"
                        stroke={chartPalette.primary}
                        strokeWidth={2}
                        dot={false}
                        name="Net Cash"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Outstanding by Branch" subtitle="Highest unpaid exposure">
              {trendsQuery.data.outstandingByBranch.length === 0 ? (
                <ChartEmpty message="No outstanding balances." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={trendsQuery.data.outstandingByBranch}
                      layout="vertical"
                      margin={{ left: 10, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} />
                      <YAxis type="category" dataKey="branchName" width={140} />
                      <Tooltip formatter={formatTooltipMoney} />
                      <Bar dataKey="outstandingBalance" fill={chartPalette.primary} name="Outstanding" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Due Risk Timeline" subtitle="Upcoming vs overdue by week">
              {trendsQuery.data.dueRiskTimeline.length === 0 ? (
                <ChartEmpty message="No due-date risk data." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendsQuery.data.dueRiskTimeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="week" />
                      <YAxis tickFormatter={formatCompactCurrency} />
                      <Tooltip formatter={formatTooltipMoney} />
                      <Legend />
                      <Bar dataKey="upcomingAmount" stackId="risk" fill={chartPalette.secondary} name="Upcoming" />
                      <Bar dataKey="overdueAmount" stackId="risk" fill={chartPalette.danger} name="Overdue" />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Expense Type Mix" subtitle="Outstanding balance by type">
              {trendsQuery.data.expenseTypeMix.length === 0 ? (
                <ChartEmpty message="No outstanding expense mix data." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={trendsQuery.data.expenseTypeMix}
                        dataKey="outstandingBalance"
                        nameKey="expenseType"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={2}
                        label
                      >
                        {trendsQuery.data.expenseTypeMix.map((entry, index) => (
                          <Cell key={entry.expenseType} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={formatTooltipMoney} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard
              title="Alerts Health Trend"
              subtitle="SENT / FAILED / SKIPPED by day"
              minHeight={320}
            >
              {trendsQuery.data.alertsHealthTrend.length === 0 ? (
                <ChartEmpty message="No alert activity for selected filters." />
              ) : (
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsQuery.data.alertsHealthTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                      <YAxis />
                      <Tooltip labelFormatter={formatTooltipLabel} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="sent"
                        stroke={chartPalette.secondary}
                        strokeWidth={2}
                        dot={false}
                        name="Sent"
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        stroke={chartPalette.danger}
                        strokeWidth={2}
                        dot={false}
                        name="Failed"
                      />
                      <Line
                        type="monotone"
                        dataKey="skipped"
                        stroke={chartPalette.warning}
                        strokeWidth={2}
                        dot={false}
                        name="Skipped"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>
          </Box>
        </>
      ) : null}
    </section>
  );
}
