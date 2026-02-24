import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, MinusCircle, XCircle } from "lucide-react";

import { Card, CardHeader } from "../components/ui/Card";
import { Drawer } from "../components/ui/Drawer";
import { Pagination } from "../components/ui/Pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeadCell,
  TableRow,
} from "../components/ui/Table";
import { getErrorMessage } from "../services/api";
import { listAlertLogs, getAlertStats } from "../services/alerts";
import { listBranches } from "../services/branches";
import { formatDateTime } from "../services/format";
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

function StatusBadge({ status }: { status: AlertSendStatus }) {
  if (status === "SENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        Sent
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        <XCircle className="h-3 w-3" />
        Failed
      </span>
    );
  }
  if (status === "SKIPPED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
        <MinusCircle className="h-3 w-3" />
        Skipped
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

function RuleTypeBadge({ ruleType }: { ruleType: AlertRuleType }) {
  if (ruleType === "DUE_REMINDER") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
        <AlertCircle className="h-3 w-3" />
        Due Reminder
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
      <AlertCircle className="h-3 w-3" />
      Overdue
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "green" | "red" | "blue" | "yellow";
}) {
  const colorClasses = {
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-2 ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [page, setPage] = useState(1);
  const [branchId, setBranchId] = useState("");
  const [ruleType, setRuleType] = useState<AlertRuleType | "">("");
  const [status, setStatus] = useState<AlertSendStatus | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AlertLog | null>(null);

  // Queries
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

  const branchMap = useMemo(() => {
    return new Map(
      (branchesQuery.data?.items ?? []).map((branch) => [branch.id, branch.displayName])
    );
  }, [branchesQuery.data?.items]);

  const combinedError = (() => {
    if (branchesQuery.isError) return getErrorMessage(branchesQuery.error);
    if (logsQuery.isError) return getErrorMessage(logsQuery.error);
    if (statsQuery.isError) return getErrorMessage(statsQuery.error);
    return "";
  })();

  const openLogDetail = (log: AlertLog) => {
    setSelectedLog(log);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedLog(null);
  };

  const resetFilters = () => {
    setPage(1);
    setBranchId("");
    setRuleType("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Alert Logs</h1>
      </div>

      {/* Stats Cards */}
      {statsQuery.data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Sent"
            value={statsQuery.data.totalSent}
            icon={<CheckCircle2 className="h-5 w-5" />}
            color="green"
          />
          <StatCard
            title="Total Failed"
            value={statsQuery.data.totalFailed}
            icon={<XCircle className="h-5 w-5" />}
            color="red"
          />
          <StatCard
            title="Sent Today"
            value={statsQuery.data.sentToday}
            icon={<Clock className="h-5 w-5" />}
            color="blue"
          />
          <StatCard
            title="Sent This Week"
            value={statsQuery.data.sentThisWeek}
            icon={<AlertCircle className="h-5 w-5" />}
            color="yellow"
          />
        </div>
      )}

      {/* Error Display */}
      {combinedError && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{combinedError}</p>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader title="Filters" />
        <div className="-mt-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {/* Branch Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Branch
              </label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All Branches</option>
                {branchesQuery.data?.items.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Rule Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Rule Type
              </label>
              <select
                value={ruleType}
                onChange={(e) => {
                  setRuleType(e.target.value as AlertRuleType | "");
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {RULE_TYPES.map((rt) => (
                  <option key={rt.value || "all"} value={rt.value}>
                    {rt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as AlertSendStatus | "");
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value || "all"} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <tr>
                <TableHeadCell>Sent At</TableHeadCell>
                <TableHeadCell>Branch</TableHeadCell>
                <TableHeadCell>Expense</TableHeadCell>
                <TableHeadCell>Rule</TableHeadCell>
                <TableHeadCell>Sent To</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {logsQuery.isLoading ? (
                <tr>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Loading...
                  </TableCell>
                </tr>
              ) : logsQuery.data?.items.length === 0 ? (
                <tr>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No alert logs found.
                  </TableCell>
                </tr>
              ) : (
                logsQuery.data?.items.map((log) => (
                  <TableRow
                    key={log.id}
                    onClick={() => openLogDetail(log)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <TableCell className="text-sm text-gray-900">
                      {formatDateTime(log.sentAt)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-900">
                      {log.branch.displayName}
                    </TableCell>
                    <TableCell className="text-sm text-gray-900">
                      <div>
                        <span className="font-medium">{log.expense.expenseType}</span>
                        <span className="text-gray-500 ml-2">{log.expense.period}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RuleTypeBadge ruleType={log.rule.ruleType} />
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                      {log.sentTo}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {logsQuery.data && logsQuery.data.total > PAGE_SIZE && (
          <div className="border-t border-gray-200 px-4 py-3">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={logsQuery.data.total}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      {/* Detail Drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer} title="Alert Log Details">
        {selectedLog && (
          <div className="space-y-6">
            {/* Status & Timestamps */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Status</h3>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedLog.status} />
                <span className="text-sm text-gray-600">
                  {formatDateTime(selectedLog.sentAt)}
                </span>
              </div>
              {selectedLog.errorMessage && (
                <div className="mt-2 rounded-md bg-red-50 p-3">
                  <p className="text-sm text-red-700">{selectedLog.errorMessage}</p>
                </div>
              )}
            </div>

            {/* Branch Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Branch</h3>
              <p className="text-gray-900">{selectedLog.branch.displayName}</p>
            </div>

            {/* Expense Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Expense</h3>
              <div className="rounded-md border border-gray-200 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type</span>
                  <span className="font-medium">{selectedLog.expense.expenseType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Period</span>
                  <span>{selectedLog.expense.period}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date</span>
                  <span>{selectedLog.expense.dueDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-medium">
                    ${Number(selectedLog.expense.amount).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Balance</span>
                  <span className="font-medium text-orange-600">
                    ${Number(selectedLog.expense.balanceRemaining).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span>{selectedLog.expense.status}</span>
                </div>
              </div>
            </div>

            {/* Rule Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Alert Rule</h3>
              <div className="rounded-md border border-gray-200 p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Type</span>
                  <RuleTypeBadge ruleType={selectedLog.rule.ruleType} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Description</span>
                  <span>{selectedLog.rule.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Day Offset</span>
                  <span>{selectedLog.rule.dayOffset}</span>
                </div>
              </div>
            </div>

            {/* Recipients */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Sent To</h3>
              <div className="rounded-md bg-gray-50 p-3">
                <p className="text-sm text-gray-900 break-all">{selectedLog.sentTo}</p>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
