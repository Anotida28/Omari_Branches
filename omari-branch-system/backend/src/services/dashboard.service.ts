import type { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "../db/prisma";

function toNum(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

export type DashboardLeaderItem = {
  branchId: string;
  branchName: string;
  city: string;
  metricValue: number;
  secondaryValue: number;
};

export type DashboardOverviewResult = {
  totalBranches: number;
  totalExpenses: number;
  totalReminderAmount: number;
  latestTotalEFloat: number;
  latestMetricDate: string | null;
  leaders: {
    byPerformance: DashboardLeaderItem[];
    byEFloat: DashboardLeaderItem[];
  };
};

export async function getDashboardOverview(): Promise<DashboardOverviewResult> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);
  thirtyDaysAgo.setUTCHours(0, 0, 0, 0);

  // Phase 1: parallel - counts and latest metric date
  const [totalBranches, expenseSummary, latestMetricAgg] = await Promise.all([
    prisma.branch.count({ where: { isActive: true } }),
    prisma.expense.aggregate({ _count: { _all: true }, _sum: { amount: true } }),
    prisma.branchMetric.aggregate({ _max: { metricDate: true } }),
  ]);

  const latestDate = latestMetricAgg._max.metricDate;
  const latestMetricDate = latestDate ? latestDate.toISOString().slice(0, 10) : null;

  // Phase 2: parallel - e-float total, performance window, and e-float leaders
  const [latestEFloatAgg, windowPerf, eFloatLeadersRaw] = await Promise.all([
    latestDate
      ? prisma.branchMetric.aggregate({
          _sum: { eFloatBalance: true },
          where: { metricDate: latestDate },
        })
      : Promise.resolve({ _sum: { eFloatBalance: null as Decimal | null } }),

    prisma.branchMetric.groupBy({
      by: ["branchId"],
      _sum: { totalTransactionValue: true },
      where: { metricDate: { gte: thirtyDaysAgo } },
      orderBy: { _sum: { totalTransactionValue: "desc" } },
      take: 10,
    }),

    latestDate
      ? prisma.branchMetric.findMany({
          where: { metricDate: latestDate },
          select: { branchId: true, eFloatBalance: true },
          orderBy: { eFloatBalance: "desc" },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  // Fetch branch names for all leader IDs in one query
  const allLeaderIds = new Set([
    ...windowPerf.map((r) => r.branchId),
    ...eFloatLeadersRaw.map((r) => r.branchId),
  ]);

  const branches =
    allLeaderIds.size > 0
      ? await prisma.branch.findMany({
          where: { id: { in: Array.from(allLeaderIds) }, isActive: true },
          select: { id: true, city: true, label: true },
        })
      : [];
  const branchMap = new Map(branches.map((b) => [b.id, b]));

  // Window performance map: branchId → sum
  const windowPerfMap = new Map(
    windowPerf.map((r) => [r.branchId, toNum(r._sum.totalTransactionValue)]),
  );

  // Latest e-float map: branchId → e-float
  const latestEFloatMap = new Map(
    eFloatLeadersRaw.map((r) => [r.branchId, toNum(r.eFloatBalance)]),
  );

  // Build byPerformance — need latest e-float per branch as secondary
  const perfLeaderIds = windowPerf
    .filter((r) => branchMap.has(r.branchId))
    .slice(0, 5)
    .map((r) => r.branchId);

  // Fetch latest e-float for performance leaders not already covered
  const missingFromEFloatMap = perfLeaderIds.filter((id) => !latestEFloatMap.has(id));
  if (missingFromEFloatMap.length > 0 && latestDate) {
    const extra = await prisma.branchMetric.findMany({
      where: { branchId: { in: missingFromEFloatMap }, metricDate: latestDate },
      select: { branchId: true, eFloatBalance: true },
    });
    for (const row of extra) {
      latestEFloatMap.set(row.branchId, toNum(row.eFloatBalance));
    }
  }

  const byPerformance: DashboardLeaderItem[] = perfLeaderIds.map((branchId) => {
    const branch = branchMap.get(branchId)!;
    return {
      branchId: branchId.toString(),
      branchName: `${branch.city} - ${branch.label}`,
      city: branch.city,
      metricValue: windowPerfMap.get(branchId) ?? 0,
      secondaryValue: latestEFloatMap.get(branchId) ?? 0,
    };
  });

  const byEFloat: DashboardLeaderItem[] = eFloatLeadersRaw
    .filter((r) => branchMap.has(r.branchId))
    .slice(0, 5)
    .map((r) => {
      const branch = branchMap.get(r.branchId)!;
      return {
        branchId: r.branchId.toString(),
        branchName: `${branch.city} - ${branch.label}`,
        city: branch.city,
        metricValue: toNum(r.eFloatBalance),
        secondaryValue: windowPerfMap.get(r.branchId) ?? 0,
      };
    });

  return {
    totalBranches,
    totalExpenses: expenseSummary._count._all,
    totalReminderAmount: toNum(expenseSummary._sum.amount),
    latestTotalEFloat: toNum(latestEFloatAgg._sum.eFloatBalance),
    latestMetricDate,
    leaders: { byPerformance, byEFloat },
  };
}
