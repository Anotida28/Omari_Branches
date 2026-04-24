import { listBranches } from "./branches";
import { toMoneyNumber } from "./format";
import { listMetrics } from "./metrics";
import type {
  Branch,
  BranchMetric,
  PaginatedResponse,
} from "../types/api";

const PAGE_SIZE = 100;

export type TrendsFilters = {
  branchId?: string;
  dateFrom: string;
  dateTo: string;
};

export type TrendsKpis = {
  latestTotalEFloat: number;
  totalTransactionValue: number;
  totalTransactionVolume: number;
  totalCommission: number;
};

export type CashTrendPoint = {
  date: string;
  eFloatBalance: number;
  cashInVolume: number;
  cashOutVolume: number;
  totalTransactionVolume: number;
  cashInValue: number;
  cashOutValue: number;
  totalTransactionValue: number;
  totalCommission: number;
  netCashValue: number;
};

export type BranchPerformancePoint = {
  branchId: string;
  branchName: string;
  latestEFloatBalance: number;
  totalTransactionValue: number;
  totalCommission: number;
};

export type TrendsData = {
  kpis: TrendsKpis;
  cashTrend: CashTrendPoint[];
  branchPerformance: BranchPerformancePoint[];
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

function buildCashTrend(metrics: BranchMetric[]): CashTrendPoint[] {
  const byDate = new Map<string, CashTrendPoint>();

  for (const metric of metrics) {
    const date = metric.date;
    const current = byDate.get(date) ?? {
      date,
      eFloatBalance: 0,
      cashInVolume: 0,
      cashOutVolume: 0,
      totalTransactionVolume: 0,
      cashInValue: 0,
      cashOutValue: 0,
      totalTransactionValue: 0,
      totalCommission: 0,
      netCashValue: 0,
    };

    current.eFloatBalance += toMoneyNumber(metric.eFloatBalance);
    current.cashInVolume += metric.cashInVolume;
    current.cashOutVolume += metric.cashOutVolume;
    current.totalTransactionVolume += metric.totalTransactionVolume;
    current.cashInValue += toMoneyNumber(metric.cashInValue);
    current.cashOutValue += toMoneyNumber(metric.cashOutValue);
    current.totalTransactionValue += toMoneyNumber(metric.totalTransactionValue);
    current.totalCommission += toMoneyNumber(metric.totalCommission);
    current.netCashValue += toMoneyNumber(metric.netCashValue);

    byDate.set(date, current);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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

function buildBranchPerformance(
  metrics: BranchMetric[],
  branches: Branch[],
): BranchPerformancePoint[] {
  const branchNameById = new Map(branches.map((branch) => [branch.id, branch.displayName]));
  const latestMetricByBranch = computeLatestMetricByBranch(metrics);
  const totalsByBranch = new Map<
    string,
    {
      totalTransactionValue: number;
      totalCommission: number;
    }
  >();

  for (const metric of metrics) {
    const current = totalsByBranch.get(metric.branchId) ?? {
      totalTransactionValue: 0,
      totalCommission: 0,
    };

    current.totalTransactionValue += toMoneyNumber(metric.totalTransactionValue);
    current.totalCommission += toMoneyNumber(metric.totalCommission);
    totalsByBranch.set(metric.branchId, current);
  }

  return Array.from(totalsByBranch.entries())
    .map(([branchId, totals]) => ({
      branchId,
      branchName: branchNameById.get(branchId) ?? branchId,
      latestEFloatBalance: toMoneyNumber(
        latestMetricByBranch.get(branchId)?.eFloatBalance ?? 0,
      ),
      totalTransactionValue: totals.totalTransactionValue,
      totalCommission: totals.totalCommission,
    }))
    .sort((left, right) => right.totalTransactionValue - left.totalTransactionValue)
    .slice(0, 10);
}

export async function fetchTrendsData(filters: TrendsFilters): Promise<TrendsData> {
  const [branches, metrics] = await Promise.all([
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
  ]);

  const cashTrend = buildCashTrend(metrics);
  const latestPoint = cashTrend[cashTrend.length - 1];

  return {
    kpis: {
      latestTotalEFloat: latestPoint?.eFloatBalance ?? 0,
      totalTransactionValue: metrics.reduce(
        (sum, metric) => sum + toMoneyNumber(metric.totalTransactionValue),
        0,
      ),
      totalTransactionVolume: metrics.reduce(
        (sum, metric) => sum + metric.totalTransactionVolume,
        0,
      ),
      totalCommission: metrics.reduce(
        (sum, metric) => sum + toMoneyNumber(metric.totalCommission),
        0,
      ),
    },
    cashTrend,
    branchPerformance: buildBranchPerformance(metrics, branches),
  };
}
