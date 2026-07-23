import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart2,
  Bot,
  ChevronDown,
  ChevronUp,
  Filter,
  LineChart,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Area,
  Bar,
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
  DEFAULT_FILTERS,
  TRANSACTION_TYPES,
  VISA_SUBTYPES,
  fetchAiResponse,
  fetchFilteredData,
  fetchVisaMerchantDetails,
  fetchVisaMerchants,
  type AiResponse,
  type CRBFilters,
  type DailyRecord,
  type FilteredDataResponse,
  type VisaMerchant,
} from "../services/crbuilder";

// ── Helpers ───────────────────────────────────────────────────────────────

const CARD_SX = glassPanelSx;

const fmtUsd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
const fmtN = (n: number) => new Intl.NumberFormat("en-US").format(n);
const fmtK = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};

// ── KPI Card ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  dim = false,
}: {
  label: string;
  value: string;
  sub?: string;
  dim?: boolean;
}) {
  return (
    <Paper sx={{ p: 2.5, ...CARD_SX }}>
      <Typography
        variant="overline"
        sx={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "text.secondary", display: "block" }}
      >
        {label}
      </Typography>
      <Typography
        variant="h4"
        fontWeight={800}
        sx={{ my: 0.5, lineHeight: 1.1, color: dim ? "error.main" : "text.primary" }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      )}
    </Paper>
  );
}

// ── Filter Dialog ─────────────────────────────────────────────────────────

function FilterDialog({
  open,
  onClose,
  filters,
  onChange,
  onApply,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  filters: CRBFilters;
  onChange: (f: CRBFilters) => void;
  onApply: () => void;
  loading: boolean;
}) {
  const set = <K extends keyof CRBFilters>(key: K, val: CRBFilters[K]) =>
    onChange({ ...filters, [key]: val });

  function handleApply() {
    onApply();
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(10,36,22,0.18)",
          },
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
        <Typography variant="subtitle1" fontWeight={700} color="primary.main">
          Advanced Filters
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} pt={0.5}>
          {/* Transaction types */}
          <FormControl fullWidth size="small">
            <InputLabel>Transaction Types</InputLabel>
            <Select
              multiple
              value={filters.transactionTypes}
              onChange={(e) => set("transactionTypes", e.target.value as string[])}
              input={<OutlinedInput label="Transaction Types" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {(selected as string[]).map((v) => (
                    <Chip key={v} label={v} size="small" />
                  ))}
                </Box>
              )}
              MenuProps={{ PaperProps: { sx: { maxHeight: 260 } } }}
            >
              {TRANSACTION_TYPES.filter((t) => t !== "All").map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* VISA subtypes (conditional) */}
          {filters.transactionTypes.includes("VISA") && (
            <FormControl fullWidth size="small">
              <InputLabel>VISA Subtypes</InputLabel>
              <Select
                multiple
                value={filters.visaSubTypes}
                onChange={(e) => set("visaSubTypes", e.target.value as string[])}
                input={<OutlinedInput label="VISA Subtypes" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((v) => (
                      <Chip key={v} label={v} size="small" color="secondary" />
                    ))}
                  </Box>
                )}
              >
                {VISA_SUBTYPES.map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Date + Currency */}
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Date Range</InputLabel>
              <Select
                label="Date Range"
                value={filters.dateRange}
                onChange={(e) => set("dateRange", e.target.value as CRBFilters["dateRange"])}
              >
                <MenuItem value="day">Today</MenuItem>
                <MenuItem value="week">This Week</MenuItem>
                <MenuItem value="month">This Month</MenuItem>
                <MenuItem value="custom">Custom Range</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Currency</InputLabel>
              <Select
                label="Currency"
                value={filters.currency}
                onChange={(e) => set("currency", e.target.value as CRBFilters["currency"])}
              >
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="ZWL">ZWL</MenuItem>
                <MenuItem value="All">All</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Custom date range */}
          {filters.dateRange === "custom" && (
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
              <TextField
                size="small"
                label="From"
                type="date"
                value={filters.fromDate}
                onChange={(e) => set("fromDate", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                size="small"
                label="To"
                type="date"
                value={filters.toDate}
                onChange={(e) => set("toDate", e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
          )}

          {/* Amount filter */}
          <Box display="grid" gridTemplateColumns={filters.amountFilter !== "none" ? "1fr 1fr" : "1fr"} gap={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Amount Filter</InputLabel>
              <Select
                label="Amount Filter"
                value={filters.amountFilter}
                onChange={(e) => set("amountFilter", e.target.value as CRBFilters["amountFilter"])}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="greater">Greater Than</MenuItem>
                <MenuItem value="less">Less Than</MenuItem>
                <MenuItem value="equal">Equal To</MenuItem>
              </Select>
            </FormControl>
            {filters.amountFilter !== "none" && (
              <TextField
                size="small"
                label="Amount"
                type="number"
                value={filters.amountValue}
                onChange={(e) => set("amountValue", e.target.value)}
              />
            )}
          </Box>

          {/* Network providers */}
          {filters.transactionTypes.includes("Airtime Purchase") && (
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
                Network Providers
              </Typography>
              <Stack direction="row" spacing={1}>
                {["NETONE", "TELECEL", "ECONET"].map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    size="small"
                    variant={filters.networkProviders.includes(p) ? "filled" : "outlined"}
                    color={filters.networkProviders.includes(p) ? "primary" : "default"}
                    clickable
                    onClick={() =>
                      set(
                        "networkProviders",
                        filters.networkProviders.includes(p)
                          ? filters.networkProviders.filter((x) => x !== p)
                          : [...filters.networkProviders, p],
                      )
                    }
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Remittance providers */}
          {filters.transactionTypes.includes("Remittances") && (
            <Box>
              <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
                Remittance Providers
              </Typography>
              <Stack direction="row" spacing={1}>
                {["ZEAM", "HelloPaisa"].map((p) => (
                  <Chip
                    key={p}
                    label={p}
                    size="small"
                    variant={filters.remittanceProviders.includes(p) ? "filled" : "outlined"}
                    color={filters.remittanceProviders.includes(p) ? "primary" : "default"}
                    clickable
                    onClick={() =>
                      set(
                        "remittanceProviders",
                        filters.remittanceProviders.includes(p)
                          ? filters.remittanceProviders.filter((x) => x !== p)
                          : [...filters.remittanceProviders, p],
                      )
                    }
                  />
                ))}
              </Stack>
            </Box>
          )}

          {/* Apply */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleApply}
            disabled={loading || filters.transactionTypes.length === 0}
            sx={{ py: 1.5, fontSize: 13, borderRadius: 1.5 }}
          >
            {loading ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} color="inherit" />
                <span>LOADING…</span>
              </Stack>
            ) : (
              "APPLY FILTERS"
            )}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

// ── Trend chart ───────────────────────────────────────────────────────────

type Aggregation = "daily" | "weekly" | "monthly";

function aggregateData(records: DailyRecord[], mode: Aggregation) {
  const buckets = new Map<string, { value: number; volume: number; customers: number }>();
  for (const r of records) {
    const d = new Date(r.Date);
    let key: string;
    if (mode === "monthly") {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    } else if (mode === "weekly") {
      const day = d.getDay();
      const sun = new Date(d);
      sun.setDate(d.getDate() - day);
      key = sun.toISOString().slice(0, 10);
    } else {
      key = r.Date.slice(0, 10);
    }
    const prev = buckets.get(key) ?? { value: 0, volume: 0, customers: 0 };
    buckets.set(key, {
      value: prev.value + Number(r.TotalValue),
      volume: prev.volume + Number(r.TotalVolume),
      customers: prev.customers + Number(r.UniqueCustomers),
    });
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, v]) => ({ label: mode === "monthly" ? label : label.slice(5), ...v }));
}

function TrendChart({ data }: { data: FilteredDataResponse }) {
  const [agg, setAgg] = useState<Aggregation>("daily");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const chartData = useMemo(() => aggregateData(data.dailyData, agg), [data.dailyData, agg]);

  return (
    <Paper sx={{ p: 2.5, ...CARD_SX }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} mb={2}>
        <Typography variant="subtitle1" fontWeight={700}>
          Transaction Trends
        </Typography>
        <Stack direction="row" spacing={1}>
          {(["daily", "weekly", "monthly"] as Aggregation[]).map((a) => (
            <Button
              key={a}
              size="small"
              variant={agg === a ? "contained" : "outlined"}
              onClick={() => setAgg(a)}
              sx={{ minWidth: 0, px: 1.5, textTransform: "capitalize", fontSize: 11 }}
            >
              {a}
            </Button>
          ))}
          <Tooltip title="Bar chart">
            <IconButton size="small" onClick={() => setChartType("bar")} color={chartType === "bar" ? "primary" : "default"}>
              <BarChart2 size={15} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Line chart">
            <IconButton size="small" onClick={() => setChartType("line")} color={chartType === "line" ? "primary" : "default"}>
              <LineChart size={15} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="val" orientation="left" tick={{ fontSize: 10 }} tickFormatter={fmtK} />
          <YAxis yAxisId="vol" orientation="right" tick={{ fontSize: 10 }} tickFormatter={fmtK} />
          <ReTooltip
            formatter={(v, name) => [fmtN(v as number), name as string]}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {chartType === "bar" ? (
            <Bar yAxisId="val" dataKey="value" name="Total Value (USD)" fill={chartPalette.primary} maxBarSize={18} radius={[3, 3, 0, 0]} fillOpacity={0.85} />
          ) : (
            <Area yAxisId="val" dataKey="value" name="Total Value (USD)" stroke={chartPalette.primary} fill={chartPalette.primary} fillOpacity={0.1} strokeWidth={2} dot={false} />
          )}
          <Line yAxisId="vol" dataKey="volume" name="Volume" stroke="#c98b2c" strokeWidth={2} dot={false} />
          <Line yAxisId="vol" dataKey="customers" name="Unique Customers" stroke="#73c394" strokeWidth={2} strokeDasharray="4 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Paper>
  );
}

// ── Daily summary table ───────────────────────────────────────────────────

function DailySummaryTable({ data }: { data: DailyRecord[] }) {
  const [page, setPage] = useState(0);
  const rowsPerPage = 20;

  const grouped = useMemo(() => {
    const map = new Map<string, { date: string; customers: number; value: number; volume: number; fees: number; types: Set<string> }>();
    for (const r of data) {
      const key = r.Date.slice(0, 10);
      const prev = map.get(key) ?? { date: key, customers: 0, value: 0, volume: 0, fees: 0, types: new Set() };
      map.set(key, {
        date: key,
        customers: prev.customers + Number(r.UniqueCustomers),
        value: prev.value + Number(r.TotalValue),
        volume: prev.volume + Number(r.TotalVolume),
        fees: prev.fees + Number(r.TotalFees),
        types: prev.types.add(r.TransactionType),
      });
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  const pageData = grouped.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const totalPages = Math.ceil(grouped.length / rowsPerPage);

  return (
    <Paper sx={{ ...CARD_SX }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.5, pb: 1.5 }}>
        <Typography variant="subtitle1" fontWeight={700}>Daily Summary</Typography>
        <Chip label={`${grouped.length} days`} size="small" variant="outlined" color="primary" />
      </Stack>
      <Divider />
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell align="right">Unique Customers</TableCell>
              <TableCell align="right">Total Value</TableCell>
              <TableCell align="right">Volume</TableCell>
              <TableCell align="right">Fees</TableCell>
              <TableCell>Types</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageData.map((row) => (
              <TableRow key={row.date} hover>
                <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{row.date}</TableCell>
                <TableCell align="right">{fmtN(row.customers)}</TableCell>
                <TableCell align="right" sx={{ color: chartPalette.primary, fontWeight: 600 }}>{fmtUsd(row.value)}</TableCell>
                <TableCell align="right">{fmtN(row.volume)}</TableCell>
                <TableCell align="right">{fmtUsd(row.fees)}</TableCell>
                <TableCell sx={{ fontSize: 10, color: "text.secondary", maxWidth: 200 }}>
                  {Array.from(row.types).join(", ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {totalPages > 1 && (
        <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} sx={{ p: 1.5 }}>
          <IconButton size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronDown size={14} />
          </IconButton>
          <Typography variant="caption">Page {page + 1} of {totalPages}</Typography>
          <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            <ChevronUp size={14} />
          </IconButton>
        </Stack>
      )}
    </Paper>
  );
}

// ── Merchant detail panel ─────────────────────────────────────────────────

function MerchantDetailPanel({
  merchant,
  filters,
  onClose,
}: {
  merchant: VisaMerchant;
  filters: CRBFilters;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const q = useQuery({
    queryKey: ["crb-merchant", merchant.MerchantName, page, pageSize],
    queryFn: () => fetchVisaMerchantDetails({ merchantName: merchant.MerchantName, filters, page, pageSize }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "rgba(0,0,0,0.65)",
      }}
    >
      <Paper
        sx={{
          width: "90vw",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          ...CARD_SX,
          border: "1px solid rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>{merchant.MerchantName}</Typography>
            <Typography variant="caption" color="text.secondary">
              {fmtN(merchant.UniqueCustomers)} customers · {fmtN(merchant.TotalVolume)} txns · {fmtUsd(merchant.TotalValue)}
            </Typography>
          </Box>
          <IconButton onClick={onClose}><X size={18} /></IconButton>
        </Stack>

        <Box sx={{ overflowY: "auto", flex: 1, p: 2 }}>
          {q.isPending && <CircularProgress size={24} sx={{ display: "block", mx: "auto", mt: 4 }} />}
          {q.isError && <Alert severity="error">{getErrorMessage(q.error)}</Alert>}
          {q.data && (
            <>
              <Box display="grid" gridTemplateColumns="repeat(4,1fr)" gap={1.5} mb={2}>
                <KpiCard label="Unique Customers" value={fmtN(q.data.summary.UniqueCustomers)} />
                <KpiCard label="Total Volume" value={fmtN(q.data.summary.TotalVolume)} />
                <KpiCard label="Total Value" value={fmtUsd(q.data.summary.TotalValue)} />
                <KpiCard label="Total Fees" value={fmtUsd(q.data.summary.TotalFees)} dim />
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Account ID</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Net Fee</TableCell>
                      <TableCell align="right">Tax Fee</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {q.data.transactions.map((t, i) => (
                      <TableRow key={i} hover>
                        <TableCell sx={{ fontFamily: "monospace", fontSize: 11 }}>{t.AccountId}</TableCell>
                        <TableCell sx={{ fontSize: 12 }}>{t.TransactionDate?.slice(0, 10)}</TableCell>
                        <TableCell align="right" sx={{ color: chartPalette.primary, fontWeight: 600 }}>{fmtUsd(t.TransactionAmount)}</TableCell>
                        <TableCell align="right">{fmtUsd(t.NetFee)}</TableCell>
                        <TableCell align="right">{fmtUsd(t.TaxFee)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {q.data.pagination.totalPages > 1 && (
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ mt: 1.5 }}>
                  <FormControl size="small">
                    <Select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    >
                      {[10, 20, 50, 100].map((n) => <MenuItem key={n} value={n}>{n} / page</MenuItem>)}
                    </Select>
                  </FormControl>
                  <IconButton size="small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronDown size={14} />
                  </IconButton>
                  <Typography variant="caption">Page {page} of {q.data.pagination.totalPages}</Typography>
                  <IconButton size="small" disabled={page >= q.data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                    <ChevronUp size={14} />
                  </IconButton>
                </Stack>
              )}
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

// ── VISA merchants ────────────────────────────────────────────────────────

function VisaMerchantsSection({ filters }: { filters: CRBFilters }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState("TotalVolume");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("DESC");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedMerchant, setSelectedMerchant] = useState<VisaMerchant | null>(null);

  const q = useQuery({
    queryKey: ["crb-visa-merchants", filters, page, pageSize, sortBy, sortOrder, search],
    queryFn: () => fetchVisaMerchants({ filters, page, pageSize, sortBy, sortOrder, searchTerm: search }),
    staleTime: 5 * 60 * 1000,
    enabled: filters.transactionTypes.some((t) => t === "VISA" || t.startsWith("VISA")),
  });

  function toggleSort(field: string) {
    if (sortBy === field) setSortOrder((o) => (o === "DESC" ? "ASC" : "DESC"));
    else { setSortBy(field); setSortOrder("DESC"); }
  }

  const SortIcon = ({ field }: { field: string }) =>
    sortBy === field
      ? sortOrder === "DESC" ? <ChevronDown size={11} /> : <ChevronUp size={11} />
      : null;

  return (
    <Paper sx={{ ...CARD_SX }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ p: 2.5, pb: 1.5 }}
        flexWrap="wrap"
        gap={1}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>VISA Merchant Analytics</Typography>
          {q.data && (
            <Typography variant="caption" color="text.secondary">
              {fmtN(q.data.overallStats.totalMerchants)} merchants ·{" "}
              {fmtUsd(q.data.overallStats.totalValue)} total
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <TextField
            size="small"
            placeholder="Search merchant…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search size={13} /></InputAdornment> } }}
            sx={{ width: 180 }}
          />
          <Button size="small" variant="outlined" onClick={() => { setSearch(searchInput); setPage(1); }}>
            Search
          </Button>
        </Stack>
      </Stack>
      <Divider />

      {q.isPending && <Box sx={{ p: 3, textAlign: "center" }}><CircularProgress size={24} /></Box>}
      {q.isError && <Alert severity="error" sx={{ m: 2 }}>{getErrorMessage(q.error)}</Alert>}
      {q.data && (
        <>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {[
                    ["MerchantName", "Merchant"],
                    ["UniqueCustomers", "Customers"],
                    ["TotalVolume", "Volume"],
                    ["TotalValue", "Total Value"],
                    ["AvgTransactionValue", "Avg. Txn"],
                    ["TotalFees", "Fees"],
                  ].map(([field, label]) => (
                    <TableCell
                      key={field}
                      align={field === "MerchantName" ? "left" : "right"}
                      onClick={() => toggleSort(field)}
                      sx={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
                    >
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent={field === "MerchantName" ? "flex-start" : "flex-end"}
                        spacing={0.5}
                      >
                        <span>{label}</span>
                        <SortIcon field={field} />
                      </Stack>
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {q.data.merchants.map((m) => (
                  <TableRow
                    key={m.MerchantName}
                    hover
                    sx={{ cursor: "pointer" }}
                    onClick={() => setSelectedMerchant(m)}
                  >
                    <TableCell sx={{ color: chartPalette.primary, fontWeight: 600 }}>{m.MerchantName}</TableCell>
                    <TableCell align="right">{fmtN(m.UniqueCustomers)}</TableCell>
                    <TableCell align="right">{fmtN(m.TotalVolume)}</TableCell>
                    <TableCell align="right">{fmtUsd(m.TotalValue)}</TableCell>
                    <TableCell align="right">{fmtUsd(m.AvgTransactionValue)}</TableCell>
                    <TableCell align="right">{fmtUsd(m.TotalFees)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 1.5 }}
            flexWrap="wrap"
            gap={1}
          >
            <FormControl size="small">
              <Select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {[10, 20, 50, 100].map((n) => <MenuItem key={n} value={n}>{n} / page</MenuItem>)}
              </Select>
            </FormControl>
            <Stack direction="row" alignItems="center" spacing={1}>
              <IconButton size="small" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronDown size={14} />
              </IconButton>
              <Typography variant="caption">Page {page} of {q.data.pagination.totalPages}</Typography>
              <IconButton size="small" disabled={page >= q.data.pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronUp size={14} />
              </IconButton>
            </Stack>
          </Stack>
        </>
      )}

      {selectedMerchant && (
        <MerchantDetailPanel
          merchant={selectedMerchant}
          filters={filters}
          onClose={() => setSelectedMerchant(null)}
        />
      )}
    </Paper>
  );
}

// ── AI Command Bar ────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "ai" | "error";
  text: string;
}

function AiCommandBar({
  onFilterOpen,
  context,
  hasData,
}: {
  onFilterOpen: () => void;
  context: Record<string, unknown>;
  hasData: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: (query: string) => fetchAiResponse(query, context),
    onSuccess: (res: AiResponse) => {
      setMessages((m) => [...m, { role: "ai", text: res.message }]);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    },
    onError: (err) => {
      setMessages((m) => [...m, { role: "error", text: getErrorMessage(err) }]);
    },
  });

  function send() {
    const q = input.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    mutation.mutate(q);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const quickActions = [
    { label: "TOP VISA MERCHANTS", query: "Top VISA Merchants" },
    { label: "TOP TYPES", query: "Transaction breakdown by type" },
    { label: "AIRTIME", query: "Top airtime providers" },
  ];

  return (
    <Paper
      sx={{ ...CARD_SX, p: 2.5 }}
    >
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <Bot size={16} color={chartPalette.primary} />
        <Typography variant="caption" fontWeight={700} color="primary.main" letterSpacing={0.5}>
          AI Assistant
        </Typography>
        <Typography variant="caption" color="text.secondary">
          · {hasData ? "Ask about your filtered data" : "Apply filters to analyse your data"}
        </Typography>
      </Stack>

      {/* Chat history */}
      {messages.length > 0 && (
        <Box sx={{ maxHeight: 260, overflowY: "auto", mb: 2 }}>
          {messages.map((m, i) => (
            <Box
              key={i}
              sx={{
                mb: 1.5,
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Paper
                elevation={0}
                sx={{
                  px: 2,
                  py: 1,
                  maxWidth: "80%",
                  borderRadius: 2,
                  border: "none",
                  bgcolor:
                    m.role === "user"
                      ? chartPalette.primary
                      : m.role === "error"
                      ? "rgba(255,92,92,0.15)"
                      : "rgba(255,255,255,0.06)",
                  color: m.role === "user" ? "#000" : "text.primary",
                }}
              >
                <Typography variant="body2" sx={{ fontSize: 13, whiteSpace: "pre-wrap" }}>
                  {m.text}
                </Typography>
              </Paper>
            </Box>
          ))}
          {mutation.isPending && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 0.5 }}>
              <CircularProgress size={12} color="primary" />
              <Typography variant="caption" color="text.secondary">Thinking…</Typography>
            </Stack>
          )}
          <div ref={endRef} />
        </Box>
      )}

      {/* Quick actions (only when no messages) */}
      {messages.length === 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1} mb={2}>
          {quickActions.map(({ label, query }) => (
            <Chip
              key={label}
              label={label}
              size="small"
              variant="outlined"
              color="primary"
              clickable
              onClick={() => setInput(query)}
              sx={{ fontWeight: 700, fontSize: 10, letterSpacing: 0.8 }}
            />
          ))}
        </Stack>
      )}

      {/* Input row */}
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          fullWidth
          size="small"
          placeholder="Ask anything about your data..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={mutation.isPending}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={14} style={{ opacity: 0.4 }} />
                </InputAdornment>
              ),
              sx: { borderRadius: 2, fontSize: 13 },
            },
          }}
        />
        <Tooltip title="Send">
          <span>
            <IconButton onClick={send} disabled={!input.trim() || mutation.isPending} color="primary" size="small">
              <Send size={17} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Advanced Filters">
          <IconButton onClick={onFilterOpen} color="primary" size="small">
            <Filter size={17} />
          </IconButton>
        </Tooltip>
      </Stack>
    </Paper>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function CRBuilderPage() {
  const [filters, setFilters] = useState<CRBFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<CRBFilters | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const query = useMutation({ mutationFn: fetchFilteredData });
  const data = query.data;

  const kpis = useMemo(() => {
    if (!data) return null;
    const totalValue = data.dailyData.reduce((s, r) => s + Number(r.TotalValue), 0);
    const totalVolume = data.dailyData.reduce((s, r) => s + Number(r.TotalVolume), 0);
    const totalFees = data.dailyData.reduce((s, r) => s + Number(r.TotalFees), 0);
    const uniqueUsers = data.totalUniqueUsers.reduce((s, r) => s + Number(r.TotalUniqueUsers), 0);
    return { totalValue, totalVolume, totalFees, uniqueUsers };
  }, [data]);

  const aiContext = useMemo(() => {
    if (!kpis || !appliedFilters) return {};
    return {
      filters: appliedFilters,
      totalValue: kpis.totalValue,
      totalVolume: kpis.totalVolume,
      uniqueUsers: kpis.uniqueUsers,
      recordCount: data?.dailyData.length ?? 0,
    };
  }, [kpis, appliedFilters, data]);

  const handleApply = useCallback(() => {
    setAppliedFilters(filters);
    query.mutate(filters);
  }, [filters, query]);

  const hasVisa = appliedFilters?.transactionTypes.some((t) => t === "VISA" || t.startsWith("VISA")) ?? false;

  return (
    <section className="space-y-5 motion-fade-up">
      {/* Header */}
      <Box>
        <Typography variant="overline" color="text.secondary" fontWeight={700} display="block">
          Custom Report Builder
        </Typography>
        <Typography variant="h5" fontWeight={700} letterSpacing={-0.5}>
          O&apos;mari Transaction Analytics
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Filter, explore, and export transaction data across all types, providers, and date ranges
        </Typography>
      </Box>

      {/* KPI row */}
      <Box display="grid" gridTemplateColumns="repeat(4,1fr)" gap={1.5}>
        <KpiCard
          label="Total Unique Users"
          value={kpis ? fmtN(kpis.uniqueUsers) : "—"}
          sub="Deduplicated across period"
        />
        <KpiCard
          label="Total Value"
          value={kpis ? fmtUsd(kpis.totalValue) : "—"}
          sub={appliedFilters?.currency ?? "USD"}
        />
        <KpiCard
          label="Total Volume"
          value={kpis ? fmtN(kpis.totalVolume) : "—"}
          sub="Transaction count"
        />
        <KpiCard
          label="Total Fees"
          value={kpis ? fmtUsd(kpis.totalFees) : "—"}
          sub="Net + Tax fees"
          dim={!!kpis}
        />
      </Box>

      {/* Error */}
      {query.isError && (
        <Alert severity="error" icon={<AlertCircle size={18} />}>
          {getErrorMessage(query.error)}
        </Alert>
      )}

      {/* Trend chart */}
      {data && <TrendChart data={data} />}

      {/* Applied filter chips */}
      {appliedFilters && (
        <Stack direction="row" flexWrap="wrap" gap={0.5}>
          {appliedFilters.transactionTypes.map((t) => (
            <Chip key={t} label={t} size="small" color="primary" variant="outlined" sx={{ fontSize: 10 }} />
          ))}
          {appliedFilters.visaSubTypes.map((s) => (
            <Chip key={s} label={s} size="small" color="secondary" variant="outlined" sx={{ fontSize: 10 }} />
          ))}
          {appliedFilters.amountFilter !== "none" && (
            <Chip
              label={`Amount ${appliedFilters.amountFilter} ${appliedFilters.amountValue}`}
              size="small"
              variant="outlined"
              sx={{ fontSize: 10 }}
            />
          )}
        </Stack>
      )}

      {/* AI Command Bar — always visible */}
      <AiCommandBar
        onFilterOpen={() => setFilterOpen(true)}
        context={aiContext}
        hasData={!!data}
      />

      {/* Data sections */}
      {data && <DailySummaryTable data={data.dailyData} />}
      {appliedFilters && hasVisa && <VisaMerchantsSection filters={appliedFilters} />}

      {/* Filter dialog */}
      <FilterDialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        onApply={handleApply}
        loading={query.isPending}
      />
    </section>
  );
}
