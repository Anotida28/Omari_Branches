import { Prisma, type BranchMetric } from "@prisma/client";

import { prisma } from "../db/prisma";
import { getPagination } from "../utils/pagination";

export class MetricServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "MetricServiceError";
  }
}

export type MetricUpsertInput = {
  agentLineId: bigint;
  date: Date;
  eFloatBalance: number;
  cashInVolume: number;
  cashInValue: number;
  cashOutVolume: number;
  cashOutValue: number;
  totalTransactionVolume: number;
  totalTransactionValue: number;
  commissionOnDeposits: number;
  commissionOnWithdrawals: number;
  totalCommission: number;
};

export type MetricListParams = {
  branchId?: bigint;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  pageSize?: number;
};

export type MetricResponse = {
  id: string;
  branchId: string;
  date: string;
  eFloatBalance: string;
  cashInVolume: number;
  cashInValue: string;
  cashOutVolume: number;
  cashOutValue: string;
  totalTransactionVolume: number;
  totalTransactionValue: string;
  commissionOnDeposits: string;
  commissionOnWithdrawals: string;
  totalCommission: string;
  netCashValue: string;
  netCashVolume: number;
  sourceLineCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MetricListResult = {
  items: MetricResponse[];
  page: number;
  pageSize: number;
  total: number;
};

function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

function toMetricResponse(metric: BranchMetric): MetricResponse {
  const cashInValue = new Prisma.Decimal(metric.cashInValue);
  const cashOutValue = new Prisma.Decimal(metric.cashOutValue);
  const netCashValue = cashInValue.minus(cashOutValue);

  return {
    id: metric.id.toString(),
    branchId: metric.branchId.toString(),
    date: metric.metricDate.toISOString().slice(0, 10),
    eFloatBalance: decimalToString(metric.eFloatBalance),
    cashInVolume: metric.cashInVolume,
    cashInValue: decimalToString(metric.cashInValue),
    cashOutVolume: metric.cashOutVolume,
    cashOutValue: decimalToString(metric.cashOutValue),
    totalTransactionVolume: metric.totalTransactionVolume,
    totalTransactionValue: decimalToString(metric.totalTransactionValue),
    commissionOnDeposits: decimalToString(metric.commissionOnDeposits),
    commissionOnWithdrawals: decimalToString(metric.commissionOnWithdrawals),
    totalCommission: decimalToString(metric.totalCommission),
    netCashValue: netCashValue.toString(),
    netCashVolume: metric.cashInVolume - metric.cashOutVolume,
    sourceLineCount: 0,
    createdAt: metric.createdAt,
    updatedAt: metric.updatedAt,
  };
}

function withSourceLineCount(
  metric: MetricResponse,
  sourceLineCount: number,
): MetricResponse {
  return {
    ...metric,
    sourceLineCount,
  };
}

async function getSourceLineCount(
  branchId: bigint,
  metricDate: Date,
): Promise<number> {
  return prisma.agentLineMetric.count({
    where: {
      metricDate,
      agentLine: {
        branchId,
      },
    },
  });
}

// Returns a map keyed by "branchId::YYYY-MM-DD" -> count of AgentLineMetric rows.
// Resolves all items in 2 queries instead of 1 per item.
async function getBatchSourceLineCounts(
  items: Array<{ branchId: bigint; metricDate: Date }>,
): Promise<Map<string, number>> {
  if (items.length === 0) {
    return new Map();
  }

  const uniqueBranchIds = Array.from(
    new Set(items.map((m) => m.branchId.toString())),
  ).map((id) => BigInt(id));

  const uniqueMetricDates = Array.from(
    new Set(items.map((m) => m.metricDate.toISOString())),
  ).map((s) => new Date(s));

  // Query 1: get all agent line IDs that belong to these branches
  const agentLines = await prisma.branchAgentLine.findMany({
    where: { branchId: { in: uniqueBranchIds } },
    select: { id: true, branchId: true },
  });

  if (agentLines.length === 0) {
    return new Map();
  }

  const branchIdByAgentLineId = new Map<string, bigint>(
    agentLines.map((al) => [al.id.toString(), al.branchId]),
  );

  // Query 2: count AgentLineMetric rows grouped by (agentLineId, metricDate)
  const grouped = await prisma.agentLineMetric.groupBy({
    by: ["agentLineId", "metricDate"],
    where: {
      agentLineId: { in: agentLines.map((al) => al.id) },
      metricDate: { in: uniqueMetricDates },
    },
    _count: { _all: true },
  });

  // Fold agentLine-level counts up to branch-level counts
  const countMap = new Map<string, number>();
  for (const row of grouped) {
    const branchId = branchIdByAgentLineId.get(row.agentLineId.toString());
    if (!branchId) {
      continue;
    }
    const key = `${branchId.toString()}::${row.metricDate.toISOString().slice(0, 10)}`;
    countMap.set(key, (countMap.get(key) ?? 0) + row._count._all);
  }

  return countMap;
}

export async function recomputeBranchMetricForDate(
  branchId: bigint,
  metricDate: Date,
): Promise<BranchMetric | null> {
  const where: Prisma.AgentLineMetricWhereInput = {
    metricDate,
    agentLine: {
      branchId,
    },
  };

  const [lineCount, aggregate] = await Promise.all([
    prisma.agentLineMetric.count({ where }),
    prisma.agentLineMetric.aggregate({
      where,
      _sum: {
        eFloatBalance: true,
        cashInVolume: true,
        cashInValue: true,
        cashOutVolume: true,
        cashOutValue: true,
        totalTransactionVolume: true,
        totalTransactionValue: true,
        commissionOnDeposits: true,
        commissionOnWithdrawals: true,
        totalCommission: true,
      },
    }),
  ]);

  if (lineCount === 0) {
    await prisma.branchMetric.deleteMany({
      where: {
        branchId,
        metricDate,
      },
    });
    return null;
  }

  return prisma.branchMetric.upsert({
    where: {
      uq_branch_date: {
        branchId,
        metricDate,
      },
    },
    update: {
      eFloatBalance: aggregate._sum.eFloatBalance ?? 0,
      cashInVolume: aggregate._sum.cashInVolume ?? 0,
      cashInValue: aggregate._sum.cashInValue ?? 0,
      cashOutVolume: aggregate._sum.cashOutVolume ?? 0,
      cashOutValue: aggregate._sum.cashOutValue ?? 0,
      totalTransactionVolume: aggregate._sum.totalTransactionVolume ?? 0,
      totalTransactionValue: aggregate._sum.totalTransactionValue ?? 0,
      commissionOnDeposits: aggregate._sum.commissionOnDeposits ?? 0,
      commissionOnWithdrawals: aggregate._sum.commissionOnWithdrawals ?? 0,
      totalCommission: aggregate._sum.totalCommission ?? 0,
    },
    create: {
      branchId,
      metricDate,
      eFloatBalance: aggregate._sum.eFloatBalance ?? 0,
      cashInVolume: aggregate._sum.cashInVolume ?? 0,
      cashInValue: aggregate._sum.cashInValue ?? 0,
      cashOutVolume: aggregate._sum.cashOutVolume ?? 0,
      cashOutValue: aggregate._sum.cashOutValue ?? 0,
      totalTransactionVolume: aggregate._sum.totalTransactionVolume ?? 0,
      totalTransactionValue: aggregate._sum.totalTransactionValue ?? 0,
      commissionOnDeposits: aggregate._sum.commissionOnDeposits ?? 0,
      commissionOnWithdrawals: aggregate._sum.commissionOnWithdrawals ?? 0,
      totalCommission: aggregate._sum.totalCommission ?? 0,
    },
  });
}

function enumerateMetricDates(dateFrom: Date, dateTo: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(dateFrom.getTime());

  while (cursor.getTime() <= dateTo.getTime()) {
    dates.push(
      new Date(
        Date.UTC(
          cursor.getUTCFullYear(),
          cursor.getUTCMonth(),
          cursor.getUTCDate(),
        ),
      ),
    );
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export async function recomputeBranchMetricsForWindow(
  branchIds: bigint[],
  dateFrom: Date,
  dateTo: Date,
): Promise<number> {
  const uniqueBranchIds = Array.from(new Set(branchIds.map((branchId) => branchId.toString())))
    .map((branchId) => BigInt(branchId));
  const metricDates = enumerateMetricDates(dateFrom, dateTo);

  let refreshedCount = 0;
  for (const branchId of uniqueBranchIds) {
    for (const metricDate of metricDates) {
      await recomputeBranchMetricForDate(branchId, metricDate);
      refreshedCount += 1;
    }
  }

  return refreshedCount;
}

function mapForeignKeyError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new MetricServiceError("Branch not found", 404);
    }
  }
  throw error;
}

export async function upsertMetric(
  input: MetricUpsertInput,
): Promise<MetricResponse> {
  try {
    const agentLine = await prisma.branchAgentLine.findUnique({
      where: {
        id: input.agentLineId,
      },
      select: {
        id: true,
        branchId: true,
        isActive: true,
      },
    });

    if (!agentLine) {
      throw new MetricServiceError("Agent line not found", 404);
    }

    if (!agentLine.isActive) {
      throw new MetricServiceError("Agent line is inactive", 400);
    }

    await prisma.agentLineMetric.upsert({
      where: {
        uq_agent_line_date: {
          agentLineId: input.agentLineId,
          metricDate: input.date,
        },
      },
      update: {
        eFloatBalance: input.eFloatBalance,
        cashInVolume: input.cashInVolume,
        cashInValue: input.cashInValue,
        cashOutVolume: input.cashOutVolume,
        cashOutValue: input.cashOutValue,
        totalTransactionVolume: input.totalTransactionVolume,
        totalTransactionValue: input.totalTransactionValue,
        commissionOnDeposits: input.commissionOnDeposits,
        commissionOnWithdrawals: input.commissionOnWithdrawals,
        totalCommission: input.totalCommission,
      },
      create: {
        agentLineId: input.agentLineId,
        metricDate: input.date,
        eFloatBalance: input.eFloatBalance,
        cashInVolume: input.cashInVolume,
        cashInValue: input.cashInValue,
        cashOutVolume: input.cashOutVolume,
        cashOutValue: input.cashOutValue,
        totalTransactionVolume: input.totalTransactionVolume,
        totalTransactionValue: input.totalTransactionValue,
        commissionOnDeposits: input.commissionOnDeposits,
        commissionOnWithdrawals: input.commissionOnWithdrawals,
        totalCommission: input.totalCommission,
      },
    });

    const metric = await recomputeBranchMetricForDate(agentLine.branchId, input.date);
    if (!metric) {
      throw new MetricServiceError("Failed to recompute branch metric", 500);
    }
    const sourceLineCount = await getSourceLineCount(metric.branchId, metric.metricDate);

    return withSourceLineCount(toMetricResponse(metric), sourceLineCount);
  } catch (error) {
    mapForeignKeyError(error);
  }
}

export async function listMetrics(
  params: MetricListParams,
): Promise<MetricListResult> {
  const { page, pageSize, skip, take } = getPagination(
    params.page,
    params.pageSize,
  );

  const where: Prisma.BranchMetricWhereInput = {};

  if (params.branchId !== undefined) {
    where.branchId = params.branchId;
  }

  if (params.dateFrom || params.dateTo) {
    where.metricDate = {
      ...(params.dateFrom ? { gte: params.dateFrom } : {}),
      ...(params.dateTo ? { lte: params.dateTo } : {}),
    };
  }

  const [total, items] = await Promise.all([
    prisma.branchMetric.count({ where }),
    prisma.branchMetric.findMany({
      where,
      skip,
      take,
      orderBy: [{ metricDate: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const countMap = await getBatchSourceLineCounts(items);

  return {
    items: items.map((metric) => {
      const key = `${metric.branchId.toString()}::${metric.metricDate.toISOString().slice(0, 10)}`;
      return withSourceLineCount(toMetricResponse(metric), countMap.get(key) ?? 0);
    }),
    page,
    pageSize,
    total,
  };
}

export async function getMetricById(
  id: bigint,
): Promise<MetricResponse | null> {
  const metric = await prisma.branchMetric.findUnique({
    where: { id },
  });

  if (!metric) {
    return null;
  }

  const sourceLineCount = await getSourceLineCount(metric.branchId, metric.metricDate);
  return withSourceLineCount(toMetricResponse(metric), sourceLineCount);
}

export async function getMetricByBranchDate(
  branchId: bigint,
  date: Date,
): Promise<MetricResponse | null> {
  const metric = await prisma.branchMetric.findUnique({
    where: {
      uq_branch_date: {
        branchId,
        metricDate: date,
      },
    },
  });

  if (!metric) {
    return null;
  }

  const sourceLineCount = await getSourceLineCount(metric.branchId, metric.metricDate);
  return withSourceLineCount(toMetricResponse(metric), sourceLineCount);
}

export async function deleteMetric(id: bigint): Promise<boolean> {
  const metric = await prisma.branchMetric.findUnique({
    where: { id },
    select: {
      branchId: true,
      metricDate: true,
    },
  });

  if (!metric) {
    return false;
  }

  await prisma.$transaction([
    prisma.agentLineMetric.deleteMany({
      where: {
        metricDate: metric.metricDate,
        agentLine: {
          branchId: metric.branchId,
        },
      },
    }),
    prisma.branchMetric.delete({ where: { id } }),
  ]);

  return true;
}
