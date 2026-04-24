import { listBranches } from "./branches";
import { listExpenses } from "./expenses";
import { toMoneyNumber } from "./format";
import { listMetrics } from "./metrics";
import type {
  Branch,
  BranchMetric,
  DashboardOverview,
  DashboardRankingItem,
  DashboardStats,
  Expense,
  PaginatedResponse,
} from "../types/api";

const PAGE_SIZE = 100;

type BranchWindowTotals = {
  totalCommission: number;
  totalTransactionValue: number;
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

function summarizeReminders(expenses: Expense[]): {
  totalReminderAmount: number;
} {
  return expenses.reduce(
    (summary, expense) => ({
      totalReminderAmount:
        summary.totalReminderAmount + toMoneyNumber(expense.amount),
    }),
    {
      totalReminderAmount: 0,
    },
  );
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [branches, expenses, metrics] = await Promise.all([
    listBranches({ page: 1, pageSize: 1 }),
    fetchAllPages((page, pageSize) => listExpenses({ page, pageSize })),
    fetchAllPages((page, pageSize) => listMetrics({ page, pageSize })),
  ]);

  const reminderSummary = summarizeReminders(expenses);
  const latestMetricDate = metrics.reduce<string | null>(
    (latest, metric) => (!latest || metric.date > latest ? metric.date : latest),
    null,
  );
  const latestTotalEFloat = metrics
    .filter((metric) => metric.date === latestMetricDate)
    .reduce((sum, metric) => sum + toMoneyNumber(metric.eFloatBalance), 0);

  return {
    totalBranches: branches.total,
    totalExpenses: expenses.length,
    totalReminderAmount: reminderSummary.totalReminderAmount,
    latestTotalEFloat,
    latestMetricDate,
  };
}

function computeLatestMetricByBranch(metrics: BranchMetric[]): Map<string, BranchMetric> {
  const latestMetricByBranch = new Map<string, BranchMetric>();

  for (const metric of metrics) {
    const current = latestMetricByBranch.get(metric.branchId);
    if (!current || metric.date > current.date) {
      latestMetricByBranch.set(metric.branchId, metric);
    }
  }

  return latestMetricByBranch;
}

function computeWindowTotalsByBranch(metrics: BranchMetric[]): Map<string, BranchWindowTotals> {
  const totalsByBranch = new Map<string, BranchWindowTotals>();

  for (const metric of metrics) {
    const current = totalsByBranch.get(metric.branchId) ?? {
      totalCommission: 0,
      totalTransactionValue: 0,
    };

    current.totalCommission += toMoneyNumber(metric.totalCommission);
    current.totalTransactionValue += toMoneyNumber(metric.totalTransactionValue);
    totalsByBranch.set(metric.branchId, current);
  }

  return totalsByBranch;
}

function buildLeaderList(params: {
  branches: Branch[];
  windowTotalsByBranch: Map<string, BranchWindowTotals>;
  metricValue: (branchId: string) => number;
}): DashboardRankingItem[] {
  return params.branches
    .map((branch) => ({
      branchId: branch.id,
      branchName: branch.displayName,
      city: branch.city,
      metricValue: params.metricValue(branch.id),
      secondaryValue:
        params.windowTotalsByBranch.get(branch.id)?.totalTransactionValue ?? 0,
    }))
    .filter((item) => item.metricValue > 0 || item.secondaryValue > 0)
    .sort((left, right) => right.metricValue - left.metricValue)
    .slice(0, 5);
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const branchesPromise = fetchAllPages((page, pageSize) =>
    listBranches({ page, pageSize }),
  );
  const metricsPromise = fetchAllPages((page, pageSize) =>
    listMetrics({ page, pageSize }),
  );
  const expensesPromise = fetchAllPages((page, pageSize) =>
    listExpenses({ page, pageSize }),
  );

  const [branches, metrics, expenses] = await Promise.all([
    branchesPromise,
    metricsPromise,
    expensesPromise,
  ]);

  const latestMetricByBranch = computeLatestMetricByBranch(metrics);
  const windowTotalsByBranch = computeWindowTotalsByBranch(metrics);
  const reminderSummary = summarizeReminders(expenses);

  const latestMetricDate = metrics.reduce<string | null>(
    (latest, metric) => (!latest || metric.date > latest ? metric.date : latest),
    null,
  );
  const latestTotalEFloat = Array.from(latestMetricByBranch.values()).reduce(
    (sum, metric) => sum + toMoneyNumber(metric.eFloatBalance),
    0,
  );

  return {
    totalBranches: branches.length,
    totalExpenses: expenses.length,
    totalReminderAmount: reminderSummary.totalReminderAmount,
    latestTotalEFloat,
    latestMetricDate,
    leaders: {
      byPerformance: buildLeaderList({
        branches,
        windowTotalsByBranch,
        metricValue: (branchId) =>
          windowTotalsByBranch.get(branchId)?.totalTransactionValue ?? 0,
      }).map((item) => ({
        ...item,
        secondaryValue: toMoneyNumber(
          latestMetricByBranch.get(item.branchId)?.eFloatBalance ?? 0,
        ),
      })),
      byEFloat: buildLeaderList({
        branches,
        windowTotalsByBranch,
        metricValue: (branchId) =>
          toMoneyNumber(latestMetricByBranch.get(branchId)?.eFloatBalance ?? 0),
      }),
    },
  };
}
