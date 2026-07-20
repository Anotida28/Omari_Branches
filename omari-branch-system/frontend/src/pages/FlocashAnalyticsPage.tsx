import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  RefreshCw,
  Users,
  DollarSign,
  TrendingUp,
  XCircle,
  Satellite,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { chartPalette, glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import {
  fetchFlocashAnalytics,
  fetchResellerDetail,
  type FlocashReseller,
} from "../services/flocash-analytics";
import { ChartSkeleton } from "../shared/components/ChartSkeleton";
import { StatCard } from "../shared/components/StatCard";
import { StatCardSkeleton } from "../shared/components/StatCardSkeleton";

// ── Formatters ────────────────────────────────────────────────────────────

function fmtN(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtM(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Shared chart card ─────────────────────────────────────────────────────

function ChartCard({
  title,
  subtitle,
  children,
  minHeight = 280,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  minHeight?: number;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Paper sx={{ ...glassPanelSx, minHeight: open ? minHeight : "auto" }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        onClick={() => setOpen((v) => !v)}
        sx={{ px: 2.5, pt: 2.5, pb: open ? 0.5 : 2.5, cursor: "pointer", userSelect: "none" }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && !open && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {open ? <ChevronUp size={16} style={{ opacity: 0.5 }} /> : <ChevronDown size={16} style={{ opacity: 0.5 }} />}
      </Stack>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {subtitle}
            </Typography>
          )}
          {children}
        </Box>
      </Collapse>
    </Paper>
  );
}

// ── Inline expanded reseller detail ───────────────────────────────────────

function ResellerExpandedDetail({ reseller }: { reseller: FlocashReseller }) {
  const detailQuery = useQuery({
    queryKey: ["flocash", "reseller", reseller.accountId],
    queryFn: () => fetchResellerDetail(reseller.accountId),
    staleTime: 30 * 60 * 1000,
  });

  return (
    <Box sx={{ p: 2.5, bgcolor: "action.hover" }}>
      {/* Summary stat row */}
      <Stack direction="row" spacing={2} sx={{ mb: 2.5 }}>
        <Paper sx={{ p: 1.5, flex: 1, ...glassPanelSx }}>
          <Typography variant="overline" color="text.secondary" fontSize={10} fontWeight={700}>
            Successful FLOCASH
          </Typography>
          <Typography variant="h6" sx={{ color: "success.main" }}>
            {fmtN(reseller.successfulTxns)}
          </Typography>
          <Typography variant="caption" color="text.secondary">Last 365 days</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, flex: 1, ...glassPanelSx }}>
          <Typography variant="overline" color="text.secondary" fontSize={10} fontWeight={700}>
            Visa Failures
          </Typography>
          <Typography variant="h6" sx={{ color: "error.main" }}>
            {fmtN(reseller.failedTxns)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {reseller.successfulTxns + reseller.failedTxns > 0
              ? `${fmtPct((reseller.failedTxns / (reseller.successfulTxns + reseller.failedTxns)) * 100)} fail rate`
              : "—"}
          </Typography>
        </Paper>
        <Paper sx={{ p: 1.5, flex: 1, ...glassPanelSx }}>
          <Typography variant="overline" color="text.secondary" fontSize={10} fontWeight={700}>
            Total Paid (yr)
          </Typography>
          <Typography variant="h6">{fmtM(reseller.totalPaidYr)}</Typography>
          <Typography variant="caption" color="text.secondary">
            Peak month: {fmtM(reseller.peakMonthPayment)}
          </Typography>
        </Paper>
      </Stack>

      {/* Monthly chart + table side by side */}
      {detailQuery.isPending && <ChartSkeleton height={200} />}
      {detailQuery.isError && (
        <Alert severity="error">{getErrorMessage(detailQuery.error)}</Alert>
      )}
      {detailQuery.data && (
        <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={2}>
          <Box>
            <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: "block" }}>
              Monthly — Successful vs Failed
            </Typography>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={detailQuery.data.months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <ReTooltip
                  formatter={(value, name) => [value != null ? fmtN(value as number) : "—", name as string]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="successfulTxns" name="Successful" fill={chartPalette.primary} radius={[3, 3, 0, 0]} maxBarSize={18} />
                <Bar dataKey="failedTxns"     name="Failed"     fill={chartPalette.danger}  radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Box>
            <Typography variant="caption" fontWeight={700} sx={{ mb: 1, display: "block" }}>
              Monthly amounts paid
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Successful</TableCell>
                    <TableCell align="right">Failed</TableCell>
                    <TableCell align="right">Amount Paid</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailQuery.data.months.map((m) => (
                    <TableRow key={m.yearMonth} hover>
                      <TableCell>{m.label}</TableCell>
                      <TableCell align="right" sx={{ color: "success.main" }}>{fmtN(m.successfulTxns)}</TableCell>
                      <TableCell align="right" sx={{ color: "error.main" }}>{fmtN(m.failedTxns)}</TableCell>
                      <TableCell align="right">{fmtM(m.totalAmountPaid)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function FlocashAnalyticsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["flocash", "analytics"],
    queryFn: () => fetchFlocashAnalytics(false),
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  const analytics = query.data;

  // ── Derived chart data ────────────────────────────────────────────────

  const overlapData = analytics
    ? [
        {
          name: `FLOCASH (${fmtN(analytics.overlap.flocashTotal)})`,
          "FLOCASH only": analytics.overlap.flocashOnly,
          Both: analytics.overlap.both,
          "Starlink only": 0,
        },
        {
          name: `Starlink Direct (${fmtN(analytics.overlap.starlinkTotal)})`,
          "FLOCASH only": 0,
          Both: analytics.overlap.both,
          "Starlink only": analytics.overlap.starlinkOnly,
        },
      ]
    : [];

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <section className="space-y-5 motion-fade-up">
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
            <Satellite size={18} />
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
              Omari USD Visa · Source DB
            </Typography>
          </Stack>
          <Typography variant="h5" fontWeight={700} letterSpacing={-0.5}>
            FLOCASH Customer Intelligence
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            365-day analysis · FLOCASH Starlink proxy customers · omari_reporting.dbo.omzw_usd_sec_trans
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {analytics && (
            <Typography variant="caption" color="text.secondary">
              Generated {fmtTime(analytics.generatedAt)} · {(analytics.queryMs / 1000).toFixed(0)}s query
            </Typography>
          )}
          <Tooltip title="Force-refresh from source DB (takes 3–8 min)">
            <span>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshCw size={14} />}
                onClick={() => query.refetch()}
                disabled={query.isFetching}
              >
                {query.isFetching ? "Loading…" : "Refresh"}
              </Button>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {/* First load notice */}
      {query.isFetching && !analytics && (
        <Alert severity="info" icon={false}>
          First load queries the source database directly — this takes <strong>3–8 minutes</strong>.
          Subsequent loads use a 2-hour cache and return instantly.
        </Alert>
      )}

      {query.isError && (
        <Alert severity="error" icon={<AlertCircle size={18} />}>
          {getErrorMessage(query.error)}
        </Alert>
      )}

      {/* ── KPI row ── */}
      <Box display="grid" gridTemplateColumns="repeat(4,1fr)" gap={1.5}>
        {query.isPending ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : analytics ? (
          <>
            <StatCard
              label="FLOCASH Customers"
              value={fmtN(analytics.kpis.totalCustomers)}
              hint="Unique payers, last 365 days"
              icon={<Users size={20} />}
            />
            <StatCard
              label="Total Processed"
              value={fmtM(analytics.kpis.totalVolume)}
              hint="USD, successful transactions"
              icon={<DollarSign size={20} />}
            />
            <StatCard
              label="FLOCASH-Only"
              value={`${fmtN(analytics.kpis.flocashOnly)} (${fmtPct(analytics.kpis.flocashOnlyPct)})`}
              hint="No direct Starlink payments — invisible to SMS"
              icon={<TrendingUp size={20} />}
            />
            <StatCard
              label="Failed Attempts"
              value={fmtN(analytics.kpis.failedTxns)}
              hint={`Insufficient funds — ${fmtPct(analytics.kpis.failRate)} fail rate`}
              icon={<XCircle size={20} />}
            />
          </>
        ) : null}
      </Box>

      {/* ── Row 1: Overlap + Regularity ── */}
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={1.5}>
        {/* Overlap */}
        {query.isPending ? (
          <ChartSkeleton height={240} />
        ) : analytics ? (
          <ChartCard
            title="FLOCASH vs. Direct Starlink"
            subtitle="What share of FLOCASH payers also pay Starlink directly?"
            minHeight={240}
          >
            <ResponsiveContainer width="100%" height={168}>
              <BarChart layout="vertical" data={overlapData} margin={{ top: 4, right: 60, left: 0, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtN(v)} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <ReTooltip
                  formatter={(value, name) => [value != null ? fmtN(value as number) : "—", name as string]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="FLOCASH only" stackId="a" fill={chartPalette.primary}   maxBarSize={24} />
                <Bar dataKey="Both"         stackId="a" fill={chartPalette.secondary} maxBarSize={24} />
                <Bar dataKey="Starlink only" stackId="a" fill="#94a3b8"               maxBarSize={24} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        {/* Regularity */}
        {query.isPending ? (
          <ChartSkeleton height={240} />
        ) : analytics ? (
          <ChartCard
            title="Payment Regularity — Months Active"
            subtitle="How consistently each customer transacts through FLOCASH"
            minHeight={240}
          >
            <ResponsiveContainer width="100%" height={168}>
              <BarChart
                layout="vertical"
                data={analytics.regularity}
                margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => fmtN(v)} />
                <YAxis type="category" dataKey="band" width={110} tick={{ fontSize: 11 }} />
                <ReTooltip
                  formatter={(value) => [value != null ? fmtN(value as number) : "—", "Customers"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="customerCount" name="Customers" fill={chartPalette.primary} maxBarSize={22} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}
      </Box>

      {/* ── Row 2: Monthly trend (full width) ── */}
      {query.isPending ? (
        <ChartSkeleton height={280} />
      ) : analytics ? (
        <ChartCard
          title="Monthly Transaction Volume · Jul 2025 – Jul 2026"
          subtitle="Successful FLOCASH transactions (area) vs unique customers (dashed line)"
          minHeight={280}
        >
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={analytics.monthlyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}K`} />
              <ReTooltip
                formatter={(value, name) => [value != null ? fmtN(value as number) : "—", name as string]}
                contentStyle={{ fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="txnCount"
                name="Transactions"
                fill={chartPalette.primary}
                stroke={chartPalette.primary}
                fillOpacity={0.15}
                strokeWidth={2}
                dot={{ r: 4, fill: chartPalette.primary }}
                activeDot={{ r: 6 }}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="customerCount"
                name="Unique Customers"
                stroke={chartPalette.warning}
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : null}

      {/* ── Row 3: Tier clustering + 10-12 month cohort ── */}
      <Box display="grid" gridTemplateColumns={{ xs: "1fr", md: "1fr 1fr" }} gap={1.5}>
        {/* Tier clustering */}
        {query.isPending ? (
          <ChartSkeleton height={280} />
        ) : analytics ? (
          <ChartCard
            title="Amount Clustering at Starlink Price Points"
            subtitle="H1 Jul–Dec 2025 vs H2 Jan–Jul 2026 — confirms proxy theory"
            minHeight={280}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={analytics.tierClustering}
                margin={{ top: 8, right: 8, left: 0, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} vertical={false} />
                <XAxis dataKey="tier" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <ReTooltip
                  formatter={(value, name) => [value != null ? fmtN(value as number) : "—", name as string]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="h1TxnCount" name="H1 Jul–Dec 2025" fill={chartPalette.primary}   radius={[3, 3, 0, 0]} maxBarSize={20} />
                <Bar dataKey="h2TxnCount" name="H2 Jan–Jul 2026" fill={chartPalette.secondary} radius={[3, 3, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}

        {/* 10-12 month cohort */}
        {query.isPending ? (
          <ChartSkeleton height={280} />
        ) : analytics ? (
          <ChartCard
            title="10–12 Month Regulars: Monthly Spend Profile"
            subtitle="845 customers paid every month — spend level signals how many Starlink subs"
            minHeight={280}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                layout="vertical"
                data={analytics.cohort10to12}
                margin={{ top: 4, right: 60, left: 0, bottom: 4 }}
              >
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="band" width={106} tick={{ fontSize: 11 }} />
                <ReTooltip
                  formatter={(value) => [value != null ? fmtN(value as number) : "—", "Customers"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="customerCount" name="Customers" fill={chartPalette.primary} maxBarSize={22} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        ) : null}
      </Box>

      {/* ── Resellers table ── */}
      {query.isPending ? (
        <ChartSkeleton height={200} />
      ) : analytics && analytics.resellers.length > 0 ? (
        <Paper sx={{ ...glassPanelSx }}>
          <Box sx={{ p: 2.5, pb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Likely Resellers — avg ≥ $200/mo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Excluded from SMS targeting · Click any row to see their monthly success vs failure breakdown
                </Typography>
              </Box>
              <Chip label={`${analytics.resellers.length} accounts`} size="small" variant="outlined" />
            </Stack>
          </Box>
          <Divider />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Name / Mobile</TableCell>
                  <TableCell align="right">Active months</TableCell>
                  <TableCell align="right">Avg / mo</TableCell>
                  <TableCell align="right">Peak month</TableCell>
                  <TableCell align="right">Total paid (yr)</TableCell>
                  <TableCell align="right" sx={{ color: "success.main" }}>Successful</TableCell>
                  <TableCell align="right" sx={{ color: "error.main" }}>Failed</TableCell>
                  <TableCell align="right">Fail %</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {analytics.resellers.map((r) => {
                  const total = r.successfulTxns + r.failedTxns;
                  const failPct = total > 0 ? (r.failedTxns / total) * 100 : 0;
                  const nameOrMobile =
                    r.firstName || r.lastName
                      ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()
                      : r.mobileNr ?? "—";
                  const isExpanded = expandedId === r.accountId;
                  return (
                    <>
                      <TableRow
                        key={r.accountId}
                        hover
                        sx={{ cursor: "pointer", "& td": { borderBottom: isExpanded ? 0 : undefined } }}
                        onClick={() => setExpandedId(isExpanded ? null : r.accountId)}
                      >
                        <TableCell>
                          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
                            {r.accountId}
                          </Typography>
                        </TableCell>
                        <TableCell>{nameOrMobile}</TableCell>
                        <TableCell align="right">{r.activeMonths}</TableCell>
                        <TableCell align="right">{fmtM(r.avgMonthlyPayment)}</TableCell>
                        <TableCell align="right">{fmtM(r.peakMonthPayment)}</TableCell>
                        <TableCell align="right">{fmtM(r.totalPaidYr)}</TableCell>
                        <TableCell align="right" sx={{ color: "success.main" }}>{fmtN(r.successfulTxns)}</TableCell>
                        <TableCell align="right" sx={{ color: r.failedTxns > 0 ? "error.main" : "text.secondary" }}>
                          {fmtN(r.failedTxns)}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={fmtPct(failPct)}
                            size="small"
                            color={failPct > 40 ? "error" : failPct > 20 ? "warning" : "success"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} style={{ opacity: 0.4 }} />}
                        </TableCell>
                      </TableRow>
                      <TableRow key={`${r.accountId}-detail`}>
                        <TableCell colSpan={10} sx={{ p: 0, border: 0 }}>
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <ResellerExpandedDetail reseller={r} />
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ) : null}

    </section>
  );
}
