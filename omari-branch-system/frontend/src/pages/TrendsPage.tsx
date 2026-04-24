import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
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
                xl: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            <StatCard
              label="Latest Total E-Float"
              value={formatCurrency(trendsQuery.data.kpis.latestTotalEFloat)}
              hint={branchName}
            />
            <StatCard
              label="Transaction Value"
              value={formatCurrency(trendsQuery.data.kpis.totalTransactionValue)}
              hint={`${trendsQuery.data.kpis.totalTransactionVolume} transactions`}
            />
            <StatCard
              label="Total Commission"
              value={formatCurrency(trendsQuery.data.kpis.totalCommission)}
              hint={branchName}
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
            <ChartCard title="E-Float Trend" subtitle="Daily closing line balances rolled up by branch">
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
                        dataKey="eFloatBalance"
                        stroke={chartPalette.primary}
                        strokeWidth={2}
                        dot={false}
                        name="E-Float"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Cash In / Out Value" subtitle="Daily deposit and withdrawal values with exact total transaction value">
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
                        dataKey="totalTransactionValue"
                        stroke={chartPalette.primary}
                        strokeWidth={2}
                        dot={false}
                        name="Total Transaction Value"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Commission Trend" subtitle="Daily total commission from the source summary">
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
                        dataKey="totalCommission"
                        stroke={chartPalette.tertiary}
                        strokeWidth={2}
                        dot={false}
                        name="Total Commission"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Branch Transaction Leaders" subtitle="Top branches in the selected window by transaction value">
              {trendsQuery.data.branchPerformance.length === 0 ? (
                <ChartEmpty message="No branch performance data." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={trendsQuery.data.branchPerformance}
                      layout="vertical"
                      margin={{ left: 10, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} />
                      <YAxis type="category" dataKey="branchName" width={150} />
                      <Tooltip formatter={formatTooltipMoney} />
                      <Bar
                        dataKey="totalTransactionValue"
                        fill={chartPalette.primary}
                        name="Transaction Value"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard title="Branch Commission Leaders" subtitle="Top branches in the selected window by commission earned">
              {trendsQuery.data.branchPerformance.length === 0 ? (
                <ChartEmpty message="No branch performance data." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={trendsQuery.data.branchPerformance}
                      layout="vertical"
                      margin={{ left: 10, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis type="number" tickFormatter={formatCompactCurrency} />
                      <YAxis type="category" dataKey="branchName" width={150} />
                      <Tooltip formatter={formatTooltipMoney} />
                      <Bar
                        dataKey="totalCommission"
                        fill={chartPalette.tertiary}
                        name="Commission"
                      />
                    </BarChart>
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
