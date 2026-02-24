import fs from "fs/promises";
import path from "path";

import type { NextFunction, Request, Response } from "express";
import { DocumentType } from "@prisma/client";
import { z } from "zod";

import {
  DocumentServiceError,
  createDocument,
  getDocumentFileInfo,
  deleteDocument,
  listDocumentsForExpense,
  listDocumentsForMetric,
  listDocumentsForPayment,
} from "../services/documents.service";

const idParamSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => BigInt(value));

const relationIdSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  },
  z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((value) => BigInt(value)),
);

const sizeSchema = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  },
  z
    .union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((value) => BigInt(value)),
);

const createDocumentSchema = z
  .object({
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    sizeBytes: sizeSchema,
    storageKey: z.string().min(1).optional(),
    url: z.string().min(1).optional(),
    uploadedBy: z.string().optional(),
    docType: z.nativeEnum(DocumentType).optional(),
    expenseId: relationIdSchema.optional(),
    paymentId: relationIdSchema.optional(),
    metricId: relationIdSchema.optional(),
  })
  .strict()
  .refine((data) => Boolean(data.storageKey || data.url), {
    message: "Provide storageKey or url",
  })
  .refine(
    (data) =>
      [data.expenseId, data.paymentId, data.metricId].filter(
        (value) => value !== undefined,
      ).length === 1,
    {
      message: "Provide exactly one of expenseId, paymentId, or metricId",
    },
  );

const uploadDocumentSchema = z
  .object({
    uploadedBy: z.string().optional(),
    docType: z.nativeEnum(DocumentType).optional(),
    expenseId: relationIdSchema.optional(),
    paymentId: relationIdSchema.optional(),
    metricId: relationIdSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      [data.expenseId, data.paymentId, data.metricId].filter(
        (value) => value !== undefined,
      ).length === 1,
    {
      message: "Provide exactly one of expenseId, paymentId, or metricId",
    },
  );

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof DocumentServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

function toStorageKey(filePath: string, fileName: string): string {
  const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/");
  if (relativePath && !relativePath.startsWith("../")) {
    return relativePath;
  }

  return `uploads/documents/${fileName}`;
}

async function cleanupUploadedFile(filePath: string | undefined): Promise<void> {
  if (!filePath) {
    return;
  }

  try {
    await fs.unlink(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      console.warn(`[Documents] Failed to cleanup uploaded file: ${filePath}`);
    }
  }
}

export async function createDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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

    const document = await createDocument({
      ...baseInput,
      storageKey,
    });
    res.status(201).json({ data: document });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function uploadDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
    const document = await createDocument({
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
  } catch (error) {
    await cleanupUploadedFile(req.file.path);
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function listExpenseDocumentsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid expense id" });
    return;
  }

  try {
    const documents = await listDocumentsForExpense(parsedId.data);
    if (!documents) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.json({ items: documents });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function listPaymentDocumentsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid payment id" });
    return;
  }

  try {
    const documents = await listDocumentsForPayment(parsedId.data);
    if (!documents) {
      res.status(404).json({ error: "Payment not found" });
      return;
    }
    res.json({ items: documents });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function listMetricDocumentsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid metric id" });
    return;
  }

  try {
    const documents = await listDocumentsForMetric(parsedId.data);
    if (!documents) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }
    res.json({ items: documents });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function deleteDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  try {
    const deleted = await deleteDocument(parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function openDocumentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }

  try {
    const document = await getDocumentFileInfo(parsedId.data);
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

    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const absolutePath = path.resolve(process.cwd(), normalizedStorageKey);
    if (!absolutePath.startsWith(uploadsRoot)) {
      res.status(400).json({ error: "Invalid document path" });
      return;
    }

    try {
      await fs.access(absolutePath);
    } catch {
      res.status(404).json({ error: "Document file was not found on disk" });
      return;
    }

    if (document.mimeType) {
      res.type(document.mimeType);
    }
    res.sendFile(absolutePath);
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}
