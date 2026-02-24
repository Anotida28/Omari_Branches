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

type BranchRankingRaw = {
  branch: Branch;
  netCashValue: number;
  cashOnBranch: number;
  outstanding: number;
  overdueCount: number;
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

async function fetchOutstandingBalance(): Promise<number> {
  const expenses = await fetchAllPages((page, pageSize) =>
    listExpenses({ page, pageSize }),
  );
  return expenses.reduce(
    (sum, item) => sum + toMoneyNumber(item.balanceRemaining),
    0,
  );
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const [branches, expenses, overdue, totalOutstandingBalance] =
    await Promise.all([
      listBranches({ page: 1, pageSize: 1 }),
      listExpenses({ page: 1, pageSize: 1 }),
      listExpenses({ status: "OVERDUE", page: 1, pageSize: 1 }),
      fetchOutstandingBalance(),
    ]);

  return {
    totalBranches: branches.total,
    totalExpenses: expenses.total,
    overdueExpenses: overdue.total,
    totalOutstandingBalance,
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
    const rawScore =
      row.netCashValue * 0.65 +
      row.cashOnBranch * 0.25 -
      row.outstanding * 0.1 -
      row.overdueCount * 100;
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

function aggregateExpenseRisk(expenses: Expense[]): {
  outstandingByBranch: Map<string, number>;
  overdueCountByBranch: Map<string, number>;
} {
  const outstandingByBranch = new Map<string, number>();
  const overdueCountByBranch = new Map<string, number>();

  for (const expense of expenses) {
    const outstanding = Math.max(0, toMoneyNumber(expense.balanceRemaining));
    const currentOutstanding = outstandingByBranch.get(expense.branchId) ?? 0;
    outstandingByBranch.set(expense.branchId, currentOutstanding + outstanding);

    if (expense.status === "OVERDUE") {
      const overdue = overdueCountByBranch.get(expense.branchId) ?? 0;
      overdueCountByBranch.set(expense.branchId, overdue + 1);
    }
  }

  return { outstandingByBranch, overdueCountByBranch };
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
  const { outstandingByBranch, overdueCountByBranch } = aggregateExpenseRisk(expenses);

  const rankingRows: BranchRankingRaw[] = branches.map((branch) => {
    const latestMetric = latestMetricByBranch.get(branch.id);
    return {
      branch,
      netCashValue: latestMetric ? toMoneyNumber(latestMetric.netCashValue) : 0,
      cashOnBranch: latestMetric ? toMoneyNumber(latestMetric.cashOnBranch) : 0,
      outstanding: outstandingByBranch.get(branch.id) ?? 0,
      overdueCount: overdueCountByBranch.get(branch.id) ?? 0,
    };
  });

  return {
    totalBranches: branches.length,
    totalExpenses: expenses.length,
    overdueExpenses: expenses.filter((item) => item.status === "OVERDUE").length,
    totalOutstandingBalance: expenses.reduce(
      (sum, item) => sum + toMoneyNumber(item.balanceRemaining),
      0,
    ),
    rankings: buildRankings(rankingRows),
  };
}
