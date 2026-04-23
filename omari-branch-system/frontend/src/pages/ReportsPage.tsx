import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
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
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { formatCurrency, formatDate, formatDateTime } from "../services/format";
import {
  buildReportExpensesCsv,
  buildReportSummaryCsv,
  fetchReportsData,
} from "../services/reports";
import type { ReminderState } from "../services/reminders";
import { EmptyState } from "../shared/components/EmptyState";
import { ErrorState } from "../shared/components/ErrorState";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function reminderStateColor(state: ReminderState): "warning" | "error" | "default" {
  if (state === "OVERDUE") {
    return "error";
  }
  if (state === "DUE_TODAY") {
    return "warning";
  }
  return "default";
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.setAttribute("download", filename);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const defaultDateTo = toInputDate(new Date());
  const defaultDateFrom = toInputDate(shiftDays(new Date(), -30));

  const branchId = searchParams.get("branchId") ?? "";
  const dateTo = searchParams.get("dateTo") ?? defaultDateTo;
  const dateFrom = searchParams.get("dateFrom") ?? defaultDateFrom;

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

  const filters = useMemo(
    () => ({
      branchId: branchId || undefined,
      dateFrom,
      dateTo,
    }),
    [branchId, dateFrom, dateTo],
  );

  const reportsQuery = useQuery({
    queryKey: ["reports", filters],
    queryFn: () => fetchReportsData(filters),
    enabled: Boolean(dateFrom && dateTo),
  });

  const handleResetFilters = () => {
    const today = new Date();
    setSearchParams(
      {
        dateFrom: toInputDate(shiftDays(today, -30)),
        dateTo: toInputDate(today),
      },
      { replace: true },
    );
  };

  const handleExportSummary = () => {
    if (!reportsQuery.data) {
      return;
    }
    const csv = buildReportSummaryCsv(reportsQuery.data);
    downloadCsv(csv, `reports-summary-${dateFrom}-to-${dateTo}.csv`);
  };

  const handleExportExpenses = () => {
    if (!reportsQuery.data) {
      return;
    }
    const csv = buildReportExpensesCsv(reportsQuery.data);
    downloadCsv(csv, `reports-expenses-${dateFrom}-to-${dateTo}.csv`);
  };

  if (reportsQuery.isError) {
    return (
      <section className="space-y-5 motion-fade-up">
        <ErrorState message={reportsQuery.error instanceof Error ? reportsQuery.error.message : "Failed to load reports."} />
      </section>
    );
  }

  const report = reportsQuery.data;

  return (
    <section className="space-y-5 motion-fade-up">
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
        <Button
          variant="outlined"
          startIcon={<Download size={16} />}
          disabled={!report || reportsQuery.isFetching}
          onClick={handleExportSummary}
        >
          Export Summary CSV
        </Button>
        <Button
          variant="contained"
          startIcon={<FileSpreadsheet size={16} />}
          disabled={!report || reportsQuery.isFetching}
          onClick={handleExportExpenses}
        >
          Export Reminder CSV
        </Button>
      </Stack>

      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
          <TextField
            select
            size="small"
            label="Branch"
            value={branchId}
            onChange={(event) => updateParams({ branchId: event.target.value || undefined })}
            sx={{ minWidth: { xs: "100%", lg: 240 } }}
          >
            <MenuItem value="">All branches</MenuItem>
            {(report?.availableBranches ?? []).map((branch) => (
              <MenuItem key={branch.id} value={branch.id}>
                {branch.displayName}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            size="small"
            type="date"
            label="Date From"
            value={dateFrom}
            onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />

          <TextField
            size="small"
            type="date"
            label="Date To"
            value={dateTo}
            onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />

          <Button
            variant="outlined"
            onClick={handleResetFilters}
            sx={{ width: { xs: "100%", lg: "auto" }, whiteSpace: "nowrap" }}
          >
            Reset Filters
          </Button>
        </Stack>
      </FilterBar>

      {reportsQuery.isLoading ? (
        <Paper sx={{ p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Building report...
          </Typography>
        </Paper>
      ) : !report ? (
        <EmptyState
          title="No report data"
          description="Adjust filters and try again."
        />
      ) : (
        <>
          <Alert severity="info" variant="outlined">
            Report generated at {formatDateTime(report.generatedAt)}.
          </Alert>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(3, minmax(0, 1fr))",
              },
            }}
          >
            <StatCard
              label="Reminders in Range"
              value={String(report.totals.expenseCount)}
              hint={`Total amount: ${formatCurrency(report.totals.totalAmount)}`}
              icon={<FileSpreadsheet size={18} />}
            />
            <StatCard
              label="Scheduled Amount"
              value={formatCurrency(report.totals.totalAmount)}
              hint={`${report.totals.expenseCount} reminder items`}
              icon={<Wallet size={18} />}
            />
            <StatCard
              label="Overdue Reminder Amount"
              value={formatCurrency(report.totals.overdueAmount)}
              hint={`${report.totals.overdueCount} overdue reminders`}
              icon={<AlertTriangle size={18} />}
            />
            <StatCard
              label="Due in 7 Days"
              value={formatCurrency(report.totals.dueNext7Amount)}
              hint="Upcoming reminder exposure"
              icon={<AlertTriangle size={18} />}
            />
            <StatCard
              label="Total Cash In"
              value={formatCurrency(report.totals.totalCashInValue)}
              hint={`${report.totals.metricsCount} metric rows`}
              icon={<TrendingUp size={18} />}
            />
            <StatCard
              label="Total Net Cash"
              value={formatCurrency(report.totals.totalNetCashValue)}
              hint={`Cash out: ${formatCurrency(report.totals.totalCashOutValue)}`}
              icon={<TrendingUp size={18} />}
            />
            <StatCard
              label="Latest Cash on Branch"
              value={formatCurrency(report.totals.latestCashOnBranch)}
              hint="Latest available metric date snapshot"
              icon={<Building2 size={18} />}
            />
          </Box>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                xl: "minmax(0, 2fr) minmax(0, 1fr)",
              },
            }}
          >
            <Paper sx={{ border: "1px solid rgba(15, 23, 42, 0.1)", overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Branch Summary
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Branch</TableCell>
                      <TableCell align="right">Reminders</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Overdue</TableCell>
                      <TableCell align="right">Overdue Amount</TableCell>
                      <TableCell align="right">Due in 7 Days</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.branchSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                          No branch data in selected range.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.branchSummary.map((row) => (
                        <TableRow key={row.branchId}>
                          <TableCell sx={{ fontWeight: 600 }}>{row.branchName}</TableCell>
                          <TableCell align="right">{row.expenseCount}</TableCell>
                          <TableCell align="right">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell align="right">{row.overdueCount}</TableCell>
                          <TableCell align="right">{formatCurrency(row.overdueAmount)}</TableCell>
                          <TableCell align="right">{row.dueNext7Count}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper sx={{ border: "1px solid rgba(15, 23, 42, 0.1)", overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Reminder Type Mix
                </Typography>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Count</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Overdue Amount</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {report.expenseTypeSummary.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>
                          No type data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      report.expenseTypeSummary.map((row) => (
                        <TableRow key={row.expenseType}>
                          <TableCell sx={{ fontWeight: 600 }}>{row.expenseType}</TableCell>
                          <TableCell align="right">{row.expenseCount}</TableCell>
                          <TableCell align="right">{formatCurrency(row.totalAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.overdueAmount)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          <Paper sx={{ border: "1px solid rgba(15, 23, 42, 0.1)", overflow: "hidden" }}>
            <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid rgba(15, 23, 42, 0.08)" }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.6}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Reminder Detail Snapshot
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Showing {Math.min(report.expenses.length, 100)} of {report.expenses.length} rows
                </Typography>
              </Stack>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Branch</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Period</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Reminder State</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                        No reminders found for selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.expenses.slice(0, 100).map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell sx={{ fontWeight: 600 }}>{expense.branchName}</TableCell>
                        <TableCell>{expense.expenseType}</TableCell>
                        <TableCell>{expense.period}</TableCell>
                        <TableCell>{formatDate(expense.dueDate)}</TableCell>
                        <TableCell align="right">{formatCurrency(expense.amount, expense.currency)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={reminderStateColor(expense.reminderState)}
                            label={expense.reminderState}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </section>
  );
}
