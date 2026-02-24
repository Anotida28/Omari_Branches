"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentServiceError = void 0;
exports.createDocument = createDocument;
exports.listDocumentsForExpense = listDocumentsForExpense;
exports.listDocumentsForPayment = listDocumentsForPayment;
exports.listDocumentsForMetric = listDocumentsForMetric;
exports.deleteDocument = deleteDocument;
exports.getDocumentFileInfo = getDocumentFileInfo;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../db/prisma");
class DocumentServiceError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "DocumentServiceError";
    }
}
exports.DocumentServiceError = DocumentServiceError;
function formatDateTime(date) {
    return date.toISOString();
}
function toDocumentResponse(document) {
    return {
        id: document.id.toString(),
        docType: document.docType,
        fileName: document.fileName,
        mimeType: document.mimeType,
        sizeBytes: document.fileSize === null || document.fileSize === undefined
            ? null
            : document.fileSize.toString(),
        storageKey: document.filePath,
        expenseId: document.expenseId ? document.expenseId.toString() : null,
        paymentId: document.paymentId ? document.paymentId.toString() : null,
        metricId: document.metricId ? document.metricId.toString() : null,
        uploadedBy: document.uploadedBy,
        uploadedAt: formatDateTime(document.uploadedAt),
    };
}
function mapForeignKeyError(error) {
    if (error instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
            throw new DocumentServiceError("Related record not found", 404);
        }
    }
    throw error;
}
async function removeManagedLocalFile(storageKey) {
    const normalizedStorageKey = storageKey.trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!normalizedStorageKey.startsWith("uploads/")) {
        return;
    }
    const uploadsRoot = path_1.default.resolve(process.cwd(), "uploads");
    const absolutePath = path_1.default.resolve(process.cwd(), normalizedStorageKey);
    if (!absolutePath.startsWith(uploadsRoot)) {
        return;
    }
    try {
        await promises_1.default.unlink(absolutePath);
    }
    catch (error) {
        const code = error.code;
        if (code !== "ENOENT") {
            console.warn(`[Documents] Failed to remove local file: ${absolutePath}`);
        }
    }
}
async function createDocument(input) {
    const relationCount = [input.expenseId, input.paymentId, input.metricId].filter((value) => value !== undefined).length;
    if (relationCount !== 1) {
        throw new DocumentServiceError("Provide exactly one of expenseId, paymentId, or metricId", 400);
    }
    const data = {
        docType: input.docType ?? client_1.DocumentType.OTHER,
        fileName: input.fileName,
        filePath: input.storageKey,
        mimeType: input.mimeType,
        fileSize: input.sizeBytes,
        uploadedBy: input.uploadedBy,
        expense: input.expenseId ? { connect: { id: input.expenseId } } : undefined,
        payment: input.paymentId ? { connect: { id: input.paymentId } } : undefined,
        metric: input.metricId ? { connect: { id: input.metricId } } : undefined,
    };
    try {
        const document = await prisma_1.prisma.document.create({ data });
        return toDocumentResponse(document);
    }
    catch (error) {
        mapForeignKeyError(error);
    }
}
async function listDocumentsForExpense(expenseId) {
    const expense = await prisma_1.prisma.expense.findUnique({
        where: { id: expenseId },
        select: { id: true },
    });
    if (!expense) {
        return null;
    }
    const documents = await prisma_1.prisma.document.findMany({
        where: { expenseId },
        orderBy: { uploadedAt: "desc" },
    });
    return documents.map(toDocumentResponse);
}
async function listDocumentsForPayment(paymentId) {
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { id: paymentId },
        select: { id: true },
    });
    if (!payment) {
        return null;
    }
    const documents = await prisma_1.prisma.document.findMany({
        where: { paymentId },
        orderBy: { uploadedAt: "desc" },
    });
    return documents.map(toDocumentResponse);
}
async function listDocumentsForMetric(metricId) {
    const metric = await prisma_1.prisma.branchMetric.findUnique({
        where: { id: metricId },
        select: { id: true },
    });
    if (!metric) {
        return null;
    }
    const documents = await prisma_1.prisma.document.findMany({
        where: { metricId },
        orderBy: { uploadedAt: "desc" },
    });
    return documents.map(toDocumentResponse);
}
async function deleteDocument(id) {
    try {
        const existing = await prisma_1.prisma.document.findUnique({
            where: { id },
            select: { id: true, filePath: true },
        });
        if (!existing) {
            return false;
        }
        await prisma_1.prisma.document.delete({ where: { id } });
        await removeManagedLocalFile(existing.filePath);
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
async function getDocumentFileInfo(id) {
    const document = await prisma_1.prisma.document.findUnique({
        where: { id },
        select: {
            fileName: true,
            mimeType: true,
            filePath: true,
        },
    });
    if (!document) {
        return null;
    }
    return {
        fileName: document.fileName,
        mimeType: document.mimeType,
        storageKey: document.filePath,
    };
}
