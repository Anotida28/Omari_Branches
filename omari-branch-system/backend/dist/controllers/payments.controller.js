"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPaymentHandler = createPaymentHandler;
exports.listPaymentsForExpenseHandler = listPaymentsForExpenseHandler;
exports.deletePaymentHandler = deletePaymentHandler;
const zod_1 = require("zod");
const payments_service_1 = require("../services/payments.service");
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
const currencySchema = zod_1.z.preprocess((value) => (typeof value === "string" ? value.trim().toUpperCase() : value), zod_1.z.string().min(3).max(3));
const createPaymentSchema = zod_1.z
    .object({
    paidDate: dateSchema,
    amountPaid: zod_1.z.number().gt(0),
    currency: currencySchema.optional(),
    reference: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    createdBy: zod_1.z.string().optional(),
})
    .strict();
function handleServiceError(res, error) {
    if (error instanceof payments_service_1.PaymentServiceError) {
        res.status(error.status).json({ error: error.message });
        return true;
    }
    return false;
}
async function createPaymentHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid expense id" });
        return;
    }
    const parsedBody = createPaymentSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const result = await (0, payments_service_1.createPayment)(parsedId.data, parsedBody.data);
        res.status(201).json({ data: result.payment, expense: result.expense });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function listPaymentsForExpenseHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid expense id" });
        return;
    }
    try {
        const payments = await (0, payments_service_1.listPaymentsForExpense)(parsedId.data);
        if (!payments) {
            res.status(404).json({ error: "Expense not found" });
            return;
        }
        res.json({ items: payments });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function deletePaymentHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid payment id" });
        return;
    }
    try {
        const deleted = await (0, payments_service_1.deletePayment)(parsedId.data);
        if (!deleted) {
            res.status(404).json({ error: "Payment not found" });
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
