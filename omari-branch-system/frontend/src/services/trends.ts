import { listAlertLogs } from "./alerts";
import { listBranches } from "./branches";
import { listExpenses } from "./expenses";
import { listMetrics } from "./metrics";
import { toMoneyNumber } from "./format";
import type {
  AlertLog,
  Branch,
  BranchMetric,
  Expense,
  ExpenseType,
  PaginatedResponse,
} from "../types/api";

const PAGE_SIZE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export type TrendsFilters = {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
};

export type TrendsKpis = {
  totalCashOnBranch: number;
  totalOutstandingBalance: number;
  overdueAmount: number;
  overdueCount: number;
  dueNext7Amount: number;
  alertFailureRate: number;
};

export type CashTrendPoint = {
  date: string;
  cashOnBranch: number;
  cashBalance: number;
  eFloatBalance: number;
  cashInVault: number;
  cashInValue: number;
  cashOutValue: number;
  netCashValue: number;
};

export type OutstandingByBranchPoint = {
  branchId: string;
  branchName: string;
  outstandingBalance: number;
};

export type DueRiskPoint = {
  week: string;
  upcomingAmount: number;
  overdueAmount: number;
};

export type ExpenseTypeMixPoint = {
  expenseType: ExpenseType;
  outstandingBalance: number;
};

export type AlertsHealthPoint = {
  date: string;
  sent: number;
  failed: number;
  skipped: number;
};

export type TrendsData = {
  kpis: TrendsKpis;
  cashTrend: CashTrendPoint[];
  outstandingByBranch: OutstandingByBranchPoint[];
  dueRiskTimeline: DueRiskPoint[];
  expenseTypeMix: ExpenseTypeMixPoint[];
  alertsHealthTrend: AlertsHealthPoint[];
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

function toDateOnly(value: string | Date): Date {
  const source = typeof value === "string" ? new Date(value) : value;
  return new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth(),
      source.getUTCDate(),
    ),
  );
}

function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfWeekUtc(date: Date): Date {
  const normalized = toDateOnly(date);
  const dayIndex = (normalized.getUTCDay() + 6) % 7;
  normalized.setUTCDate(normalized.getUTCDate() - dayIndex);
  return normalized;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function buildCashTrend(metrics: BranchMetric[]): CashTrendPoint[] {
  const byDate = new Map<string, CashTrendPoint>();

  for (const metric of metrics) {
    const date = metric.date;
    const current = byDate.get(date) ?? {
      date,
      cashOnBranch: 0,
      cashBalance: 0,
      eFloatBalance: 0,
      cashInVault: 0,
      cashInValue: 0,
      cashOutValue: 0,
      netCashValue: 0,
    };

    current.cashOnBranch += toMoneyNumber(metric.cashOnBranch);
    current.cashBalance += toMoneyNumber(metric.cashBalance);
    current.eFloatBalance += toMoneyNumber(metric.eFloatBalance);
    current.cashInVault += toMoneyNumber(metric.cashInVault);
    current.cashInValue += toMoneyNumber(metric.cashInValue);
    current.cashOutValue += toMoneyNumber(metric.cashOutValue);
    current.netCashValue += toMoneyNumber(metric.netCashValue);

    byDate.set(date, current);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildExpenseAnalytics(
  expenses: Expense[],
  branches: Branch[],
): {
  outstandingByBranch: OutstandingByBranchPoint[];
  dueRiskTimeline: DueRiskPoint[];
  expenseTypeMix: ExpenseTypeMixPoint[];
  totalOutstandingBalance: number;
  overdueAmount: number;
  overdueCount: number;
  dueNext7Amount: number;
} {
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.displayName]));

  const outstandingByBranchMap = new Map<string, number>();
  const expenseTypeMap = new Map<ExpenseType, number>();

  const now = toDateOnly(new Date());
  const next7 = new Date(now.getTime() + 7 * MS_PER_DAY);

  let totalOutstandingBalance = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let dueNext7Amount = 0;

  const currentWeekStart = startOfWeekUtc(now);
  const weekBuckets = new Map<string, DueRiskPoint>();

  for (let offset = -4; offset <= 4; offset += 1) {
    const weekStart = new Date(currentWeekStart.getTime() + offset * MS_PER_WEEK);
    const weekKey = formatDateKey(weekStart);
    weekBuckets.set(weekKey, {
      week: formatShortDate(weekStart),
      upcomingAmount: 0,
      overdueAmount: 0,
    });
  }

  for (const expense of expenses) {
    const balance = Math.max(0, toMoneyNumber(expense.balanceRemaining));
    if (balance <= 0) {
      continue;
    }

    totalOutstandingBalance += balance;

    const dueDate = toDateOnly(expense.dueDate);
    if (expense.status === "OVERDUE" || dueDate.getTime() < now.getTime()) {
      overdueAmount += balance;
      overdueCount += 1;
    }

    if (
      dueDate.getTime() >= now.getTime() &&
      dueDate.getTime() <= next7.getTime() &&
      expense.status !== "PAID"
    ) {
      dueNext7Amount += balance;
    }

    const branchCurrent = outstandingByBranchMap.get(expense.branchId) ?? 0;
    outstandingByBranchMap.set(expense.branchId, branchCurrent + balance);

    const typeCurrent = expenseTypeMap.get(expense.expenseType) ?? 0;
    expenseTypeMap.set(expense.expenseType, typeCurrent + balance);

    const weekStart = startOfWeekUtc(dueDate);
    const weekKey = formatDateKey(weekStart);
    const bucket = weekBuckets.get(weekKey);
    if (!bucket) {
      continue;
    }

    if (expense.status === "OVERDUE" || dueDate.getTime() < now.getTime()) {
      bucket.overdueAmount += balance;
    } else {
      bucket.upcomingAmount += balance;
    }
  }

  const outstandingByBranch: OutstandingByBranchPoint[] = [...outstandingByBranchMap.entries()]
    .map(([branchId, outstandingBalance]) => ({
      branchId,
      branchName: branchNameById.get(branchId) ?? branchId,
      outstandingBalance,
    }))
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
    .slice(0, 10);

  const expenseTypeMix: ExpenseTypeMixPoint[] = [...expenseTypeMap.entries()]
    .map(([expenseType, outstandingBalance]) => ({ expenseType, outstandingBalance }))
    .sort((a, b) => b.outstandingBalance - a.outstandingBalance);

  const dueRiskTimeline = [...weekBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, value]) => value);

  return {
    outstandingByBranch,
    dueRiskTimeline,
    expenseTypeMix,
    totalOutstandingBalance,
    overdueAmount,
    overdueCount,
    dueNext7Amount,
  };
}

function buildAlertsHealthTrend(alertLogs: AlertLog[]): {
  trend: AlertsHealthPoint[];
  sentCount: number;
  failedCount: number;
} {
  const byDate = new Map<string, AlertsHealthPoint>();
  let sentCount = 0;
  let failedCount = 0;

  for (const log of alertLogs) {
    const date = formatDateKey(toDateOnly(log.sentAt));
    const current = byDate.get(date) ?? {
      date,
      sent: 0,
      failed: 0,
      skipped: 0,
    };

    if (log.status === "SENT") {
      current.sent += 1;
      sentCount += 1;
    } else if (log.status === "FAILED") {
      current.failed += 1;
      failedCount += 1;
    } else if (log.status === "SKIPPED") {
      current.skipped += 1;
    }

    byDate.set(date, current);
  }

  const trend = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return { trend, sentCount, failedCount };
}

export async function fetchTrendsData(filters: TrendsFilters): Promise<TrendsData> {
  const [branches, metrics, expenses, alertLogs] = await Promise.all([
    fetchAllPages((page, pageSize) => listBranches({ page, pageSize })),
    fetchAllPages((page, pageSize) =>
      listMetrics({
        page,
        pageSize,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    ),
    fetchAllPages((page, pageSize) =>
      listExpenses({
        page,
        pageSize,
        branchId: filters.branchId,
      }),
    ),
    fetchAllPages((page, pageSize) =>
      listAlertLogs({
        page,
        pageSize,
        branchId: filters.branchId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    ),
  ]);

  const cashTrend = buildCashTrend(metrics);
  const latestCashPoint = cashTrend[cashTrend.length - 1];

  const expenseAnalytics = buildExpenseAnalytics(expenses, branches);
  const alertsAnalytics = buildAlertsHealthTrend(alertLogs);

  const alertFailureRate =
    alertsAnalytics.sentCount + alertsAnalytics.failedCount > 0
      ? (alertsAnalytics.failedCount /
          (alertsAnalytics.sentCount + alertsAnalytics.failedCount)) *
        100
      : 0;

  return {
    kpis: {
      totalCashOnBranch: latestCashPoint?.cashOnBranch ?? 0,
      totalOutstandingBalance: expenseAnalytics.totalOutstandingBalance,
      overdueAmount: expenseAnalytics.overdueAmount,
      overdueCount: expenseAnalytics.overdueCount,
      dueNext7Amount: expenseAnalytics.dueNext7Amount,
      alertFailureRate,
    },
    cashTrend,
    outstandingByBranch: expenseAnalytics.outstandingByBranch,
    dueRiskTimeline: expenseAnalytics.dueRiskTimeline,
    expenseTypeMix: expenseAnalytics.expenseTypeMix,
    alertsHealthTrend: alertsAnalytics.trend,
  };
}
