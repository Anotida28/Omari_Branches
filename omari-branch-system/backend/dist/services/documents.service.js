"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentServiceError = void 0;
exports.createDocument = createDocument;
exports.listDocumentsForExpense = listDocumentsForExpense;
exports.listDocumentsForPayment = listDocumentsForPayment;
exports.listDocumentsForMetric = listDocumentsForMetric;
exports.deleteDocument = deleteDocument;
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
        await prisma_1.prisma.document.delete({ where: { id } });
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
