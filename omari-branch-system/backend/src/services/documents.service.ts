import fs from "fs/promises";
import path from "path";

import { DocumentType, Prisma, type Document } from "@prisma/client";

import { prisma } from "../db/prisma";

export class DocumentServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "DocumentServiceError";
  }
}

export type DocumentCreateInput = {
  fileName: string;
  mimeType: string;
  sizeBytes: bigint;
  storageKey: string;
  uploadedBy?: string;
  expenseId?: bigint;
  paymentId?: bigint;
  metricId?: bigint;
  docType?: DocumentType;
};

export type DocumentResponse = {
  id: string;
  docType: DocumentType;
  fileName: string;
  mimeType: string | null;
  sizeBytes: string | null;
  storageKey: string;
  expenseId: string | null;
  paymentId: string | null;
  metricId: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
};

export type DocumentFileInfo = {
  fileName: string;
  mimeType: string | null;
  storageKey: string;
};

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function toDocumentResponse(document: Document): DocumentResponse {
  return {
    id: document.id.toString(),
    docType: document.docType,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes:
      document.fileSize === null || document.fileSize === undefined
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

function mapForeignKeyError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      throw new DocumentServiceError("Related record not found", 404);
    }
  }
  throw error;
}

async function removeManagedLocalFile(storageKey: string): Promise<void> {
  const normalizedStorageKey = storageKey.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalizedStorageKey.startsWith("uploads/")) {
    return;
  }

  const uploadsRoot = path.resolve(process.cwd(), "uploads");
  const absolutePath = path.resolve(process.cwd(), normalizedStorageKey);
  if (!absolutePath.startsWith(uploadsRoot)) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`[Documents] Failed to remove local file: ${absolutePath}`);
    }
  }
}

export async function createDocument(
  input: DocumentCreateInput,
): Promise<DocumentResponse> {
  const relationCount = [input.expenseId, input.paymentId, input.metricId].filter(
    (value) => value !== undefined,
  ).length;

  if (relationCount !== 1) {
    throw new DocumentServiceError(
      "Provide exactly one of expenseId, paymentId, or metricId",
      400,
    );
  }

  const data: Prisma.DocumentCreateInput = {
    docType: input.docType ?? DocumentType.OTHER,
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
    const document = await prisma.document.create({ data });
    return toDocumentResponse(document);
  } catch (error) {
    mapForeignKeyError(error);
  }
}

export async function listDocumentsForExpense(
  expenseId: bigint,
): Promise<DocumentResponse[] | null> {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { id: true },
  });

  if (!expense) {
    return null;
  }

  const documents = await prisma.document.findMany({
    where: { expenseId },
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map(toDocumentResponse);
}

export async function listDocumentsForPayment(
  paymentId: bigint,
): Promise<DocumentResponse[] | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true },
  });

  if (!payment) {
    return null;
  }

  const documents = await prisma.document.findMany({
    where: { paymentId },
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map(toDocumentResponse);
}

export async function listDocumentsForMetric(
  metricId: bigint,
): Promise<DocumentResponse[] | null> {
  const metric = await prisma.branchMetric.findUnique({
    where: { id: metricId },
    select: { id: true },
  });

  if (!metric) {
    return null;
  }

  const documents = await prisma.document.findMany({
    where: { metricId },
    orderBy: { uploadedAt: "desc" },
  });

  return documents.map(toDocumentResponse);
}

export async function deleteDocument(id: bigint): Promise<boolean> {
  try {
    const existing = await prisma.document.findUnique({
      where: { id },
      select: { id: true, filePath: true },
    });

    if (!existing) {
      return false;
    }

    await prisma.document.delete({ where: { id } });
    await removeManagedLocalFile(existing.filePath);
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

export async function getDocumentFileInfo(
  id: bigint,
): Promise<DocumentFileInfo | null> {
  const document = await prisma.document.findUnique({
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
