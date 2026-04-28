import { useMemo } from "react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ComposedChart,
  Line,
  LineChart,
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
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { RefreshCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { chartPalette, glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import { listBranches } from "../services/branches";
import { formatCurrency } from "../services/format";
import { syncMetrics } from "../services/metrics";
import { fetchTrendsData } from "../services/trends";
import { ErrorState } from "../shared/components/ErrorState";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";
import { FocusDialog } from "../shared/components/FocusDialog";

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
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        {onExpand ? (
          <Button size="small" variant="outlined" onClick={onExpand}>
            Expand
          </Button>
        ) : null}
      </Stack>
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

export default function TrendsPage() {
  const queryClient = useQueryClient();
  const [focusedChart, setFocusedChart] = useState<
    | "efloat"
    | "cash"
    | "commission"
    | "tx"
    | "commission-leaders"
    | null
  >(null);
  const [efloatMode, setEfloatMode] = useState<ChartMode>("line");
  const [cashMode, setCashMode] = useState<ChartMode>("line");
  const [commissionMode, setCommissionMode] = useState<ChartMode>("line");
  const [txMode, setTxMode] = useState<ChartMode>("bar");
  const [commissionLeaderMode, setCommissionLeaderMode] = useState<ChartMode>("bar");
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

  const syncMutation = useMutation({
    mutationFn: syncMetrics,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trends"] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
    },
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
        <Stack spacing={1.2}>
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

            <Button
              variant="contained"
              startIcon={syncMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <RefreshCcw size={14} />}
              disabled={syncMutation.isPending}
              onClick={() =>
                syncMutation.mutate({
                  dateFrom,
                  dateTo,
                  branchId: branchId || undefined,
                })
              }
              sx={{ width: { xs: "100%", lg: "auto" }, whiteSpace: "nowrap" }}
            >
              {syncMutation.isPending ? "Syncing…" : "Sync Window"}
            </Button>
          </Stack>

          {syncMutation.isSuccess ? (
            <Alert severity="success" variant="outlined" sx={{ py: 0.5 }}>
              Synced {syncMutation.data.importedRowCount} rows across {syncMutation.data.branchCount} branches
              &nbsp;({syncMutation.data.dateFrom} – {syncMutation.data.dateTo})
              {syncMutation.data.missingSourceLineCount > 0 && (
                <> &mdash; <strong>{syncMutation.data.missingSourceLineCount} line{syncMutation.data.missingSourceLineCount !== 1 ? "s" : ""} not found in source</strong></>
              )}
            </Alert>
          ) : syncMutation.isError ? (
            <Alert severity="error" variant="outlined" sx={{ py: 0.5 }}>
              {getErrorMessage(syncMutation.error)}
            </Alert>
          ) : null}
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
            <ChartCard
              title="E-Float Trend"
              subtitle="Daily closing line balances rolled up by branch"
              onExpand={() => setFocusedChart("efloat")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={efloatMode} onChange={setEfloatMode} />
              </Stack>
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {efloatMode === "line" ? (
                      <LineChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Line type="monotone" dataKey="eFloatBalance" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="E-Float" />
                      </LineChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Bar dataKey="eFloatBalance" fill={chartPalette.primary} name="E-Float" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard
              title="Cash In / Out Value"
              subtitle="Daily deposit and withdrawal values with exact total transaction value"
              onExpand={() => setFocusedChart("cash")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={cashMode} onChange={setCashMode} />
              </Stack>
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {cashMode === "line" ? (
                      <ComposedChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Legend />
                        <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                        <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                        <Line type="monotone" dataKey="totalTransactionValue" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="Total Transaction Value" />
                      </ComposedChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Legend />
                        <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                        <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                        <Bar dataKey="totalTransactionValue" fill={chartPalette.primary} name="Total Transaction Value" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard
              title="Commission Trend"
              subtitle="Daily total commission from the source summary"
              onExpand={() => setFocusedChart("commission")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={commissionMode} onChange={setCommissionMode} />
              </Stack>
              {trendsQuery.data.cashTrend.length === 0 ? (
                <ChartEmpty message="No metrics for selected filters." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {commissionMode === "line" ? (
                      <LineChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Line type="monotone" dataKey="totalCommission" stroke={chartPalette.tertiary} strokeWidth={2} dot={false} name="Total Commission" />
                      </LineChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Bar dataKey="totalCommission" fill={chartPalette.tertiary} name="Total Commission" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard
              title="Branch Transaction Leaders"
              subtitle="Top branches in the selected window by transaction value"
              onExpand={() => setFocusedChart("tx")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={txMode} onChange={setTxMode} />
              </Stack>
              {trendsQuery.data.branchPerformance.length === 0 ? (
                <ChartEmpty message="No branch performance data." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {txMode === "bar" ? (
                      <BarChart data={trendsQuery.data.branchPerformance} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="number" tickFormatter={formatCompactCurrency} />
                        <YAxis type="category" dataKey="branchName" width={150} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Bar dataKey="totalTransactionValue" fill={chartPalette.primary} name="Transaction Value" />
                      </BarChart>
                    ) : (
                      <LineChart data={trendsQuery.data.branchPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="category" dataKey="branchName" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Line type="monotone" dataKey="totalTransactionValue" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="Transaction Value" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>

            <ChartCard
              title="Branch Commission Leaders"
              subtitle="Top branches in the selected window by commission earned"
              onExpand={() => setFocusedChart("commission-leaders")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={commissionLeaderMode} onChange={setCommissionLeaderMode} />
              </Stack>
              {trendsQuery.data.branchPerformance.length === 0 ? (
                <ChartEmpty message="No branch performance data." />
              ) : (
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {commissionLeaderMode === "bar" ? (
                      <BarChart data={trendsQuery.data.branchPerformance} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="number" tickFormatter={formatCompactCurrency} />
                        <YAxis type="category" dataKey="branchName" width={150} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Bar dataKey="totalCommission" fill={chartPalette.tertiary} name="Commission" />
                      </BarChart>
                    ) : (
                      <LineChart data={trendsQuery.data.branchPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="category" dataKey="branchName" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Line type="monotone" dataKey="totalCommission" stroke={chartPalette.tertiary} strokeWidth={2} dot={false} name="Commission" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </ChartCard>
          </Box>
        </>
      ) : null}

      {trendsQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={
            focusedChart === "efloat"
              ? "E-Float Trend"
              : focusedChart === "cash"
                ? "Cash In / Out Value"
                : focusedChart === "commission"
                  ? "Commission Trend"
                  : focusedChart === "tx"
                    ? "Branch Transaction Leaders"
                    : "Branch Commission Leaders"
          }
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box
              sx={{
                display: "grid",
                gap: 1,
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  md: "repeat(4, minmax(0, 1fr))",
                },
              }}
            >
              <StatCard label="Latest E-Float" value={formatCurrency(trendsQuery.data.kpis.latestTotalEFloat)} />
              <StatCard label="Transaction Value" value={formatCurrency(trendsQuery.data.kpis.totalTransactionValue)} />
              <StatCard label="Transaction Volume" value={trendsQuery.data.kpis.totalTransactionVolume.toLocaleString()} />
              <StatCard label="Commission" value={formatCurrency(trendsQuery.data.kpis.totalCommission)} />
            </Box>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "efloat" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {efloatMode === "line" ? (
                      <LineChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Line type="monotone" dataKey="eFloatBalance" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="E-Float" />
                      </LineChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Bar dataKey="eFloatBalance" fill={chartPalette.primary} name="E-Float" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "cash" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {cashMode === "line" ? (
                      <ComposedChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Legend />
                        <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                        <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                        <Line type="monotone" dataKey="totalTransactionValue" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="Total Transaction Value" />
                      </ComposedChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Legend />
                        <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                        <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                        <Bar dataKey="totalTransactionValue" fill={chartPalette.primary} name="Total Transaction Value" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "commission" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {commissionMode === "line" ? (
                      <LineChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Line type="monotone" dataKey="totalCommission" stroke={chartPalette.tertiary} strokeWidth={2} dot={false} name="Total Commission" />
                      </LineChart>
                    ) : (
                      <BarChart data={trendsQuery.data.cashTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} labelFormatter={formatTooltipLabel} />
                        <Bar dataKey="totalCommission" fill={chartPalette.tertiary} name="Total Commission" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "tx" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {txMode === "bar" ? (
                      <BarChart data={trendsQuery.data.branchPerformance} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="number" tickFormatter={formatCompactCurrency} />
                        <YAxis type="category" dataKey="branchName" width={180} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Bar dataKey="totalTransactionValue" fill={chartPalette.primary} name="Transaction Value" />
                      </BarChart>
                    ) : (
                      <LineChart data={trendsQuery.data.branchPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="category" dataKey="branchName" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Line type="monotone" dataKey="totalTransactionValue" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="Transaction Value" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {commissionLeaderMode === "bar" ? (
                      <BarChart data={trendsQuery.data.branchPerformance} layout="vertical" margin={{ left: 10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="number" tickFormatter={formatCompactCurrency} />
                        <YAxis type="category" dataKey="branchName" width={180} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Bar dataKey="totalCommission" fill={chartPalette.tertiary} name="Commission" />
                      </BarChart>
                    ) : (
                      <LineChart data={trendsQuery.data.branchPerformance}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="category" dataKey="branchName" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={formatCompactCurrency} />
                        <Tooltip formatter={formatTooltipMoney} />
                        <Line type="monotone" dataKey="totalCommission" stroke={chartPalette.tertiary} strokeWidth={2} dot={false} name="Commission" />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Daily detail</Typography>
              {trendsQuery.data.cashTrend.slice(-8).map((point) => (
                <Paper key={point.date} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{point.date}</Typography>
                    <Typography variant="body2">E-Float {formatCurrency(point.eFloatBalance)} | Txn {formatCurrency(point.totalTransactionValue)} | Commission {formatCurrency(point.totalCommission)}</Typography>
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
