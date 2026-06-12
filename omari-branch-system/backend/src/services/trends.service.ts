import type { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "../db/prisma";

function toNum(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

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

export type TrendsDataResult = {
  kpis: TrendsKpis;
  cashTrend: CashTrendPoint[];
  branchPerformance: BranchPerformancePoint[];
};

export type TrendsParams = {
  branchId?: bigint;
  dateFrom: Date;
  dateTo: Date;
};

export async function getTrendsData(params: TrendsParams): Promise<TrendsDataResult> {
  const metricWhere = {
    metricDate: { gte: params.dateFrom, lte: params.dateTo },
    ...(params.branchId ? { branchId: params.branchId } : {}),
  };

  const [byDate, byBranch] = await Promise.all([
    prisma.branchMetric.groupBy({
      by: ["metricDate"],
      _sum: {
        eFloatBalance: true,
        cashInVolume: true,
        cashOutVolume: true,
        totalTransactionVolume: true,
        cashInValue: true,
        cashOutValue: true,
        totalTransactionValue: true,
        totalCommission: true,
      },
      where: metricWhere,
      orderBy: { metricDate: "asc" },
    }),
    prisma.branchMetric.groupBy({
      by: ["branchId"],
      _sum: { totalTransactionValue: true, totalCommission: true },
      where: metricWhere,
      orderBy: { _sum: { totalTransactionValue: "desc" } },
      take: 10,
    }),
  ]);

  const cashTrend: CashTrendPoint[] = byDate.map((row) => {
    const cashIn = toNum(row._sum.cashInValue);
    const cashOut = toNum(row._sum.cashOutValue);
    return {
      date: row.metricDate.toISOString().slice(0, 10),
      eFloatBalance: toNum(row._sum.eFloatBalance),
      cashInVolume: row._sum.cashInVolume ?? 0,
      cashOutVolume: row._sum.cashOutVolume ?? 0,
      totalTransactionVolume: row._sum.totalTransactionVolume ?? 0,
      cashInValue: cashIn,
      cashOutValue: cashOut,
      totalTransactionValue: toNum(row._sum.totalTransactionValue),
      totalCommission: toNum(row._sum.totalCommission),
      netCashValue: cashIn - cashOut,
    };
  });

  const latestPoint = cashTrend[cashTrend.length - 1];
  const kpis: TrendsKpis = {
    latestTotalEFloat: latestPoint?.eFloatBalance ?? 0,
    totalTransactionValue: cashTrend.reduce((s, p) => s + p.totalTransactionValue, 0),
    totalTransactionVolume: cashTrend.reduce((s, p) => s + p.totalTransactionVolume, 0),
    totalCommission: cashTrend.reduce((s, p) => s + p.totalCommission, 0),
  };

  const top10Ids = byBranch.map((r) => r.branchId);
  if (top10Ids.length === 0) {
    return { kpis, cashTrend, branchPerformance: [] };
  }

  const [branches, eFloatRows] = await Promise.all([
    prisma.branch.findMany({
      where: { id: { in: top10Ids }, isActive: true },
      select: { id: true, city: true, label: true },
    }),
    prisma.branchMetric.findMany({
      where: { branchId: { in: top10Ids }, metricDate: { gte: params.dateFrom, lte: params.dateTo } },
      select: { branchId: true, eFloatBalance: true, metricDate: true },
      orderBy: { metricDate: "desc" },
    }),
  ]);

  // First row per branchId is the latest (ordered desc)
  const latestEFloat = new Map<string, number>();
  for (const row of eFloatRows) {
    const key = row.branchId.toString();
    if (!latestEFloat.has(key)) {
      latestEFloat.set(key, toNum(row.eFloatBalance));
    }
  }

  const branchMap = new Map(branches.map((b) => [b.id.toString(), b]));

  const branchPerformance: BranchPerformancePoint[] = byBranch
    .filter((r) => branchMap.has(r.branchId.toString()))
    .map((r) => {
      const branch = branchMap.get(r.branchId.toString())!;
      return {
        branchId: r.branchId.toString(),
        branchName: `${branch.city} - ${branch.label}`,
        latestEFloatBalance: latestEFloat.get(r.branchId.toString()) ?? 0,
        totalTransactionValue: toNum(r._sum.totalTransactionValue),
        totalCommission: toNum(r._sum.totalCommission),
      };
    });

  return { kpis, cashTrend, branchPerformance };
}
