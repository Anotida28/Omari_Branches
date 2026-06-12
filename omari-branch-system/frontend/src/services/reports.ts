import { api } from "./api";
import type { ExpenseType } from "../types/api";

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

export async function fetchReportsData(filters: ReportsFilters): Promise<ReportsData> {
  const { data } = await api.get<{ data: ReportsData }>("/api/reports/data", {
    params: {
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
    },
  });
  return data.data;
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
