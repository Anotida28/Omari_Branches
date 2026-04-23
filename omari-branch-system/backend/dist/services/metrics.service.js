"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricServiceError = void 0;
exports.recomputeBranchMetricForDate = recomputeBranchMetricForDate;
exports.recomputeBranchMetricsForWindow = recomputeBranchMetricsForWindow;
exports.upsertMetric = upsertMetric;
exports.listMetrics = listMetrics;
exports.getMetricById = getMetricById;
exports.getMetricByBranchDate = getMetricByBranchDate;
exports.deleteMetric = deleteMetric;
const client_1 = require("@prisma/client");
const prisma_1 = require("../db/prisma");
const pagination_1 = require("../utils/pagination");
const documents_service_1 = require("./documents.service");
class MetricServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "MetricServiceError";
    }
}
exports.MetricServiceError = MetricServiceError;
function decimalToString(value) {
    return new client_1.Prisma.Decimal(value).toString();
}
function toMetricResponse(metric) {
    const metricWithBalances = metric;
    const cashBalance = new client_1.Prisma.Decimal(metric.cashBalance);
    const eFloatBalance = new client_1.Prisma.Decimal(metricWithBalances.eFloatBalance ?? 0);
    const cashInVault = new client_1.Prisma.Decimal(metricWithBalances.cashInVault ?? 0);
    const cashOnBranch = cashBalance.plus(eFloatBalance).plus(cashInVault);
    const cashInValue = new client_1.Prisma.Decimal(metric.cashInValue);
    const cashOutValue = new client_1.Prisma.Decimal(metric.cashOutValue);
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
        sourceLineCount: 0,
        createdAt: metric.createdAt,
        updatedAt: metric.updatedAt,
    };
}
function withSourceLineCount(metric, sourceLineCount) {
    return {
        ...metric,
        sourceLineCount,
    };
}
async function getSourceLineCount(branchId, metricDate) {
    return prisma_1.prisma.agentLineMetric.count({
        where: {
            metricDate,
            agentLine: {
                branchId,
            },
        },
    });
}
async function recomputeBranchMetricForDate(branchId, metricDate) {
    const where = {
        metricDate,
        agentLine: {
            branchId,
        },
    };
    const [lineCount, aggregate] = await Promise.all([
        prisma_1.prisma.agentLineMetric.count({ where }),
        prisma_1.prisma.agentLineMetric.aggregate({
            where,
            _sum: {
                cashBalance: true,
                eFloatBalance: true,
                cashInVault: true,
                cashInVolume: true,
                cashInValue: true,
                cashOutVolume: true,
                cashOutValue: true,
            },
        }),
    ]);
    if (lineCount === 0) {
        await prisma_1.prisma.branchMetric.deleteMany({
            where: {
                branchId,
                metricDate,
            },
        });
        return null;
    }
    return prisma_1.prisma.branchMetric.upsert({
        where: {
            uq_branch_date: {
                branchId,
                metricDate,
            },
        },
        update: {
            cashBalance: aggregate._sum.cashBalance ?? 0,
            eFloatBalance: aggregate._sum.eFloatBalance ?? 0,
            cashInVault: aggregate._sum.cashInVault ?? 0,
            cashInVolume: aggregate._sum.cashInVolume ?? 0,
            cashInValue: aggregate._sum.cashInValue ?? 0,
            cashOutVolume: aggregate._sum.cashOutVolume ?? 0,
            cashOutValue: aggregate._sum.cashOutValue ?? 0,
        },
        create: {
            branchId,
            metricDate,
            cashBalance: aggregate._sum.cashBalance ?? 0,
            eFloatBalance: aggregate._sum.eFloatBalance ?? 0,
            cashInVault: aggregate._sum.cashInVault ?? 0,
            cashInVolume: aggregate._sum.cashInVolume ?? 0,
            cashInValue: aggregate._sum.cashInValue ?? 0,
            cashOutVolume: aggregate._sum.cashOutVolume ?? 0,
            cashOutValue: aggregate._sum.cashOutValue ?? 0,
        },
    });
}
function enumerateMetricDates(dateFrom, dateTo) {
    const dates = [];
    const cursor = new Date(dateFrom.getTime());
    while (cursor.getTime() <= dateTo.getTime()) {
        dates.push(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate())));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
}
async function recomputeBranchMetricsForWindow(branchIds, dateFrom, dateTo) {
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
function mapForeignKeyError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
            throw new MetricServiceError("Branch not found", 404);
        }
    }
    throw error;
}
async function upsertMetric(input) {
    try {
        const agentLine = await prisma_1.prisma.branchAgentLine.findUnique({
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
        await prisma_1.prisma.agentLineMetric.upsert({
            where: {
                uq_agent_line_date: {
                    agentLineId: input.agentLineId,
                    metricDate: input.date,
                },
            },
            update: {
                cashBalance: input.cashBalance,
                eFloatBalance: input.eFloatBalance,
                cashInVault: input.cashInVault,
                cashInVolume: input.cashInVolume,
                cashInValue: input.cashInValue,
                cashOutVolume: input.cashOutVolume,
                cashOutValue: input.cashOutValue,
            },
            create: {
                agentLineId: input.agentLineId,
                metricDate: input.date,
                cashBalance: input.cashBalance,
                eFloatBalance: input.eFloatBalance,
                cashInVault: input.cashInVault,
                cashInVolume: input.cashInVolume,
                cashInValue: input.cashInValue,
                cashOutVolume: input.cashOutVolume,
                cashOutValue: input.cashOutValue,
            },
        });
        const metric = await recomputeBranchMetricForDate(agentLine.branchId, input.date);
        if (!metric) {
            throw new MetricServiceError("Failed to recompute branch metric", 500);
        }
        const sourceLineCount = await getSourceLineCount(metric.branchId, metric.metricDate);
        return withSourceLineCount(toMetricResponse(metric), sourceLineCount);
    }
    catch (error) {
        mapForeignKeyError(error);
    }
}
async function listMetrics(params) {
    const { page, pageSize, skip, take } = (0, pagination_1.getPagination)(params.page, params.pageSize);
    const where = {};
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
        prisma_1.prisma.branchMetric.count({ where }),
        prisma_1.prisma.branchMetric.findMany({
            where,
            skip,
            take,
            orderBy: [{ metricDate: "desc" }, { createdAt: "desc" }],
        }),
    ]);
    const sourceLineCounts = await Promise.all(items.map((metric) => getSourceLineCount(metric.branchId, metric.metricDate)));
    return {
        items: items.map((metric, index) => withSourceLineCount(toMetricResponse(metric), sourceLineCounts[index])),
        page,
        pageSize,
        total,
    };
}
async function getMetricById(id) {
    const metric = await prisma_1.prisma.branchMetric.findUnique({
        where: { id },
    });
    if (!metric) {
        return null;
    }
    const sourceLineCount = await getSourceLineCount(metric.branchId, metric.metricDate);
    return withSourceLineCount(toMetricResponse(metric), sourceLineCount);
}
async function getMetricByBranchDate(branchId, date) {
    const metric = await prisma_1.prisma.branchMetric.findUnique({
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
async function deleteMetric(id) {
    const metric = await prisma_1.prisma.branchMetric.findUnique({
        where: { id },
        select: {
            branchId: true,
            metricDate: true,
        },
    });
    if (!metric) {
        return false;
    }
    await (0, documents_service_1.deleteDocumentsWhere)({ metricId: id });
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.agentLineMetric.deleteMany({
            where: {
                metricDate: metric.metricDate,
                agentLine: {
                    branchId: metric.branchId,
                },
            },
        }),
        prisma_1.prisma.branchMetric.delete({ where: { id } }),
    ]);
    return true;
}
