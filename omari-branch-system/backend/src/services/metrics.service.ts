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
  branchId: bigint;
  date: Date;
  cashBalance: number;
  eFloatBalance: number;
  cashInVault: number;
  cashInVolume: number;
  cashInValue: number;
  cashOutVolume: number;
  cashOutValue: number;
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
  cashBalance: string;
  eFloatBalance: string;
  cashInVault: string;
  cashOnBranch: string;
  cashInVolume: number;
  cashInValue: string;
  cashOutVolume: number;
  cashOutValue: string;
  netCashValue: string;
  netCashVolume: number;
  createdAt: Date;
  updatedAt: Date;
};

export type MetricListResult = {
  items: MetricResponse[];
  page: number;
  pageSize: number;
  total: number;
};

type BranchMetricWithBalances = BranchMetric & {
  eFloatBalance?: Prisma.Decimal | number | string | null;
  cashInVault?: Prisma.Decimal | number | string | null;
};

function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toString();
}

function toMetricResponse(metric: BranchMetric): MetricResponse {
  const metricWithBalances = metric as BranchMetricWithBalances;
  const cashBalance = new Prisma.Decimal(metric.cashBalance);
  const eFloatBalance = new Prisma.Decimal(metricWithBalances.eFloatBalance ?? 0);
  const cashInVault = new Prisma.Decimal(metricWithBalances.cashInVault ?? 0);
  const cashOnBranch = cashBalance.plus(eFloatBalance).plus(cashInVault);
  const cashInValue = new Prisma.Decimal(metric.cashInValue);
  const cashOutValue = new Prisma.Decimal(metric.cashOutValue);
  const netCashValue = cashInValue.minus(cashOutValue);

  return {
    id: metric.id.toString(),
    branchId: metric.branchId.toString(),
    date: metric.metricDate.toISOString().slice(0, 10),
    cashBalance: cashBalance.toString(),
    eFloatBalance: eFloatBalance.toString(),
    cashInVault: cashInVault.toString(),
    cashOnBranch: cashOnBranch.toString(),
    cashInVolume: metric.cashInVolume,
    cashInValue: decimalToString(metric.cashInValue),
    cashOutVolume: metric.cashOutVolume,
    cashOutValue: decimalToString(metric.cashOutValue),
    netCashValue: netCashValue.toString(),
    netCashVolume: metric.cashInVolume - metric.cashOutVolume,
    createdAt: metric.createdAt,
    updatedAt: metric.updatedAt,
  };
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
  const updateData = {
    cashBalance: input.cashBalance,
    eFloatBalance: input.eFloatBalance,
    cashInVault: input.cashInVault,
    cashInVolume: input.cashInVolume,
    cashInValue: input.cashInValue,
    cashOutVolume: input.cashOutVolume,
    cashOutValue: input.cashOutValue,
  } as Prisma.BranchMetricUpdateInput;

  const createData = {
    branchId: input.branchId,
    metricDate: input.date,
    cashBalance: input.cashBalance,
    eFloatBalance: input.eFloatBalance,
    cashInVault: input.cashInVault,
    cashInVolume: input.cashInVolume,
    cashInValue: input.cashInValue,
    cashOutVolume: input.cashOutVolume,
    cashOutValue: input.cashOutValue,
  } as Prisma.BranchMetricUncheckedCreateInput;

  try {
    const metric = await prisma.branchMetric.upsert({
      where: {
        uq_branch_date: {
          branchId: input.branchId,
          metricDate: input.date,
        },
      },
      update: updateData,
      create: createData,
    });

    return toMetricResponse(metric);
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

  return {
    items: items.map(toMetricResponse),
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

  return metric ? toMetricResponse(metric) : null;
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

  return metric ? toMetricResponse(metric) : null;
}

export async function deleteMetric(id: bigint): Promise<boolean> {
  try {
    await prisma.branchMetric.delete({ where: { id } });
    return true;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return false;
    }
    throw error;
  }
}
