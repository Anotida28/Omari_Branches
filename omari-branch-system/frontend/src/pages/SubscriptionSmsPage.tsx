import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
} from "lucide-react";

import { glassPanelSx } from "../app/theme";
import { StatCard } from "../shared/components/StatCard";
import { StatCardSkeleton } from "../shared/components/StatCardSkeleton";
import {
  fetchSmsLog,
  fetchSmsPreview,
  type SmsPreviewEntry,
} from "../services/subscription-sms";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtUsd(n: number) {
  return `$${n.toFixed(2)}`;
}

const LANE_COLORS: Record<string, "primary" | "info" | "default"> = {
  "1":  "primary",
  "2A": "info",
};

const LANE_LABELS: Record<string, string> = {
  "1":  "L1 — Established",
  "2A": "L2A — New",
};

const SERVICE_COLORS = [
  "#0c5f3f", "#1e40af", "#7e22ce", "#be185d",
  "#b45309", "#0e7490", "#15803d", "#c2410c",
];

function serviceColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return SERVICE_COLORS[h % SERVICE_COLORS.length];
}

const KNOWN_SERVICES = [
  "Netflix", "Spotify", "Microsoft", "Apple", "Google", "Amazon",
  "Disney+", "DStv", "Showmax", "YouTube", "Canva", "Adobe",
  "OpenAI", "GitHub", "Dropbox", "Notion", "Zoom", "Slack",
  "LinkedIn", "Grammarly", "Duolingo", "Paramount+", "HBO Max",
  "PlayStation", "Audible", "Coursera", "Udemy", "Steam",
  "NordVPN", "ExpressVPN", "Figma", "Shopify", "Mailchimp",
];

// ── Sent Log Tab ──────────────────────────────────────────────────────────────

function SentLogTab() {
  const today        = toInputDate(new Date());
  const sevenDaysAgo = toInputDate(new Date(Date.now() - 7 * 86400_000));

  const [dateFrom,    setDateFrom]    = useState(sevenDaysAgo);
  const [dateTo,      setDateTo]      = useState(today);
  const [laneFilter,  setLaneFilter]  = useState("");
  const [svcFilter,   setSvcFilter]   = useState("");
  const [sentFilter,  setSentFilter]  = useState<"all" | "true" | "false">("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["subscription-sms-log", dateFrom, dateTo, laneFilter, svcFilter, sentFilter],
    queryFn: () =>
      fetchSmsLog({
        dateFrom,
        dateTo,
        lane:        laneFilter  || undefined,
        serviceName: svcFilter   || undefined,
        smsSent:     sentFilter === "all" ? undefined : sentFilter === "true",
      }),
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const entries = data?.entries ?? [];

  return (
    <Stack spacing={2.5}>
      {/* Filter bar */}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-start" flexWrap="wrap">
          <TextField
            label="From"
            type="date"
            size="small"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <Select
            size="small"
            value={laneFilter}
            onChange={e => setLaneFilter(e.target.value)}
            displayEmpty
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All lanes</MenuItem>
            <MenuItem value="1">Lane 1 — Established</MenuItem>
            <MenuItem value="2A">Lane 2A — New subscriber</MenuItem>
          </Select>
          <Select
            size="small"
            value={svcFilter}
            onChange={e => setSvcFilter(e.target.value)}
            displayEmpty
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All services</MenuItem>
            {KNOWN_SERVICES.map(s => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
          <Select
            size="small"
            value={sentFilter}
            onChange={e => setSentFilter(e.target.value as "all" | "true" | "false")}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="true">Sent ✓</MenuItem>
            <MenuItem value="false">Failed ✗</MenuItem>
          </Select>
          <Button
            variant="outlined"
            size="small"
            sx={{ height: 40 }}
            onClick={() => {
              setDateFrom(sevenDaysAgo);
              setDateTo(today);
              setLaneFilter("");
              setSvcFilter("");
              setSentFilter("all");
            }}
          >
            Reset
          </Button>
        </Stack>
      </Paper>

      {/* KPI tiles */}
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", xl: "repeat(5,1fr)" } }}>
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="SMS Sent"      value={summary ? String(summary.totalSent)        : "—"} hint="Successfully delivered" icon={<CheckCircle2 size={20} />} />
            <StatCard label="Failed"        value={summary ? String(summary.totalFailed)       : "—"} hint="Gateway errors" icon={<AlertCircle size={20} />} />
            <StatCard label="Success Rate"  value={summary ? `${summary.successRate}%`         : "—"} hint="Sent vs total attempts" />
            <StatCard label="Top Service"   value={summary ? summary.topService                : "—"} hint="Most SMS sent to" />
            <StatCard label="$ at Risk"     value={summary ? fmtUsd(summary.totalTopUpValueAtRisk) : "—"} hint="Sum of all top-up amounts" />
          </>
        )}
      </Box>

      {/* Table */}
      {isError && (
        <Alert severity="error">Failed to load SMS log. Check backend connection.</Alert>
      )}
      {!isLoading && !isError && entries.length === 0 && (
        <Paper variant="outlined" sx={{ p: 5, textAlign: "center", borderStyle: "dashed", borderRadius: 2 }}>
          <MessageSquare size={36} style={{ color: "#9ca3af", margin: "0 auto 12px" }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary">No records found</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            No SMS have been sent matching the current filters.
          </Typography>
        </Paper>
      )}
      {entries.length > 0 && (
        <Paper sx={{ ...glassPanelSx }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.5, pt: 2.2, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              SMS Log
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Showing {entries.length} of {data?.total ?? entries.length} records
            </Typography>
          </Stack>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Sent At</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Mobile</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Service</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Lane</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Sub $</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Fee $</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Total $</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Balance $</TableCell>
                  <TableCell sx={{ fontWeight: 700, textAlign: "right" }}>Top-up $</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>Due Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtDateTime(row.sentAt)}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>{row.mobileNr}</TableCell>
                    <TableCell>
                      <Chip
                        label={row.serviceName}
                        size="small"
                        sx={{
                          bgcolor: serviceColor(row.serviceName),
                          color: "#fff",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={row.lane}
                        size="small"
                        color={LANE_COLORS[row.lane] ?? "default"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12 }}>{fmtUsd(row.subscriptionAmount)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12 }}>{fmtUsd(row.feeAmount)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>{fmtUsd(row.totalNeeded)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12 }}>{fmtUsd(row.currentBalance)}</TableCell>
                    <TableCell align="right" sx={{ fontFamily: "monospace", fontSize: 12, color: "#b45309", fontWeight: 700 }}>{fmtUsd(row.topUpAmount)}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(row.predictedChargeDate)}</TableCell>
                    <TableCell>
                      {row.smsSent ? (
                        <Chip label="Sent" size="small" color="success" variant="outlined" icon={<CheckCircle2 size={12} />} />
                      ) : (
                        <Tooltip title={row.smsError ?? "Send failed"}>
                          <Chip label="Failed" size="small" color="error" variant="outlined" icon={<AlertCircle size={12} />} />
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Stack>
  );
}

// ── Preview Tab ───────────────────────────────────────────────────────────────

function PreviewEntryCard({ entry }: { entry: SmsPreviewEntry }) {
  const color = LANE_COLORS[entry.lane] ?? "default";
  const dateStr = entry.predictedChargeDate
    ? fmtDate(entry.predictedChargeDate)
    : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1.5}>
        <Stack spacing={0.6} flex={1} minWidth={0}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Chip
              label={entry.serviceName}
              size="small"
              sx={{ bgcolor: serviceColor(entry.serviceName), color: "#fff", fontWeight: 600, fontSize: 11 }}
            />
            <Chip label={LANE_LABELS[entry.lane] ?? entry.lane} size="small" color={color} variant="outlined" />
            {dateStr && (
              <Typography variant="caption" color="text.secondary">
                Due {dateStr}
                {entry.daysUntilCharge !== null && ` (${entry.daysUntilCharge}d)`}
              </Typography>
            )}
          </Stack>
          <Typography variant="body2" fontWeight={600}>{entry.customerName}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
            {entry.mobileNr}
          </Typography>
          <Box
            sx={{
              mt: 0.8,
              p: 1.2,
              bgcolor: "rgba(12,95,63,0.06)",
              borderRadius: 1.5,
              border: "1px solid rgba(12,95,63,0.14)",
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block" mb={0.3} fontWeight={600}>
              SMS text:
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 12.5 }}>
              {entry.message}
            </Typography>
          </Box>
        </Stack>
        <Stack spacing={0.5} alignItems={{ xs: "flex-start", sm: "flex-end" }} minWidth={110} flexShrink={0}>
          <Typography variant="caption" color="text.secondary">Sub</Typography>
          <Typography variant="body2" fontFamily="monospace">{fmtUsd(entry.subscriptionAmount)}</Typography>
          <Typography variant="caption" color="text.secondary" mt={0.5}>Fee</Typography>
          <Typography variant="body2" fontFamily="monospace">{fmtUsd(entry.feeAmount)}</Typography>
          <Typography variant="caption" color="text.secondary" mt={0.5}>Total needed</Typography>
          <Typography variant="body2" fontWeight={700} fontFamily="monospace">{fmtUsd(entry.totalNeeded)}</Typography>
          <Typography variant="caption" color="text.secondary" mt={0.5}>Balance</Typography>
          <Typography variant="body2" fontFamily="monospace">{fmtUsd(entry.currentBalance)}</Typography>
          <Divider sx={{ width: "100%", my: 0.5 }} />
          <Typography variant="caption" color="text.secondary">Top-up needed</Typography>
          <Typography variant="body2" fontWeight={700} fontFamily="monospace" color="#b45309">
            {fmtUsd(entry.topUpAmount)}
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

function PreviewTab() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["subscription-sms-preview"],
    queryFn:  fetchSmsPreview,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const [elapsed, setElapsed] = useState(0);
  const fetchStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (isFetching) {
      fetchStartRef.current = Date.now();
      setElapsed(0);
      const id = setInterval(() => {
        setElapsed(Math.floor((Date.now() - (fetchStartRef.current ?? Date.now())) / 1000));
      }, 1000);
      return () => clearInterval(id);
    }
  }, [isFetching]);

  const [laneFilter, setLaneFilter] = useState("");
  const [svcFilter,  setSvcFilter]  = useState("");

  const entries = (data?.entries ?? []).filter(e => {
    if (laneFilter && e.lane !== laneFilter)         return false;
    if (svcFilter  && e.serviceName !== svcFilter)   return false;
    return true;
  });

  const serviceBreakdown = data
    ? Object.entries(data.byService).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <Stack spacing={2.5}>
      {/* Controls */}
      <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
        <Button
          variant="outlined"
          startIcon={isFetching ? <CircularProgress size={13} /> : <RefreshCw size={13} />}
          disabled={isFetching}
          onClick={() => queryClient.invalidateQueries({ queryKey: ["subscription-sms-preview"] })}
        >
          {isFetching ? "Running query…" : "Refresh Preview"}
        </Button>
        {isFetching && elapsed > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
            ⏱ {elapsed}s elapsed…
          </Typography>
        )}
        {dataUpdatedAt > 0 && !isFetching && data && (
          <Typography variant="caption" color="text.secondary">
            Generated in {(data.generationMs / 1000).toFixed(1)}s · {fmtDateTime(new Date(dataUpdatedAt).toISOString())}
          </Typography>
        )}
      </Stack>

      {/* Loading state */}
      {isLoading && (
        <Paper variant="outlined" sx={{ p: 6, textAlign: "center", borderRadius: 2 }}>
          <CircularProgress size={32} sx={{ mb: 2 }} />
          <Typography variant="body1" fontWeight={600}>Running source DB query…</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5} sx={{ fontVariantNumeric: "tabular-nums" }}>
            {elapsed > 0 ? `${elapsed}s elapsed` : "Starting…"}
          </Typography>
        </Paper>
      )}

      {isError && !isLoading && (
        <Alert severity="error">Failed to generate preview. Check source DB connectivity and try again.</Alert>
      )}

      {data && !isLoading && (
        <>
          {/* KPI tiles */}
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", xl: "repeat(4,1fr)" } }}>
            <StatCard label="SMS to Send"      value={String(data.totalToSend)}      hint="Next scheduled run" icon={<MessageSquare size={20} />} />
            <StatCard label="Lane 1"  value={String(data.lane1Count)}  hint="Established — due in 1–3 days" />
            <StatCard label="Lane 2A" value={String(data.lane2aCount)} hint="New subscriber — predicted window" />
          </Box>

          {/* Service breakdown */}
          {serviceBreakdown.length > 0 && (
            <Paper sx={{ p: 2.2, ...glassPanelSx }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1.2}>By Service</Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {serviceBreakdown.map(([svc, count]) => (
                  <Chip
                    key={svc}
                    label={`${svc} · ${count}`}
                    size="small"
                    sx={{
                      bgcolor: serviceColor(svc),
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                    onClick={() => setSvcFilter(svcFilter === svc ? "" : svc)}
                    variant={svcFilter === svc ? "filled" : "filled"}
                    style={{ opacity: svcFilter && svcFilter !== svc ? 0.45 : 1 }}
                  />
                ))}
              </Stack>
              <Typography variant="caption" color="text.secondary" mt={1} display="block">
                Total top-up needed across all customers: <strong>${data.totalTopUpNeeded.toFixed(2)}</strong>
                {" · "}
                {data.sufficientBalanceSkipped} customers skipped (sufficient balance)
              </Typography>
            </Paper>
          )}

          {/* Entry filters */}
          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
            <Select
              size="small"
              value={laneFilter}
              onChange={e => setLaneFilter(e.target.value)}
              displayEmpty
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All lanes</MenuItem>
              <MenuItem value="1">Lane 1 — Established</MenuItem>
              <MenuItem value="2A">Lane 2A — New subscriber</MenuItem>
            </Select>
            {laneFilter || svcFilter ? (
              <Button size="small" variant="outlined" onClick={() => { setLaneFilter(""); setSvcFilter(""); }}>
                Clear filters
              </Button>
            ) : null}
            <Typography variant="caption" color="text.secondary">
              Showing {entries.length} of {data.totalToSend}
            </Typography>
          </Stack>

          {/* Entry cards */}
          <Stack spacing={1.5}>
            {entries.map((entry, i) => (
              <PreviewEntryCard key={`${entry.mobileNr}-${entry.serviceName}-${i}`} entry={entry} />
            ))}
          </Stack>
        </>
      )}
    </Stack>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubscriptionSmsPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2.5} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Subscription SMS</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Track SMS reminders sent to wallet customers with upcoming or failed subscription payments.
          </Typography>
        </Box>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ mb: 2.5, borderBottom: "1px solid rgba(0,0,0,0.1)" }}
      >
        <Tab label="Sent Log" />
        <Tab label="Tomorrow's Preview" />
      </Tabs>

      {tab === 0 && <SentLogTab />}
      {tab === 1 && <PreviewTab />}
    </Box>
  );
}
