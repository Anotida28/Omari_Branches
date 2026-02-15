"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertMetricHandler = upsertMetricHandler;
exports.listMetricsHandler = listMetricsHandler;
exports.getMetricByIdHandler = getMetricByIdHandler;
exports.getMetricByBranchDateHandler = getMetricByBranchDateHandler;
exports.deleteMetricHandler = deleteMetricHandler;
const zod_1 = require("zod");
const metrics_service_1 = require("../services/metrics.service");
function normalizeDateInput(value) {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    const dateMatch = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(trimmed);
    if (dateMatch) {
        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        const day = Number(dateMatch[3]);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day) {
            return null;
        }
        return date;
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}
const branchIdSchema = zod_1.z.preprocess((value) => {
    if (typeof value === "string") {
        return value.trim();
    }
    return value;
}, zod_1.z
    .union([zod_1.z.string().regex(/^\d+$/), zod_1.z.number().int().nonnegative()])
    .transform((value) => BigInt(value)));
const idParamSchema = zod_1.z
    .string()
    .regex(/^\d+$/)
    .transform((value) => BigInt(value));
const dateSchema = zod_1.z.string().transform((value, ctx) => {
    const parsed = normalizeDateInput(value);
    if (!parsed) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: "Invalid date",
        });
        return zod_1.z.NEVER;
    }
    return parsed;
});
const upsertMetricSchema = zod_1.z
    .object({
    branchId: branchIdSchema,
    date: dateSchema,
    cashBalance: zod_1.z.number().min(0),
    cashInVolume: zod_1.z.number().int().min(0),
    cashInValue: zod_1.z.number().min(0),
    cashOutVolume: zod_1.z.number().int().min(0),
    cashOutValue: zod_1.z.number().min(0),
})
    .strict();
const listQuerySchema = zod_1.z.object({
    branchId: branchIdSchema.optional(),
    dateFrom: dateSchema.optional(),
    dateTo: dateSchema.optional(),
    page: zod_1.z.coerce.number().int().min(1).optional(),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
});
const byBranchDateQuerySchema = zod_1.z.object({
    branchId: branchIdSchema,
    date: dateSchema,
});
function normalizeQueryValue(value) {
    if (typeof value === "string") {
        return value;
    }
    if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
    }
    return undefined;
}
function handleServiceError(res, error) {
    if (error instanceof metrics_service_1.MetricServiceError) {
        res.status(error.status).json({ error: error.message });
        return true;
    }
    return false;
}
async function upsertMetricHandler(req, res, next) {
    const parsedBody = upsertMetricSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const metric = await (0, metrics_service_1.upsertMetric)(parsedBody.data);
        res.json({ data: metric });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function listMetricsHandler(req, res, next) {
    const queryInput = {
        branchId: normalizeQueryValue(req.query.branchId),
        dateFrom: normalizeQueryValue(req.query.dateFrom),
        dateTo: normalizeQueryValue(req.query.dateTo),
        page: normalizeQueryValue(req.query.page),
        pageSize: normalizeQueryValue(req.query.pageSize),
    };
    const parsedQuery = listQuerySchema.safeParse(queryInput);
    if (!parsedQuery.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedQuery.error.flatten(),
        });
        return;
    }
    if (parsedQuery.data.dateFrom &&
        parsedQuery.data.dateTo &&
        parsedQuery.data.dateFrom > parsedQuery.data.dateTo) {
        res.status(400).json({
            error: "dateFrom must be less than or equal to dateTo",
        });
        return;
    }
    try {
        const result = await (0, metrics_service_1.listMetrics)(parsedQuery.data);
        res.json(result);
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function getMetricByIdHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    try {
        const metric = await (0, metrics_service_1.getMetricById)(parsedId.data);
        if (!metric) {
            res.status(404).json({ error: "Metric not found" });
            return;
        }
        res.json({ data: metric });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function getMetricByBranchDateHandler(req, res, next) {
    const queryInput = {
        branchId: normalizeQueryValue(req.query.branchId),
        date: normalizeQueryValue(req.query.date),
    };
    const parsedQuery = byBranchDateQuerySchema.safeParse(queryInput);
    if (!parsedQuery.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedQuery.error.flatten(),
        });
        return;
    }
    try {
        const metric = await (0, metrics_service_1.getMetricByBranchDate)(parsedQuery.data.branchId, parsedQuery.data.date);
        if (!metric) {
            res.status(404).json({ error: "Metric not found" });
            return;
        }
        res.json({ data: metric });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function deleteMetricHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    try {
        const deleted = await (0, metrics_service_1.deleteMetric)(parsedId.data);
        if (!deleted) {
            res.status(404).json({ error: "Metric not found" });
            return;
        }
        res.status(204).send();
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
