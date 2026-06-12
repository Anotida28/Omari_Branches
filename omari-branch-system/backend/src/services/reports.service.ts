import type { Decimal } from "@prisma/client/runtime/library";

import { prisma } from "../db/prisma";

function toNum(value: Decimal | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return parseFloat(value.toString());
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export type ReportsParams = {
  branchId?: bigint;
  dateFrom: Date;
  dateTo: Date;
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
  expenseType: string;
  expenseCount: number;
  totalAmount: number;
};

export type ReportExpenseLine = {
  id: string;
  branchId: string;
  branchName: string;
  expenseType: string;
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

export type ReportsDataResult = {
  generatedAt: string;
  filters: {
    branchId?: string;
    dateFrom: string;
    dateTo: string;
  };
  availableBranches: Array<{ id: string; displayName: string }>;
  totals: ReportTotals;
  branchSummary: ReportBranchSummary[];
  performanceSummary: ReportPerformanceSummary[];
  expenseTypeSummary: ReportExpenseTypeSummary[];
  expenses: ReportExpenseLine[];
};

export async function getReportsData(params: ReportsParams): Promise<ReportsDataResult> {
  const metricWhere = {
    metricDate: { gte: params.dateFrom, lte: params.dateTo },
    ...(params.branchId ? { branchId: params.branchId } : {}),
  };
  const expenseWhere = {
    dueDate: { gte: params.dateFrom, lte: params.dateTo },
    ...(params.branchId ? { branchId: params.branchId } : {}),
  };

  // Phase 1: parallel queries
  const [
    allBranches,
    expenseLines,
    expensesByBranch,
    expensesByType,
    metricsByBranch,
    metricsAgg,
    latestDateAgg,
  ] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, city: true, label: true },
      orderBy: [{ city: "asc" }, { label: "asc" }],
    }),
    prisma.expense.findMany({
      where: expenseWhere,
      select: {
        id: true,
        branchId: true,
        expenseType: true,
        period: true,
        dueDate: true,
        amount: true,
        vendor: true,
        currency: true,
      },
      orderBy: { dueDate: "desc" },
    }),
    prisma.expense.groupBy({
      by: ["branchId"],
      _count: { _all: true },
      _sum: { amount: true },
      where: expenseWhere,
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.expense.groupBy({
      by: ["expenseType"],
      _count: { _all: true },
      _sum: { amount: true },
      where: expenseWhere,
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.branchMetric.groupBy({
      by: ["branchId"],
      _count: { _all: true },
      _sum: {
        cashInValue: true,
        cashOutValue: true,
        totalTransactionValue: true,
        totalCommission: true,
      },
      where: metricWhere,
      orderBy: { _sum: { totalTransactionValue: "desc" } },
    }),
    prisma.branchMetric.aggregate({
      _count: { _all: true },
      _sum: {
        cashInValue: true,
        cashOutValue: true,
        totalTransactionValue: true,
        totalCommission: true,
      },
      where: metricWhere,
    }),
    prisma.branchMetric.aggregate({
      _max: { metricDate: true },
      where: metricWhere,
    }),
  ]);

  // Phase 2: latest e-float (needs latestDate from phase 1)
  const latestDate = latestDateAgg._max.metricDate;
  const latestEFloatAgg = latestDate
    ? await prisma.branchMetric.aggregate({
        _sum: { eFloatBalance: true },
        where: { ...metricWhere, metricDate: latestDate },
      })
    : { _sum: { eFloatBalance: null as Decimal | null } };

  // Latest e-float per branch (for performanceSummary)
  const perfBranchIds = metricsByBranch.map((r) => r.branchId);
  let latestEFloatPerBranch = new Map<string, number>();
  if (perfBranchIds.length > 0 && latestDate) {
    const rows = await prisma.branchMetric.findMany({
      where: { branchId: { in: perfBranchIds }, metricDate: { gte: params.dateFrom, lte: params.dateTo } },
      select: { branchId: true, eFloatBalance: true, metricDate: true },
      orderBy: { metricDate: "desc" },
    });
    for (const row of rows) {
      const key = row.branchId.toString();
      if (!latestEFloatPerBranch.has(key)) {
        latestEFloatPerBranch.set(key, toNum(row.eFloatBalance));
      }
    }
  }

  // Build lookup maps
  const branchMap = new Map(
    allBranches.map((b) => [b.id.toString(), `${b.city} - ${b.label}`]),
  );

  const availableBranches = allBranches.map((b) => ({
    id: b.id.toString(),
    displayName: `${b.city} - ${b.label}`,
  }));

  const branchSummary: ReportBranchSummary[] = expensesByBranch.map((r) => ({
    branchId: r.branchId.toString(),
    branchName: branchMap.get(r.branchId.toString()) ?? r.branchId.toString(),
    expenseCount: r._count._all,
    totalAmount: toNum(r._sum.amount),
  }));

  const performanceSummary: ReportPerformanceSummary[] = metricsByBranch.map((r) => ({
    branchId: r.branchId.toString(),
    branchName: branchMap.get(r.branchId.toString()) ?? r.branchId.toString(),
    metricsCount: r._count._all,
    totalCashInValue: toNum(r._sum.cashInValue),
    totalCashOutValue: toNum(r._sum.cashOutValue),
    totalTransactionValue: toNum(r._sum.totalTransactionValue),
    totalCommission: toNum(r._sum.totalCommission),
    latestEFloatBalance: latestEFloatPerBranch.get(r.branchId.toString()) ?? 0,
  }));

  const expenseTypeSummary: ReportExpenseTypeSummary[] = expensesByType.map((r) => ({
    expenseType: r.expenseType,
    expenseCount: r._count._all,
    totalAmount: toNum(r._sum.amount),
  }));

  const expenses: ReportExpenseLine[] = expenseLines.map((e) => ({
    id: e.id.toString(),
    branchId: e.branchId.toString(),
    branchName: branchMap.get(e.branchId.toString()) ?? e.branchId.toString(),
    expenseType: e.expenseType,
    period: e.period,
    dueDate: formatDate(e.dueDate),
    amount: toNum(e.amount),
    vendor: e.vendor,
    currency: e.currency,
  }));

  const totals: ReportTotals = {
    expenseCount: expenseLines.length,
    totalAmount: expensesByBranch.reduce((s, r) => s + toNum(r._sum.amount), 0),
    metricsCount: metricsAgg._count._all,
    totalCashInValue: toNum(metricsAgg._sum.cashInValue),
    totalCashOutValue: toNum(metricsAgg._sum.cashOutValue),
    totalTransactionValue: toNum(metricsAgg._sum.totalTransactionValue),
    totalCommission: toNum(metricsAgg._sum.totalCommission),
    latestEFloatBalance: toNum(latestEFloatAgg._sum.eFloatBalance),
  };

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      ...(params.branchId ? { branchId: params.branchId.toString() } : {}),
      dateFrom: formatDate(params.dateFrom),
      dateTo: formatDate(params.dateTo),
    },
    availableBranches,
    totals,
    branchSummary,
    performanceSummary,
    expenseTypeSummary,
    expenses,
  };
}
