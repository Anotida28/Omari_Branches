import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CircleDollarSign, Database, Receipt, Search, UserCheck, UserRound } from "lucide-react";
import { useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
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
import { fetchSnapshotStatus, triggerSnapshotSync } from "../services/admin";
import { formatCurrency, formatDate } from "../services/format";
import { fetchWalletCustomer360Detail, fetchWalletCustomer360List } from "../services/wallet";
import { useAuth } from "../hooks/useAuth";
import { ChartSkeleton } from "../shared/components/ChartSkeleton";
import { FilterBar } from "../shared/components/FilterBar";
import { FocusDialog } from "../shared/components/FocusDialog";
import { StatCard } from "../shared/components/StatCard";
import { StatCardSkeleton } from "../shared/components/StatCardSkeleton";
import { TableSkeletonRows } from "../shared/components/TableSkeletonRows";

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

const statusLabels = {
  active: "Active",
  watch: "Watch",
  dormant: "Dormant",
} as const;

const statusColors = {
  active: "success",
  watch: "warning",
  dormant: "error",
} as const;

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

export default function WalletCustomer360Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<"valueTrend" | "depositVs" | null>(null);
  const [valueTrendMode, setValueTrendMode] = useState<ChartMode>("line");
  const [depositVsMode, setDepositVsMode] = useState<ChartMode>("bar");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const snapshotQuery = useQuery({
    queryKey: ["admin", "wallet-snapshot-status"],
    queryFn: fetchSnapshotStatus,
    staleTime: 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: triggerSnapshotSync,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "wallet-snapshot-status"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet", "customer-360"] });
    },
  });

  const initialDateTo = toInputDate(new Date());
  const initialDateFrom = toInputDate(shiftDays(new Date(), -29));
  const dateFrom = searchParams.get("dateFrom") ?? initialDateFrom;
  const dateTo = searchParams.get("dateTo") ?? initialDateTo;
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "all") as "all" | "active_a30" | "dormant_90";
  const selectedCustomerId = searchParams.get("customerId") ?? "";
  const currency = (searchParams.get("currency") ?? "USD") as "USD" | "ZWL";
  const page = Math.max(0, Number(searchParams.get("page") ?? "0"));
  const pageSize = Math.max(10, Number(searchParams.get("pageSize") ?? "25"));

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

  const listQuery = useQuery({
    queryKey: ["wallet", "customer-360", { search, status, page, pageSize, dateTo, currency }],
    queryFn: () =>
      fetchWalletCustomer360List({
        search: search || undefined,
        status,
        page: page + 1,
        pageSize,
        asOfDate: dateTo,
        currency,
      }),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!selectedCustomerId && listQuery.data?.items[0]?.customerId) {
      updateParams({ customerId: listQuery.data.items[0].customerId });
    }
  }, [listQuery.data, selectedCustomerId]);

  const detailQuery = useQuery({
    queryKey: ["wallet", "customer-360-detail", { selectedCustomerId, dateFrom, dateTo, currency }],
    queryFn: () =>
      fetchWalletCustomer360Detail({
        customerId: selectedCustomerId,
        dateFrom,
        dateTo,
        asOfDate: dateTo,
        currency,
      }),
    enabled: selectedCustomerId.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const snapshotRefreshedAt = snapshotQuery.data?.refreshedAt
    ? new Date(snapshotQuery.data.refreshedAt).toLocaleString()
    : null;
  const snapshotIsStale = snapshotQuery.data?.isStale ?? false;
  const snapshotCount = snapshotQuery.data?.customerCount ?? 0;

  return (
    <section className="space-y-5 motion-fade-up">
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Database size={14} style={{ opacity: 0.5 }} />
          {snapshotCount > 0 ? (
            <Typography variant="caption" color={snapshotIsStale ? "warning.main" : "text.secondary"}>
              Snapshot: {snapshotCount.toLocaleString()} customers
              {snapshotRefreshedAt ? ` · refreshed ${snapshotRefreshedAt}` : ""}
              {snapshotIsStale ? " · stale" : ""}
            </Typography>
          ) : (
            <Typography variant="caption" color="warning.main">
              Snapshot not populated — showing live data (slow)
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setSearchParams({}, { replace: true })}
            sx={{ whiteSpace: "nowrap" }}
          >
            Reset Filters
          </Button>
          {isSuperAdmin && (
            <Button
              size="small"
              variant="outlined"
              startIcon={syncMutation.isPending ? undefined : <Database size={14} />}
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
            >
              {syncMutation.isPending ? "Syncing…" : "Sync Snapshot"}
            </Button>
          )}
        </Stack>
      </Stack>
      <FilterBar>
        <Stack direction={{ xs: "column", xl: "row" }} spacing={1.2} alignItems={{ xs: "stretch", xl: "center" }}>
          <ButtonGroup size="small" variant="outlined">
            {(["USD", "ZWL"] as const).map((c) => (
              <Button key={c} variant={currency === c ? "contained" : "outlined"} onClick={() => updateParams({ currency: c, page: undefined, customerId: undefined })}>{c}</Button>
            ))}
          </ButtonGroup>
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap" }}>
            {presets.map((preset) => (
              <Button key={preset.label} onClick={() => updateParams({ ...preset.getRange(), page: undefined })}>
                {preset.label}
              </Button>
            ))}
          </ButtonGroup>
          <TextField
            label="Search Customer"
            value={search}
            onChange={(event) => updateParams({ search: event.target.value || undefined, page: undefined, customerId: undefined })}
            InputProps={{ startAdornment: <Search size={16} style={{ marginRight: 8 }} /> }}
            sx={{ minWidth: { xs: "100%", xl: 230 } }}
          />
          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) => updateParams({ status: event.target.value, page: undefined, customerId: undefined })}
            sx={{ minWidth: { xs: "100%", xl: 150 } }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active_a30">Active A30</MenuItem>
            <MenuItem value="dormant_90">Dormant 90+</MenuItem>
          </TextField>
          <TextField
            type="date"
            label="Date From"
            value={dateFrom}
            onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", xl: 170 } }}
          />
          <TextField
            type="date"
            label="Date To"
            value={dateTo}
            onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", xl: 170 } }}
          />
        </Stack>
      </FilterBar>

      {listQuery.isError ? <Alert severity="error">{getErrorMessage(listQuery.error)}</Alert> : null}
      {detailQuery.isError ? <Alert severity="error">{getErrorMessage(detailQuery.error)}</Alert> : null}

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Paper sx={{ order: 2, p: 2.2, ...glassPanelSx }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Customer Directory
          </Typography>
          <>
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Customer</TableCell>
                      <TableCell>Last Activity</TableCell>
                      <TableCell align="right">Lifetime Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {listQuery.isLoading ? (
                      <TableSkeletonRows columns={3} />
                    ) : (listQuery.data?.items ?? []).map((customer) => (
                      <TableRow
                        key={customer.customerId}
                        hover
                        selected={customer.customerId === selectedCustomerId}
                        onClick={() => updateParams({ customerId: customer.customerId })}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell>
                          <Stack spacing={0.4}>
                            <Typography variant="body2" fontWeight={700}>{customer.fullName ?? customer.customerId}</Typography>
                            <Typography variant="caption" color="text.secondary">{customer.mobileNumber ?? customer.customerId}</Typography>
                            <Chip
                              label={statusLabels[customer.dormancyStatus]}
                              color={statusColors[customer.dormancyStatus]}
                              size="small"
                              variant="outlined"
                              sx={{ width: "fit-content" }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Stack spacing={0.4}>
                            <Typography variant="body2">{formatDate(customer.lastSeenDate)}</Typography>
                            <Typography variant="caption" color="text.secondary">{customer.daysSinceLastActivity} days</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="right">{formatCurrency(customer.lifetimeTransactionValue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={listQuery.data?.total ?? 0}
                page={page}
                onPageChange={(_, nextPage) => updateParams({ page: String(nextPage), customerId: undefined })}
                rowsPerPage={pageSize}
                onRowsPerPageChange={(event) => updateParams({ pageSize: event.target.value, page: undefined, customerId: undefined })}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </>
        </Paper>

        {detailQuery.isLoading ? (
          <Stack spacing={2} sx={{ order: 1 }}>
            <Paper sx={{ p: 2.2, ...glassPanelSx }}>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
                {Array.from({ length: 6 }).map((_, index) => (
                  <StatCardSkeleton key={index} />
                ))}
              </Box>
            </Paper>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
              <ChartSkeleton height={280} />
              <ChartSkeleton height={280} />
            </Box>
          </Stack>
        ) : detailQuery.data ? (
          <Stack spacing={2} sx={{ order: 1 }}>
            <Paper sx={{ p: 2.2, ...glassPanelSx }}>
              <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.4} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="h6" fontWeight={800}>
                    {detailQuery.data.customer.fullName ?? detailQuery.data.customer.customerId}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {detailQuery.data.customer.mobileNumber ?? detailQuery.data.customer.customerId}
                  </Typography>
                </Box>
                <Chip
                  label={statusLabels[detailQuery.data.customer.dormancyStatus]}
                  color={statusColors[detailQuery.data.customer.dormancyStatus]}
                  variant="outlined"
                  sx={{ width: "fit-content" }}
                />
              </Stack>
              <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
                <StatCard label="Period Value" value={formatCurrency(detailQuery.data.kpis.selectedPeriodTransactionValue)} icon={<CircleDollarSign size={20} />} />
                <StatCard label="Period Volume" value={formatCount(detailQuery.data.kpis.selectedPeriodTransactionVolume)} icon={<Receipt size={20} />} />
                <StatCard label="Period Commission" value={formatCurrency(detailQuery.data.kpis.selectedPeriodCommission)} icon={<CircleDollarSign size={20} />} />
                <StatCard label="Last 90 Value" value={formatCurrency(detailQuery.data.kpis.last90DayTransactionValue)} icon={<CalendarClock size={20} />} />
                <StatCard label="Average Tx Value" value={formatCurrency(detailQuery.data.kpis.averageTransactionValue)} icon={<UserCheck size={20} />} />
                <StatCard label="Lifetime Value" value={formatCurrency(detailQuery.data.customer.lifetimeTransactionValue)} icon={<UserRound size={20} />} />
              </Box>
            </Paper>

            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" } }}>
              <ChartCard
                title="Customer Value Trend"
                subtitle="Transaction value and commission over the selected period"
                onExpand={() => setFocusedChart("valueTrend")}
              >
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                  <ChartModeToggle mode={valueTrendMode} onChange={setValueTrendMode} />
                </Stack>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {valueTrendMode === "line" ? (
                      <LineChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="transactionValue" name="Value" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="commission" name="Commission" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="transactionValue" name="Value" fill={chartPalette.primary} />
                        <Bar dataKey="commission" name="Commission" fill={chartPalette.warning} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              </ChartCard>

              <ChartCard
                title="Deposit vs Withdrawal"
                subtitle="Deposit and withdrawal values over the selected period"
                onExpand={() => setFocusedChart("depositVs")}
              >
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                  <ChartModeToggle mode={depositVsMode} onChange={setDepositVsMode} />
                </Stack>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {depositVsMode === "bar" ? (
                      <BarChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="depositValue" name="Deposits" fill={chartPalette.primary} />
                        <Bar dataKey="withdrawalValue" name="Withdrawals" fill={chartPalette.warning} />
                      </BarChart>
                    ) : (
                      <LineChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="depositValue" name="Deposits" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="withdrawalValue" name="Withdrawals" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              </ChartCard>
            </Box>

            <Alert severity="info" icon={<CalendarClock size={16} />}>
              First seen: {formatDate(detailQuery.data.customer.firstSeenDate)}. Last seen: {formatDate(detailQuery.data.customer.lastSeenDate)}.
            </Alert>
          </Stack>
        ) : (
          <Alert severity="info" sx={{ order: 1 }}>Select a customer.</Alert>
        )}
      </Box>

      {detailQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusedChart === "valueTrend" ? "Customer Value Trend" : "Deposit vs Withdrawal"}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" } }}>
              <StatCard label="Period Value" value={formatCurrency(detailQuery.data.kpis.selectedPeriodTransactionValue)} />
              <StatCard label="Period Volume" value={formatCount(detailQuery.data.kpis.selectedPeriodTransactionVolume)} />
              <StatCard label="Period Commission" value={formatCurrency(detailQuery.data.kpis.selectedPeriodCommission)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "valueTrend" ? (
                <ChartModeToggle mode={valueTrendMode} onChange={setValueTrendMode} />
              ) : (
                <ChartModeToggle mode={depositVsMode} onChange={setDepositVsMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "valueTrend" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {valueTrendMode === "line" ? (
                      <LineChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="transactionValue" name="Value" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="commission" name="Commission" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="transactionValue" name="Value" fill={chartPalette.primary} />
                        <Bar dataKey="commission" name="Commission" fill={chartPalette.warning} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {depositVsMode === "bar" ? (
                      <BarChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="depositValue" name="Deposits" fill={chartPalette.primary} />
                        <Bar dataKey="withdrawalValue" name="Withdrawals" fill={chartPalette.warning} />
                      </BarChart>
                    ) : (
                      <LineChart data={detailQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="depositValue" name="Deposits" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="withdrawalValue" name="Withdrawals" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Daily detail</Typography>
              {detailQuery.data.dailyTrend.slice(-8).map((point) => (
                <Paper key={point.period} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{point.period}</Typography>
                    <Typography variant="body2">Value {formatCurrency(point.transactionValue)} | Deposits {formatCurrency(point.depositValue)} | Withdrawals {formatCurrency(point.withdrawalValue)}</Typography>
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
