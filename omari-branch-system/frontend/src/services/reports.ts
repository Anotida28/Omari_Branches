import { listBranches } from "./branches";
import { listExpenses } from "./expenses";
import { toMoneyNumber } from "./format";
import { listMetrics } from "./metrics";
import type {
  Branch,
  BranchMetric,
  Expense,
  ExpenseType,
  PaginatedResponse,
} from "../types/api";

const PAGE_SIZE = 100;

export type ReportsFilters = {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
};

export type ReportBranchSummary = {
  branchId: string;
  branchName: string;
  expenseCount: number;
  totalAmount: number;
};

export type ReportPerformanceSummary = {
  branchId: string;
  branchName: string;
  metricsCount: number;
  totalCashInValue: number;
  totalCashOutValue: number;
  totalTransactionValue: number;
  totalCommission: number;
  latestEFloatBalance: number;
};

export type ReportExpenseTypeSummary = {
  expenseType: ExpenseType;
  expenseCount: number;
  totalAmount: number;
};

export type ReportExpenseLine = {
  id: string;
  branchId: string;
  branchName: string;
  expenseType: ExpenseType;
  period: string;
  dueDate: string;
  amount: number;
  vendor: string | null;
  currency: string;
};

export type ReportTotals = {
  expenseCount: number;
  totalAmount: number;
  metricsCount: number;
  totalCashInValue: number;
  totalCashOutValue: number;
  totalTransactionValue: number;
  totalCommission: number;
  latestEFloatBalance: number;
};

export type ReportsData = {
  generatedAt: string;
  filters: ReportsFilters;
  availableBranches: Array<{ id: string; displayName: string }>;
  totals: ReportTotals;
  branchSummary: ReportBranchSummary[];
  performanceSummary: ReportPerformanceSummary[];
  expenseTypeSummary: ReportExpenseTypeSummary[];
  expenses: ReportExpenseLine[];
};

type BranchSummaryAccumulator = {
  branchId: string;
  branchName: string;
  expenseCount: number;
  totalAmount: number;
};

type PerformanceSummaryAccumulator = {
  branchId: string;
  branchName: string;
  metricsCount: number;
  totalCashInValue: number;
  totalCashOutValue: number;
  totalTransactionValue: number;
  totalCommission: number;
  latestEFloatBalance: number;
  latestMetricDate: string | null;
};

type TypeSummaryAccumulator = {
  expenseType: ExpenseType;
  expenseCount: number;
  totalAmount: number;
};

async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  let total = 0;

  do {
    const response = await fetchPage(page, PAGE_SIZE);
    items.push(...response.items);
    total = response.total;
    page += 1;
  } while ((page - 1) * PAGE_SIZE < total);

  return items;
}

function toUtcDateOnly(value: string): Date {
  const parsed = new Date(value);
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

function isDueDateInRange(dueDate: string, dateFrom: string, dateTo: string): boolean {
  const due = toUtcDateOnly(dueDate);
  const from = toUtcDateOnly(dateFrom);
  const to = toUtcDateOnly(dateTo);
  return due.getTime() >= from.getTime() && due.getTime() <= to.getTime();
}

function toExpenseLine(expense: Expense, branchNameById: Map<string, string>): ReportExpenseLine {
  return {
    id: expense.id,
    branchId: expense.branchId,
    branchName: branchNameById.get(expense.branchId) ?? expense.branchId,
    expenseType: expense.expenseType,
    period: expense.period,
    dueDate: expense.dueDate,
    amount: toMoneyNumber(expense.amount),
    vendor: expense.vendor,
    currency: expense.currency,
  };
}

function computeLatestEFloatBalance(metrics: BranchMetric[]): number {
  if (metrics.length === 0) {
    return 0;
  }

  const latestDate = metrics.reduce(
    (latest, metric) => (metric.date > latest ? metric.date : latest),
    metrics[0].date,
  );

  return metrics
    .filter((metric) => metric.date === latestDate)
    .reduce((sum, metric) => sum + toMoneyNumber(metric.eFloatBalance), 0);
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
}

export async function fetchReportsData(filters: ReportsFilters): Promise<ReportsData> {
  const [branches, expenses, metrics] = await Promise.all([
    fetchAllPages((page, pageSize) => listBranches({ page, pageSize })),
    fetchAllPages((page, pageSize) =>
      listExpenses({
        page,
        pageSize,
        branchId: filters.branchId,
      }),
    ),
    fetchAllPages((page, pageSize) =>
      listMetrics({
        page,
        pageSize,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    ),
  ]);

  const branchNameById = new Map(
    branches.map((branch: Branch) => [branch.id, branch.displayName]),
  );

  const expensesInRange = expenses
    .filter((expense) => isDueDateInRange(expense.dueDate, filters.dateFrom, filters.dateTo))
    .map((expense) => toExpenseLine(expense, branchNameById))
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  const branchSummaryMap = new Map<string, BranchSummaryAccumulator>();
  const performanceSummaryMap = new Map<string, PerformanceSummaryAccumulator>();
  const typeSummaryMap = new Map<ExpenseType, TypeSummaryAccumulator>();

  let totalAmount = 0;

  for (const expense of expensesInRange) {
    totalAmount += expense.amount;

    const branchSummary = branchSummaryMap.get(expense.branchId) ?? {
      branchId: expense.branchId,
      branchName: expense.branchName,
      expenseCount: 0,
      totalAmount: 0,
    };

    branchSummary.expenseCount += 1;
    branchSummary.totalAmount += expense.amount;
    branchSummaryMap.set(expense.branchId, branchSummary);

    const typeSummary = typeSummaryMap.get(expense.expenseType) ?? {
      expenseType: expense.expenseType,
      expenseCount: 0,
      totalAmount: 0,
    };
    typeSummary.expenseCount += 1;
    typeSummary.totalAmount += expense.amount;
    typeSummaryMap.set(expense.expenseType, typeSummary);
  }

  for (const metric of metrics) {
    const branchName = branchNameById.get(metric.branchId) ?? metric.branchId;
    const performanceSummary = performanceSummaryMap.get(metric.branchId) ?? {
      branchId: metric.branchId,
      branchName,
      metricsCount: 0,
      totalCashInValue: 0,
      totalCashOutValue: 0,
      totalTransactionValue: 0,
      totalCommission: 0,
      latestEFloatBalance: 0,
      latestMetricDate: null,
    };

    performanceSummary.metricsCount += 1;
    performanceSummary.totalCashInValue += toMoneyNumber(metric.cashInValue);
    performanceSummary.totalCashOutValue += toMoneyNumber(metric.cashOutValue);
    performanceSummary.totalTransactionValue += toMoneyNumber(metric.totalTransactionValue);
    performanceSummary.totalCommission += toMoneyNumber(metric.totalCommission);

    if (!performanceSummary.latestMetricDate || metric.date > performanceSummary.latestMetricDate) {
      performanceSummary.latestMetricDate = metric.date;
      performanceSummary.latestEFloatBalance = toMoneyNumber(metric.eFloatBalance);
    }

    performanceSummaryMap.set(metric.branchId, performanceSummary);
  }

  const branchSummary = [...branchSummaryMap.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );

  const performanceSummary = [...performanceSummaryMap.values()]
    .map(({ latestMetricDate: _latestMetricDate, ...row }) => row)
    .sort((a, b) => b.totalTransactionValue - a.totalTransactionValue);

  const expenseTypeSummary = [...typeSummaryMap.values()].sort(
    (a, b) => b.totalAmount - a.totalAmount,
  );

  const totalCashInValue = metrics.reduce(
    (sum, metric) => sum + toMoneyNumber(metric.cashInValue),
    0,
  );
  const totalCashOutValue = metrics.reduce(
    (sum, metric) => sum + toMoneyNumber(metric.cashOutValue),
    0,
  );
  const totalTransactionValue = metrics.reduce(
    (sum, metric) => sum + toMoneyNumber(metric.totalTransactionValue),
    0,
  );
  const totalCommission = metrics.reduce(
    (sum, metric) => sum + toMoneyNumber(metric.totalCommission),
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    filters,
    availableBranches: branches
      .map((branch) => ({ id: branch.id, displayName: branch.displayName }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    totals: {
      expenseCount: expensesInRange.length,
      totalAmount,
      metricsCount: metrics.length,
      totalCashInValue,
      totalCashOutValue,
      totalTransactionValue,
      totalCommission,
      latestEFloatBalance: computeLatestEFloatBalance(metrics),
    },
    branchSummary,
    performanceSummary,
    expenseTypeSummary,
    expenses: expensesInRange,
  };
}

export function buildReportSummaryCsv(data: ReportsData): string {
  const rows: string[][] = [
    ["Report", "Reminder and Branch Summary"],
    ["Generated At (UTC)", data.generatedAt],
    ["Date From", data.filters.dateFrom],
    ["Date To", data.filters.dateTo],
    ["Branch Filter", data.filters.branchId || "All"],
    [],
    ["KPI", "Value"],
    ["Reminder Count", String(data.totals.expenseCount)],
    ["Scheduled Amount", data.totals.totalAmount.toFixed(2)],
    ["Metric Rows", String(data.totals.metricsCount)],
    ["Total Cash In Value", data.totals.totalCashInValue.toFixed(2)],
    ["Total Cash Out Value", data.totals.totalCashOutValue.toFixed(2)],
    ["Total Transaction Value", data.totals.totalTransactionValue.toFixed(2)],
    ["Total Commission", data.totals.totalCommission.toFixed(2)],
    ["Latest E-Float Balance", data.totals.latestEFloatBalance.toFixed(2)],
    [],
    ["Branch", "Reminder Count", "Scheduled Amount"],
    ...data.branchSummary.map((row) => [
      row.branchName,
      String(row.expenseCount),
      row.totalAmount.toFixed(2),
    ]),
    [],
    [
      "Branch",
      "Metric Rows",
      "Cash In Value",
      "Cash Out Value",
      "Transaction Value",
      "Total Commission",
      "Latest E-Float",
    ],
    ...data.performanceSummary.map((row) => [
      row.branchName,
      String(row.metricsCount),
      row.totalCashInValue.toFixed(2),
      row.totalCashOutValue.toFixed(2),
      row.totalTransactionValue.toFixed(2),
      row.totalCommission.toFixed(2),
      row.latestEFloatBalance.toFixed(2),
    ]),
    [],
    ["Expense Type", "Reminder Count", "Scheduled Amount"],
    ...data.expenseTypeSummary.map((row) => [
      row.expenseType,
      String(row.expenseCount),
      row.totalAmount.toFixed(2),
    ]),
  ];

  return toCsv(rows);
}

export function buildReportExpensesCsv(data: ReportsData): string {
  const rows: string[][] = [
    [
      "Expense ID",
      "Branch",
      "Expense Type",
      "Period",
      "Due Date",
      "Vendor",
      "Currency",
      "Amount",
    ],
    ...data.expenses.map((expense) => [
      expense.id,
      expense.branchName,
      expense.expenseType,
      expense.period,
      expense.dueDate,
      expense.vendor || "",
      expense.currency,
      expense.amount.toFixed(2),
    ]),
  ];

  return toCsv(rows);
}
