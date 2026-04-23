import { listBranches } from "./branches";
import { listExpenses } from "./expenses";
import { toMoneyNumber } from "./format";
import { listMetrics } from "./metrics";
import { isReminderOverdue } from "./reminders";
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

type BranchRankingRaw = {
  branch: Branch;
  netCashValue: number;
  cashOnBranch: number;
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
  overdueExpenses: number;
  totalReminderAmount: number;
} {
  return expenses.reduce(
    (summary, expense) => ({
      overdueExpenses:
        summary.overdueExpenses + (isReminderOverdue(expense.dueDate) ? 1 : 0),
      totalReminderAmount:
        summary.totalReminderAmount + toMoneyNumber(expense.amount),
    }),
    {
      overdueExpenses: 0,
      totalReminderAmount: 0,
    },
  );
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [branches, expenses] = await Promise.all([
    listBranches({ page: 1, pageSize: 1 }),
    fetchAllPages((page, pageSize) => listExpenses({ page, pageSize })),
  ]);

  const reminderSummary = summarizeReminders(expenses);

  return {
    totalBranches: branches.total,
    totalExpenses: expenses.length,
    overdueExpenses: reminderSummary.overdueExpenses,
    totalReminderAmount: reminderSummary.totalReminderAmount,
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

function buildRankings(rawRows: BranchRankingRaw[]): {
  top: DashboardRankingItem[];
  bottom: DashboardRankingItem[];
} {
  if (rawRows.length === 0) {
    return { top: [], bottom: [] };
  }

  const withRawScore = rawRows.map((row) => {
    const rawScore = row.netCashValue * 0.7 + row.cashOnBranch * 0.3;
    return { ...row, rawScore };
  });

  const minRaw = Math.min(...withRawScore.map((row) => row.rawScore));
  const maxRaw = Math.max(...withRawScore.map((row) => row.rawScore));

  const normalize = (value: number) => {
    if (maxRaw === minRaw) {
      return 50;
    }
    return ((value - minRaw) / (maxRaw - minRaw)) * 100;
  };

  const scored = withRawScore.map((row) => ({
    branchId: row.branch.id,
    branchName: row.branch.displayName,
    city: row.branch.city,
    performanceScore: normalize(row.rawScore),
    netCashValue: row.netCashValue,
    rawScore: row.rawScore,
  }));

  const descending = [...scored].sort((a, b) => b.rawScore - a.rawScore);
  const ascending = [...scored].sort((a, b) => a.rawScore - b.rawScore);

  return {
    top: descending.slice(0, 5).map(({ rawScore: _rawScore, ...item }) => item),
    bottom: ascending.slice(0, 5).map(({ rawScore: _rawScore, ...item }) => item),
  };
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
  const reminderSummary = summarizeReminders(expenses);

  const rankingRows: BranchRankingRaw[] = branches.map((branch) => {
    const latestMetric = latestMetricByBranch.get(branch.id);
    return {
      branch,
      netCashValue: latestMetric ? toMoneyNumber(latestMetric.netCashValue) : 0,
      cashOnBranch: latestMetric ? toMoneyNumber(latestMetric.cashOnBranch) : 0,
    };
  });

  return {
    totalBranches: branches.length,
    totalExpenses: expenses.length,
    overdueExpenses: reminderSummary.overdueExpenses,
    totalReminderAmount: reminderSummary.totalReminderAmount,
    rankings: buildRankings(rankingRows),
  };
}
