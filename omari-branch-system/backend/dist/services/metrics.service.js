"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricServiceError = void 0;
exports.upsertMetric = upsertMetric;
exports.listMetrics = listMetrics;
exports.getMetricById = getMetricById;
exports.getMetricByBranchDate = getMetricByBranchDate;
exports.deleteMetric = deleteMetric;
const client_1 = require("@prisma/client");
const prisma_1 = require("../db/prisma");
const pagination_1 = require("../utils/pagination");
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
        createdAt: metric.createdAt,
        updatedAt: metric.updatedAt,
    };
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
    const updateData = {
        cashBalance: input.cashBalance,
        eFloatBalance: input.eFloatBalance,
        cashInVault: input.cashInVault,
        cashInVolume: input.cashInVolume,
        cashInValue: input.cashInValue,
        cashOutVolume: input.cashOutVolume,
        cashOutValue: input.cashOutValue,
    };
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
    };
    try {
        const metric = await prisma_1.prisma.branchMetric.upsert({
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
    return {
        items: items.map(toMetricResponse),
        page,
        pageSize,
        total,
    };
}
async function getMetricById(id) {
    const metric = await prisma_1.prisma.branchMetric.findUnique({
        where: { id },
    });
    return metric ? toMetricResponse(metric) : null;
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
    return metric ? toMetricResponse(metric) : null;
}
async function deleteMetric(id) {
    try {
        await prisma_1.prisma.branchMetric.delete({ where: { id } });
        return true;
    }
    catch (error) {
        if (error instanceof client_1.Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025") {
            return false;
        }
        throw error;
    }
}
