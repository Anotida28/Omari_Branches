import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Stack,
  TableCell,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { getErrorMessage } from "../services/api";
import { getAlertStats, listAlertLogs } from "../services/alerts";
import { listBranches } from "../services/branches";
import { formatCurrency, formatDateTime } from "../services/format";
import { DataTable } from "../shared/components/DataTable";
import { DrawerPanel } from "../shared/components/DrawerPanel";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";
import { TableSkeletonRows } from "../shared/components/TableSkeletonRows";
import type {
  AlertLog,
  AlertSendStatus,
} from "../types/api";

const PAGE_SIZE = 15;

const STATUS_OPTIONS: { value: AlertSendStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "SENT", label: "Sent" },
  { value: "FAILED", label: "Failed" },
  { value: "SKIPPED", label: "Skipped" },
  { value: "PENDING", label: "Pending" },
];

function parsePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function statusColor(status: AlertSendStatus): "success" | "error" | "warning" | "default" {
  if (status === "SENT") {
    return "success";
  }
  if (status === "FAILED") {
    return "error";
  }
  if (status === "PENDING") {
    return "warning";
  }
  return "default";
}

export default function AlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AlertLog | null>(null);

  const page = parsePage(searchParams.get("page"));
  const branchId = searchParams.get("branchId") ?? "";
  const status = (searchParams.get("status") ?? "") as AlertSendStatus | "";
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

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

  const statsQuery = useQuery({
    queryKey: ["alert-stats"],
    queryFn: getAlertStats,
  });

  const branchesQuery = useQuery({
    queryKey: ["branches", "all", "for-alerts"],
    queryFn: () => listBranches({ page: 1, pageSize: 100 }),
  });

  const logsQuery = useQuery({
    queryKey: ["alert-logs", { page, branchId, status, dateFrom, dateTo }],
    queryFn: () =>
      listAlertLogs({
        page,
        pageSize: PAGE_SIZE,
        branchId: branchId || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const errorMessage = useMemo(() => {
    if (statsQuery.isError) {
      return getErrorMessage(statsQuery.error);
    }
    if (branchesQuery.isError) {
      return getErrorMessage(branchesQuery.error);
    }
    if (logsQuery.isError) {
      return getErrorMessage(logsQuery.error);
    }
    return "";
  }, [
    branchesQuery.error,
    branchesQuery.isError,
    logsQuery.error,
    logsQuery.isError,
    statsQuery.error,
    statsQuery.isError,
  ]);

  return (
    <section className="space-y-5 motion-fade-up">
      <Alert severity="info" variant="outlined">
        This page is a read-only history of reminder delivery outcomes. Reminder evaluation runs
        through the scheduler rather than manual UI actions.
      </Alert>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

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
          label="Total Sent"
          value={String(statsQuery.data?.totalSent ?? 0)}
          icon={<CheckCircle2 size={18} />}
        />
        <StatCard
          label="Total Failed"
          value={String(statsQuery.data?.totalFailed ?? 0)}
          icon={<XCircle size={18} />}
        />
        <StatCard
          label="Sent Today"
          value={String(statsQuery.data?.sentToday ?? 0)}
          icon={<Clock size={18} />}
        />
        <StatCard
          label="Sent This Week"
          value={String(statsQuery.data?.sentThisWeek ?? 0)}
          icon={<Bell size={18} />}
        />
      </Box>

      <FilterBar>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.2}>
          <TextField
            select
            label="Branch"
            value={branchId}
            onChange={(event) =>
              updateParams({
                branchId: event.target.value || undefined,
                page: "1",
              })
            }
            sx={{ minWidth: { xs: "100%", md: 220 } }}
          >
            <MenuItem value="">All branches</MenuItem>
            {(branchesQuery.data?.items ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.displayName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={status}
            onChange={(event) =>
              updateParams({
                status: event.target.value || undefined,
                page: "1",
              })
            }
            sx={{ minWidth: { xs: "100%", md: 170 } }}
          >
            {STATUS_OPTIONS.map((item) => (
              <MenuItem key={item.label} value={item.value}>
                {item.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            type="date"
            label="Date From"
            value={dateFrom}
            onChange={(event) =>
              updateParams({
                dateFrom: event.target.value || undefined,
                page: "1",
              })
            }
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", md: 160 } }}
          />

          <TextField
            type="date"
            label="Date To"
            value={dateTo}
            onChange={(event) =>
              updateParams({
                dateTo: event.target.value || undefined,
                page: "1",
              })
            }
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", md: 160 } }}
          />

          <Button
            variant="outlined"
            onClick={() => {
              setSearchParams({}, { replace: true });
            }}
            sx={{ width: { xs: "100%", md: "auto" }, whiteSpace: "nowrap" }}
          >
            Reset Filters
          </Button>
        </Stack>
      </FilterBar>

      <DataTable
        head={
          <TableRow>
            <TableCell>Sent At</TableCell>
            <TableCell>Branch</TableCell>
            <TableCell>Reminder</TableCell>
            <TableCell>Recipients</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        }
        body={
          logsQuery.isLoading ? (
            <TableSkeletonRows columns={5} />
          ) : (logsQuery.data?.items.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={5} sx={{ py: 4 }}>
                <EmptyState
                  title="No reminder logs found"
                  description="Delivery history will appear here after reminder runs."
                  icon={<AlertTriangle size={16} />}
                />
              </TableCell>
            </TableRow>
          ) : (
            <>
              {logsQuery.data?.items.map((log) => (
                <TableRow
                  key={log.id}
                  hover
                  onClick={() => {
                    setSelectedLog(log);
                    setDrawerOpen(true);
                  }}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell>{formatDateTime(log.sentAt)}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{log.branch.displayName}</TableCell>
                  <TableCell>
                    {log.expense.expenseType} ({log.expense.period})
                  </TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    <Typography variant="body2" noWrap title={log.sentTo}>
                      {log.sentTo}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={statusColor(log.status)}
                      label={log.status}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {(logsQuery.data?.total ?? 0) > PAGE_SIZE ? (
                <TableRow>
                  <TableCell colSpan={5} align="right">
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">
                        Showing page {page} of {Math.ceil((logsQuery.data?.total ?? 0) / PAGE_SIZE)}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={page <= 1}
                          onClick={() => updateParams({ page: String(Math.max(1, page - 1)) })}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={page >= Math.ceil((logsQuery.data?.total ?? 0) / PAGE_SIZE)}
                          onClick={() => updateParams({ page: String(page + 1) })}
                        >
                          Next
                        </Button>
                      </Stack>
                    </Stack>
                  </TableCell>
                </TableRow>
              ) : null}
            </>
          )
        }
      />

      <DrawerPanel
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedLog(null);
        }}
        title="Reminder Log Details"
        width={760}
      >
        {selectedLog ? (
          <Stack spacing={2}>
            <Box>
              <Typography variant="overline" color="text.secondary">
                Status
              </Typography>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Chip size="small" color={statusColor(selectedLog.status)} label={selectedLog.status} />
                <Typography variant="body2" color="text.secondary">
                  {formatDateTime(selectedLog.sentAt)}
                </Typography>
              </Stack>
              {selectedLog.errorMessage ? (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {selectedLog.errorMessage}
                </Alert>
              ) : null}
            </Box>

            <Box>
              <Typography variant="overline" color="text.secondary">
                Branch
              </Typography>
              <Typography variant="body1" fontWeight={600}>
                {selectedLog.branch.displayName}
              </Typography>
            </Box>

            <Box>
              <Typography variant="overline" color="text.secondary">
                Expense
              </Typography>
              <Stack spacing={0.5} sx={{ mt: 0.6 }}>
                <Typography variant="body2">
                  Type: <strong>{selectedLog.expense.expenseType}</strong>
                </Typography>
                <Typography variant="body2">Period: {selectedLog.expense.period}</Typography>
                <Typography variant="body2">Due Date: {selectedLog.expense.dueDate}</Typography>
                <Typography variant="body2">
                  Amount: {formatCurrency(Number(selectedLog.expense.amount))}
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Typography variant="overline" color="text.secondary">
                Recipients
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.6 }}>
                {selectedLog.sentTo}
              </Typography>
            </Box>
          </Stack>
        ) : null}
      </DrawerPanel>
    </section>
  );
}
