"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExpenseHandler = createExpenseHandler;
exports.listExpensesHandler = listExpensesHandler;
exports.getExpenseByIdHandler = getExpenseByIdHandler;
exports.updateExpenseHandler = updateExpenseHandler;
exports.deleteExpenseHandler = deleteExpenseHandler;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const expenses_service_1 = require("../services/expenses.service");
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
const periodSchema = zod_1.z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .refine((value) => {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
}, "Invalid period");
const currencySchema = zod_1.z.preprocess((value) => (typeof value === "string" ? value.trim().toUpperCase() : value), zod_1.z.string().min(3).max(3));
const createExpenseSchema = zod_1.z
    .object({
    branchId: branchIdSchema,
    expenseType: zod_1.z.nativeEnum(client_1.ExpenseType),
    period: periodSchema,
    dueDate: dateSchema,
    amount: zod_1.z.number().min(0),
    currency: currencySchema.optional(),
    vendor: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    createdBy: zod_1.z.string().optional(),
})
    .strict();
const updateExpenseSchema = zod_1.z
    .object({
    expenseType: zod_1.z.nativeEnum(client_1.ExpenseType).optional(),
    period: periodSchema.optional(),
    dueDate: dateSchema.optional(),
    amount: zod_1.z.number().min(0).optional(),
    currency: currencySchema.optional(),
    vendor: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
})
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
});
const listQuerySchema = zod_1.z.object({
    branchId: branchIdSchema.optional(),
    status: zod_1.z.nativeEnum(client_1.ExpenseStatus).optional(),
    expenseType: zod_1.z.nativeEnum(client_1.ExpenseType).optional(),
    period: periodSchema.optional(),
    dueFrom: dateSchema.optional(),
    dueTo: dateSchema.optional(),
    page: zod_1.z.coerce.number().int().min(1).optional(),
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).optional(),
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
    if (error instanceof expenses_service_1.ExpenseServiceError) {
        res.status(error.status).json({ error: error.message });
        return true;
    }
    return false;
}
async function createExpenseHandler(req, res, next) {
    const parsedBody = createExpenseSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const expense = await (0, expenses_service_1.createExpense)(parsedBody.data);
        res.status(201).json({ data: expense });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function listExpensesHandler(req, res, next) {
    const queryInput = {
        branchId: normalizeQueryValue(req.query.branchId),
        status: normalizeQueryValue(req.query.status),
        expenseType: normalizeQueryValue(req.query.expenseType),
        period: normalizeQueryValue(req.query.period),
        dueFrom: normalizeQueryValue(req.query.dueFrom),
        dueTo: normalizeQueryValue(req.query.dueTo),
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
    if (parsedQuery.data.dueFrom &&
        parsedQuery.data.dueTo &&
        parsedQuery.data.dueFrom > parsedQuery.data.dueTo) {
        res.status(400).json({
            error: "dueFrom must be less than or equal to dueTo",
        });
        return;
    }
    try {
        const result = await (0, expenses_service_1.listExpenses)(parsedQuery.data);
        res.json(result);
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function getExpenseByIdHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    try {
        const expense = await (0, expenses_service_1.getExpenseById)(parsedId.data);
        if (!expense) {
            res.status(404).json({ error: "Expense not found" });
            return;
        }
        res.json({ data: expense });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function updateExpenseHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    const parsedBody = updateExpenseSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const expense = await (0, expenses_service_1.updateExpense)(parsedId.data, parsedBody.data);
        if (!expense) {
            res.status(404).json({ error: "Expense not found" });
            return;
        }
        res.json({ data: expense });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function deleteExpenseHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid id" });
        return;
    }
    try {
        const deleted = await (0, expenses_service_1.deleteExpense)(parsedId.data);
        if (!deleted) {
            res.status(404).json({ error: "Expense not found" });
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
