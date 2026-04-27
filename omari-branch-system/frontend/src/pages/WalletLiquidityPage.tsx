import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, Gauge, Landmark, Percent, WalletCards } from "lucide-react";
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
import { formatCurrency, formatDate } from "../services/format";
import { fetchWalletLiquidity } from "../services/wallet";
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

export default function WalletLiquidityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusedChart, setFocusedChart] = useState<"efloat" | "risk" | "product" | null>(null);
  const [efloatMode, setEfloatMode] = useState<ChartMode>("line");
  const [riskMode, setRiskMode] = useState<ChartMode>("bar");
  const [productMode, setProductMode] = useState<ChartMode>("bar");

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

  const liquidityQuery = useQuery({
    queryKey: ["wallet", "liquidity", { dateFrom, dateTo, currency }],
    queryFn: () => fetchWalletLiquidity({ dateFrom, dateTo, asOfDate: dateTo, currency }),
  });

  const focusTitle =
    focusedChart === "efloat" ? "E-Float Trend"
    : focusedChart === "risk" ? "Liquidity Risk"
    : "Product Balance Mix";

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

      {liquidityQuery.isError ? <Alert severity="error">{getErrorMessage(liquidityQuery.error)}</Alert> : null}

      {liquidityQuery.isLoading ? (
        <Alert severity="info">Loading wallet liquidity...</Alert>
      ) : liquidityQuery.data ? (
        <>
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" } }}>
            <StatCard label="Latest E-Float" value={formatCurrency(liquidityQuery.data.kpis.latestTotalEFloat)} icon={<WalletCards size={20} />} />
            <StatCard label="Low-Balance Accounts" value={formatCount(liquidityQuery.data.kpis.lowBalanceAccounts)} icon={<AlertTriangle size={20} />} />
            <StatCard label="Average Balance" value={formatCurrency(liquidityQuery.data.kpis.averageBalance)} icon={<Gauge size={20} />} />
            <StatCard label="Top 10% Concentration" value={formatPercent(liquidityQuery.data.kpis.top10BalanceConcentration)} icon={<Percent size={20} />} />
            <StatCard label="Median Balance" value={formatCurrency(liquidityQuery.data.kpis.medianBalance)} icon={<Landmark size={20} />} />
            <StatCard label="Account Count" value={formatCount(liquidityQuery.data.kpis.accountCount)} icon={<WalletCards size={20} />} />
            <StatCard label="Zero or Negative" value={formatCount(liquidityQuery.data.kpis.zeroOrNegativeAccounts)} icon={<AlertTriangle size={20} />} />
            <StatCard
              label="Snapshot Date"
              value={liquidityQuery.data.kpis.latestEFloatDate ? formatDate(liquidityQuery.data.kpis.latestEFloatDate) : "N/A"}
              icon={<CalendarClock size={20} />}
            />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "1.35fr 1fr" } }}>
            <ChartCard
              title="E-Float Trend"
              subtitle="Total e-float and average balance over the selected period"
              onExpand={() => setFocusedChart("efloat")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={efloatMode} onChange={setEfloatMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {efloatMode === "line" ? (
                    <LineChart data={liquidityQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="totalEFloat" name="Total E-Float" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="averageBalance" name="Average Balance" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                    </LineChart>
                  ) : (
                    <BarChart data={liquidityQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Legend />
                      <Bar dataKey="totalEFloat" name="Total E-Float" fill={chartPalette.primary} />
                      <Bar dataKey="averageBalance" name="Average Balance" fill={chartPalette.secondary} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>

            <ChartCard
              title="Liquidity Risk"
              subtitle="Low-balance and zero-or-negative accounts over the selected period"
              onExpand={() => setFocusedChart("risk")}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <ChartModeToggle mode={riskMode} onChange={setRiskMode} />
              </Stack>
              <Box sx={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {riskMode === "bar" ? (
                    <BarChart data={liquidityQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="lowBalanceAccounts" name="Low Balance" fill={chartPalette.warning} />
                      <Bar dataKey="zeroOrNegativeAccounts" name="Zero or Negative" fill={chartPalette.danger} />
                    </BarChart>
                  ) : (
                    <LineChart data={liquidityQuery.data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                      <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="lowBalanceAccounts" name="Low Balance" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="zeroOrNegativeAccounts" name="Zero or Negative" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              </Box>
            </ChartCard>
          </Box>

          <ChartCard
            title="Product Balance Mix"
            subtitle="E-float distribution across account products"
            onExpand={() => setFocusedChart("product")}
          >
            <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
              <ChartModeToggle mode={productMode} onChange={setProductMode} />
            </Stack>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                {productMode === "bar" ? (
                  <BarChart data={liquidityQuery.data.productBreakdown} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="accountProduct" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="totalEFloat" name="Total E-Float" fill={chartPalette.primary} />
                  </BarChart>
                ) : (
                  <LineChart data={liquidityQuery.data.productBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                    <XAxis dataKey="accountProduct" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="totalEFloat" name="Total E-Float" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </Box>
          </ChartCard>

          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            {liquidityQuery.data.productBreakdown.slice(0, 6).map((product) => (
              <Paper key={product.accountProduct} variant="outlined" sx={{ p: 1.4, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                <Stack spacing={0.4}>
                  <Typography variant="subtitle2" fontWeight={700}>{product.accountProduct}</Typography>
                  <Typography variant="body2">E-Float: {formatCurrency(product.totalEFloat)}</Typography>
                  <Typography variant="body2">Accounts: {formatCount(product.accountCount)}</Typography>
                  <Typography variant="body2">Low Balance: {formatCount(product.lowBalanceAccounts)}</Typography>
                </Stack>
              </Paper>
            ))}
          </Box>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(liquidityQuery.data.period.dateFrom)} to {formatDate(liquidityQuery.data.period.dateTo)}.
            Low-balance threshold: {formatCurrency(liquidityQuery.data.metadata.lowBalanceThreshold)}.
          </Alert>
        </>
      ) : null}

      {liquidityQuery.data ? (
        <FocusDialog
          open={focusedChart !== null}
          onClose={() => setFocusedChart(null)}
          title={focusTitle}
          subtitle="Expanded view with larger canvas and the same selected date range."
        >
          <Stack spacing={2}>
            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
              <StatCard label="Latest E-Float" value={formatCurrency(liquidityQuery.data.kpis.latestTotalEFloat)} />
              <StatCard label="Low-Balance" value={formatCount(liquidityQuery.data.kpis.lowBalanceAccounts)} />
              <StatCard label="Average Balance" value={formatCurrency(liquidityQuery.data.kpis.averageBalance)} />
              <StatCard label="Median Balance" value={formatCurrency(liquidityQuery.data.kpis.medianBalance)} />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              {focusedChart === "efloat" ? (
                <ChartModeToggle mode={efloatMode} onChange={setEfloatMode} />
              ) : focusedChart === "risk" ? (
                <ChartModeToggle mode={riskMode} onChange={setRiskMode} />
              ) : (
                <ChartModeToggle mode={productMode} onChange={setProductMode} />
              )}
            </Stack>

            <Paper sx={{ p: 2, ...glassPanelSx }}>
              {focusedChart === "efloat" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {efloatMode === "line" ? (
                      <LineChart data={liquidityQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="totalEFloat" name="Total E-Float" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="averageBalance" name="Average Balance" stroke={chartPalette.secondary} strokeWidth={2} dot={false} />
                      </LineChart>
                    ) : (
                      <BarChart data={liquidityQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="totalEFloat" name="Total E-Float" fill={chartPalette.primary} />
                        <Bar dataKey="averageBalance" name="Average Balance" fill={chartPalette.secondary} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : focusedChart === "risk" ? (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {riskMode === "bar" ? (
                      <BarChart data={liquidityQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="lowBalanceAccounts" name="Low Balance" fill={chartPalette.warning} />
                        <Bar dataKey="zeroOrNegativeAccounts" name="Zero or Negative" fill={chartPalette.danger} />
                      </BarChart>
                    ) : (
                      <LineChart data={liquidityQuery.data.dailyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="lowBalanceAccounts" name="Low Balance" stroke={chartPalette.warning} strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="zeroOrNegativeAccounts" name="Zero or Negative" stroke={chartPalette.danger} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              ) : (
                <Box sx={{ height: "68vh" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {productMode === "bar" ? (
                      <BarChart data={liquidityQuery.data.productBreakdown} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="accountProduct" tick={{ fontSize: 11 }} width={150} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Bar dataKey="totalEFloat" name="Total E-Float" fill={chartPalette.primary} />
                      </BarChart>
                    ) : (
                      <LineChart data={liquidityQuery.data.productBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                        <XAxis dataKey="accountProduct" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Legend />
                        <Line type="monotone" dataKey="totalEFloat" name="Total E-Float" stroke={chartPalette.primary} strokeWidth={2} dot={false} />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </Box>
              )}
            </Paper>

            <Divider />

            <Stack spacing={1.2}>
              <Typography variant="subtitle2" fontWeight={700}>Product detail</Typography>
              {liquidityQuery.data.productBreakdown.slice(0, 6).map((product) => (
                <Paper key={product.accountProduct} variant="outlined" sx={{ p: 1.5 }}>
                  <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={1}>
                    <Typography variant="body2" fontWeight={700}>{product.accountProduct}</Typography>
                    <Typography variant="body2">E-Float {formatCurrency(product.totalEFloat)} | Accounts {formatCount(product.accountCount)} | Low Balance {formatCount(product.lowBalanceAccounts)}</Typography>
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
