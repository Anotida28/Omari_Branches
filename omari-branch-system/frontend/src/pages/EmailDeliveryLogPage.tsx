import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Chip,
  MenuItem,
  Paper,
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
import { AlertCircle, CheckCircle2, Mail, MinusCircle, Send } from "lucide-react";
import { Link } from "react-router-dom";

import { Pagination } from "../components/ui/Pagination";
import { listEmailLogs } from "../services/email-logs";
import { formatDateTime } from "../services/format";
import { StatCard } from "../shared/components/StatCard";
import { EmptyState } from "../shared/components/EmptyState";
import { TableSkeletonRows } from "../shared/components/TableSkeletonRows";
import type { EmailLogListParams, EmailLogStatus, EmailLogType } from "../types/api";

const TYPE_LABELS: Record<EmailLogType, string> = {
  CUSTOM_REPORT: "Custom Report",
  DAILY_BRANCH_REPORT: "Branch Report",
  DAILY_WALLET_REPORT: "Wallet Report",
  REMINDER: "Reminder",
};

const TYPE_COLORS: Record<EmailLogType, "primary" | "secondary" | "info" | "warning"> = {
  CUSTOM_REPORT: "info",
  DAILY_BRANCH_REPORT: "primary",
  DAILY_WALLET_REPORT: "secondary",
  REMINDER: "warning",
};

function StatusChip({ status }: { status: EmailLogStatus }) {
  if (status === "SENT") {
    return (
      <Chip
        icon={<CheckCircle2 size={13} />}
        label="Sent"
        size="small"
        color="success"
        variant="outlined"
        sx={{ fontWeight: 600 }}
      />
    );
  }
  if (status === "FAILED") {
    return (
      <Chip
        icon={<AlertCircle size={13} />}
        label="Failed"
        size="small"
        color="error"
        variant="outlined"
        sx={{ fontWeight: 600 }}
      />
    );
  }
  return (
    <Chip
      icon={<MinusCircle size={13} />}
      label="Skipped"
      size="small"
      color="default"
      variant="outlined"
      sx={{ fontWeight: 600 }}
    />
  );
}

const PAGE_SIZE = 20;

export default function EmailDeliveryLogPage() {
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EmailLogListParams>({
    dateFrom: thirtyDaysAgo,
    dateTo: today,
    emailType: "",
    status: "",
    sentTo: "",
  });

  const logsQuery = useQuery({
    queryKey: ["email-logs", filters, page],
    queryFn: () => listEmailLogs({ ...filters, page, pageSize: PAGE_SIZE }),
  });

  const todayStatsQuery = useQuery({
    queryKey: ["email-logs-today"],
    queryFn: () => listEmailLogs({ dateFrom: today, dateTo: today, pageSize: 1000 }),
  });

  const todayItems = todayStatsQuery.data?.items ?? [];
  const todaySent = todayItems.filter((i) => i.status === "SENT").length;
  const todayFailed = todayItems.filter((i) => i.status === "FAILED").length;
  const todaySkipped = todayItems.filter((i) => i.status === "SKIPPED").length;

  const applyFilter = (key: keyof EmailLogListParams, value: string) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const items = logsQuery.data?.items ?? [];
  const total = logsQuery.data?.total ?? 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Email Delivery Log</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            A record of every report email and alert the system has sent or attempted to send.
          </Typography>
        </Box>
      </Stack>

      {/* Today stats */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={3}>
        <StatCard
          label="Sent Today"
          value={todayStatsQuery.isLoading ? "—" : String(todaySent)}
          hint="Successfully delivered"
          icon={<Send size={18} />}
        />
        <StatCard
          label="Failed Today"
          value={todayStatsQuery.isLoading ? "—" : String(todayFailed)}
          hint={todayFailed > 0 ? "Check errors below" : "No failures"}
          icon={<AlertCircle size={18} />}
        />
        <StatCard
          label="Skipped Today"
          value={todayStatsQuery.isLoading ? "—" : String(todaySkipped)}
          hint="Already sent or no data"
          icon={<MinusCircle size={18} />}
        />
        <StatCard
          label="Total in Period"
          value={logsQuery.isLoading ? "—" : String(total)}
          hint="Matching current filters"
          icon={<Mail size={18} />}
        />
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} flexWrap="wrap">
          <TextField
            label="From"
            type="date"
            size="small"
            value={filters.dateFrom ?? ""}
            onChange={(e) => applyFilter("dateFrom", e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={filters.dateTo ?? ""}
            onChange={(e) => applyFilter("dateTo", e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 150 }}
          />
          <TextField
            select
            label="Type"
            size="small"
            value={filters.emailType ?? ""}
            onChange={(e) => applyFilter("emailType", e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="CUSTOM_REPORT">Custom Report</MenuItem>
            <MenuItem value="DAILY_BRANCH_REPORT">Branch Report</MenuItem>
            <MenuItem value="DAILY_WALLET_REPORT">Wallet Report</MenuItem>
            <MenuItem value="REMINDER">Reminder</MenuItem>
          </TextField>
          <TextField
            select
            label="Status"
            size="small"
            value={filters.status ?? ""}
            onChange={(e) => applyFilter("status", e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="SENT">Sent</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="SKIPPED">Skipped</MenuItem>
          </TextField>
          <TextField
            label="Search email"
            size="small"
            value={filters.sentTo ?? ""}
            onChange={(e) => applyFilter("sentTo", e.target.value)}
            placeholder="e.g. user@omari.co.zw"
            sx={{ minWidth: 220 }}
          />
        </Stack>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "#f8fafc" }}>
              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Date / Time</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Recipient</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Subject</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logsQuery.isLoading ? (
              <TableSkeletonRows columns={5} rows={8} />
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    title="No email records found"
                    description="Try adjusting the date range or filters."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {formatDateTime(log.sentAt)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={TYPE_LABELS[log.emailType] ?? log.emailType}
                      size="small"
                      color={TYPE_COLORS[log.emailType] ?? "default"}
                      variant="outlined"
                      sx={{ fontSize: 11, fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>{log.sentTo}</TableCell>
                  <TableCell sx={{ fontSize: 12, maxWidth: 320 }}>
                    <Tooltip title={log.subject} placement="top-start">
                      <Box
                        component="span"
                        sx={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.subject}
                      </Box>
                    </Tooltip>
                    {log.errorMessage && (
                      <Typography fontSize={11} color="error.main" mt={0.3}>
                        {log.errorMessage}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip status={log.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {total > PAGE_SIZE && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <Typography variant="caption" color="text.secondary" mt={2} display="block">
        To manage who receives which emails, go to{" "}
        <Link to="/settings" style={{ color: "inherit", fontWeight: 600 }}>
          Notification Settings
        </Link>
        . Each user&apos;s personal report delivery email is configured in{" "}
        <Link to="/my-report" style={{ color: "inherit", fontWeight: 600 }}>
          My Daily Report
        </Link>
        .
      </Typography>
    </Box>
  );
}
