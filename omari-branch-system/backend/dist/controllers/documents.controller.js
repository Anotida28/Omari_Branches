"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDocumentHandler = createDocumentHandler;
exports.uploadDocumentHandler = uploadDocumentHandler;
exports.listExpenseDocumentsHandler = listExpenseDocumentsHandler;
exports.listPaymentDocumentsHandler = listPaymentDocumentsHandler;
exports.listMetricDocumentsHandler = listMetricDocumentsHandler;
exports.deleteDocumentHandler = deleteDocumentHandler;
exports.openDocumentHandler = openDocumentHandler;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
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
const uploadDocumentSchema = zod_1.z
    .object({
    uploadedBy: zod_1.z.string().optional(),
    docType: zod_1.z.nativeEnum(client_1.DocumentType).optional(),
    expenseId: relationIdSchema.optional(),
    paymentId: relationIdSchema.optional(),
    metricId: relationIdSchema.optional(),
})
    .strict()
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
function toStorageKey(filePath, fileName) {
    const relativePath = path_1.default.relative(process.cwd(), filePath).replace(/\\/g, "/");
    if (relativePath && !relativePath.startsWith("../")) {
        return relativePath;
    }
    return `uploads/documents/${fileName}`;
}
async function cleanupUploadedFile(filePath) {
    if (!filePath) {
        return;
    }
    try {
        await promises_1.default.unlink(filePath);
    }
    catch (error) {
        const code = error.code;
        if (code !== "ENOENT") {
            console.warn(`[Documents] Failed to cleanup uploaded file: ${filePath}`);
        }
    }
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
async function uploadDocumentHandler(req, res, next) {
    if (!req.file) {
        res.status(400).json({ error: "Validation error", details: "file is required" });
        return;
    }
    const parsedBody = uploadDocumentSchema.safeParse(req.body);
    if (!parsedBody.success) {
        await cleanupUploadedFile(req.file.path);
        res.status(400).json({
            error: "Validation error",
            details: parsedBody.error.flatten(),
        });
        return;
    }
    try {
        const document = await (0, documents_service_1.createDocument)({
            fileName: req.file.originalname || req.file.filename,
            mimeType: req.file.mimetype || "application/octet-stream",
            sizeBytes: BigInt(req.file.size),
            storageKey: toStorageKey(req.file.path, req.file.filename),
            uploadedBy: parsedBody.data.uploadedBy?.trim() || undefined,
            docType: parsedBody.data.docType,
            expenseId: parsedBody.data.expenseId,
            paymentId: parsedBody.data.paymentId,
            metricId: parsedBody.data.metricId,
        });
        res.status(201).json({ data: document });
    }
    catch (error) {
        await cleanupUploadedFile(req.file.path);
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
async function openDocumentHandler(req, res, next) {
    const parsedId = idParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
        res.status(400).json({ error: "Invalid document id" });
        return;
    }
    try {
        const document = await (0, documents_service_1.getDocumentFileInfo)(parsedId.data);
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        if (/^https?:\/\//i.test(document.storageKey)) {
            res.redirect(document.storageKey);
            return;
        }
        const normalizedStorageKey = document.storageKey
            .trim()
            .replace(/\\/g, "/")
            .replace(/^\/+/, "");
        if (!normalizedStorageKey.startsWith("uploads/")) {
            res.status(404).json({ error: "Document file is not available" });
            return;
        }
        const uploadsRoot = path_1.default.resolve(process.cwd(), "uploads");
        const absolutePath = path_1.default.resolve(process.cwd(), normalizedStorageKey);
        if (!absolutePath.startsWith(uploadsRoot)) {
            res.status(400).json({ error: "Invalid document path" });
            return;
        }
        try {
            await promises_1.default.access(absolutePath);
        }
        catch {
            res.status(404).json({ error: "Document file was not found on disk" });
            return;
        }
        if (document.mimeType) {
            res.type(document.mimeType);
        }
        res.sendFile(absolutePath);
    }
    catch (error) {
        if (handleServiceError(res, error)) {
            return;
        }
        next(error);
    }
}
