import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  RotateCcw,
  Send,
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
import { getAlertStats, listAlertLogs, triggerAlertJob } from "../services/alerts";
import { listBranches } from "../services/branches";
import { formatCurrency, formatDateTime } from "../services/format";
import { DataTable } from "../shared/components/DataTable";
import { DrawerPanel } from "../shared/components/DrawerPanel";
import { EmptyState } from "../shared/components/EmptyState";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";
import { useAuth } from "../hooks/useAuth";
import type {
  AlertLog,
  AlertRuleType,
  AlertSendStatus,
} from "../types/api";

const PAGE_SIZE = 15;

const RULE_TYPES: { value: AlertRuleType | ""; label: string }[] = [
  { value: "", label: "All Types" },
  { value: "DUE_REMINDER", label: "Due Reminder" },
  { value: "OVERDUE_ESCALATION", label: "Overdue Escalation" },
];

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

function ruleLabel(ruleType: AlertRuleType): string {
  return ruleType === "DUE_REMINDER" ? "Due Reminder" : "Overdue Escalation";
}

export default function AlertsPage() {
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AlertLog | null>(null);

  const page = parsePage(searchParams.get("page"));
  const branchId = searchParams.get("branchId") ?? "";
  const ruleType = (searchParams.get("ruleType") ?? "") as AlertRuleType | "";
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
    queryKey: ["alert-logs", { page, branchId, ruleType, status, dateFrom, dateTo }],
    queryFn: () =>
      listAlertLogs({
        page,
        pageSize: PAGE_SIZE,
        branchId: branchId || undefined,
        ruleType: ruleType || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const triggerMutation = useMutation({
    mutationFn: triggerAlertJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-stats"] });
      queryClient.invalidateQueries({ queryKey: ["alert-logs"] });
    },
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
    if (triggerMutation.isError) {
      return getErrorMessage(triggerMutation.error);
    }
    return "";
  }, [
    branchesQuery.error,
    branchesQuery.isError,
    logsQuery.error,
    logsQuery.isError,
    statsQuery.error,
    statsQuery.isError,
    triggerMutation.error,
    triggerMutation.isError,
  ]);

  return (
    <section className="space-y-5 motion-fade-up">
      {canWrite ? (
        <Stack direction="row" justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={<RotateCcw size={15} />}
            onClick={() => triggerMutation.mutate()}
            disabled={triggerMutation.isPending}
          >
            {triggerMutation.isPending ? "Triggering..." : "Trigger Evaluator"}
          </Button>
        </Stack>
      ) : null}

      {triggerMutation.isSuccess ? (
        <Alert severity="success">
          {triggerMutation.data.message}
        </Alert>
      ) : null}

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
            label="Rule Type"
            value={ruleType}
            onChange={(event) =>
              updateParams({
                ruleType: event.target.value || undefined,
                page: "1",
              })
            }
            sx={{ minWidth: { xs: "100%", md: 190 } }}
          >
            {RULE_TYPES.map((item) => (
              <MenuItem key={item.label} value={item.value}>
                {item.label}
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
            <TableCell>Rule</TableCell>
            <TableCell>Expense</TableCell>
            <TableCell>Recipients</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        }
        body={
          logsQuery.isLoading ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Loading alert logs...
              </TableCell>
            </TableRow>
          ) : (logsQuery.data?.items.length ?? 0) === 0 ? (
            <TableRow>
              <TableCell colSpan={6} sx={{ py: 4 }}>
                <EmptyState
                  title="No alert logs found"
                  description="Try adjusting filters or triggering evaluator."
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
                  <TableCell>{ruleLabel(log.rule.ruleType)}</TableCell>
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
                  <TableCell colSpan={6} align="right">
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
        title="Alert Details"
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
                <Typography variant="body2">
                  Balance: {formatCurrency(Number(selectedLog.expense.balanceRemaining))}
                </Typography>
              </Stack>
            </Box>

            <Box>
              <Typography variant="overline" color="text.secondary">
                Rule
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.6 }}>
                {selectedLog.rule.description} ({selectedLog.rule.dayOffset})
              </Typography>
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
