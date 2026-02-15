"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocumentHandler = createDocumentHandler;
exports.listExpenseDocumentsHandler = listExpenseDocumentsHandler;
exports.listPaymentDocumentsHandler = listPaymentDocumentsHandler;
exports.listMetricDocumentsHandler = listMetricDocumentsHandler;
exports.deleteDocumentHandler = deleteDocumentHandler;
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const documents_service_1 = require("../services/documents.service");
const idParamSchema = zod_1.z
    .string()
    .regex(/^\d+$/)
    .transform((value) => BigInt(value));
const relationIdSchema = zod_1.z.preprocess((value) => {
    if (typeof value === "string") {
        return value.trim();
    }
    return value;
}, zod_1.z
    .union([zod_1.z.string().regex(/^\d+$/), zod_1.z.number().int().nonnegative()])
    .transform((value) => BigInt(value)));
const sizeSchema = zod_1.z.preprocess((value) => {
    if (typeof value === "string") {
        return value.trim();
    }
    return value;
}, zod_1.z
    .union([zod_1.z.string().regex(/^\d+$/), zod_1.z.number().int().nonnegative()])
    .transform((value) => BigInt(value)));
const createDocumentSchema = zod_1.z
    .object({
    fileName: zod_1.z.string().min(1),
    mimeType: zod_1.z.string().min(1),
    sizeBytes: sizeSchema,
    storageKey: zod_1.z.string().min(1).optional(),
    url: zod_1.z.string().min(1).optional(),
    uploadedBy: zod_1.z.string().optional(),
    docType: zod_1.z.nativeEnum(client_1.DocumentType).optional(),
    expenseId: relationIdSchema.optional(),
    paymentId: relationIdSchema.optional(),
    metricId: relationIdSchema.optional(),
})
    .strict()
    .refine((data) => Boolean(data.storageKey || data.url), {
    message: "Provide storageKey or url",
})
    .refine((data) => [data.expenseId, data.paymentId, data.metricId].filter((value) => value !== undefined).length === 1, {
    message: "Provide exactly one of expenseId, paymentId, or metricId",
});
function handleServiceError(res, error) {
    if (error instanceof documents_service_1.DocumentServiceError) {
        res.status(error.status).json({ error: error.message });
        return true;
    }
    return false;
}
async function createDocumentHandler(req, res, next) {
    const parsedBody = createDocumentSchema.safeParse(req.body);
    if (!parsedBody.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const { url, ...baseInput } = parsedBody.data;
        const storageKey = baseInput.storageKey ?? url;
        if (!storageKey) {
            res.status(400).json({
                error: "Validation error",
                details: { formErrors: ["Provide storageKey or url"], fieldErrors: {} },
            });
            return;
        }
        const document = await (0, documents_service_1.createDocument)({
            ...baseInput,
            storageKey,
        });
        res.status(201).json({ data: document });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function listExpenseDocumentsHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid expense id" });
        return;
    }
    try {
        const documents = await (0, documents_service_1.listDocumentsForExpense)(parsedId.data);
        if (!documents) {
            res.status(404).json({ error: "Expense not found" });
            return;
        }
        res.json({ items: documents });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function listPaymentDocumentsHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid payment id" });
        return;
    }
    try {
        const documents = await (0, documents_service_1.listDocumentsForPayment)(parsedId.data);
        if (!documents) {
            res.status(404).json({ error: "Payment not found" });
            return;
        }
        res.json({ items: documents });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function listMetricDocumentsHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid metric id" });
        return;
    }
    try {
        const documents = await (0, documents_service_1.listDocumentsForMetric)(parsedId.data);
        if (!documents) {
            res.status(404).json({ error: "Metric not found" });
            return;
        }
        res.json({ items: documents });
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
async function deleteDocumentHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid document id" });
        return;
    }
    try {
        const deleted = await (0, documents_service_1.deleteDocument)(parsedId.data);
        if (!deleted) {
            res.status(404).json({ error: "Document not found" });
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
