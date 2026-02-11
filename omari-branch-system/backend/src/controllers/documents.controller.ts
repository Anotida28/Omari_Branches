import type { NextFunction, Request, Response } from "express";
import { DocumentType } from "@prisma/client";
import { z } from "zod";

import {
  DocumentServiceError,
  createDocument,
  deleteDocument,
  listDocumentsForExpense,
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
    storageKey: z.string().min(1),
    url: z.string().optional(),
    uploadedBy: z.string().optional(),
    docType: z.nativeEnum(DocumentType).optional(),
    expenseId: relationIdSchema.optional(),
    paymentId: relationIdSchema.optional(),
  })
  .strict()
  .refine(
    (data) =>
      (data.expenseId && !data.paymentId) ||
      (!data.expenseId && data.paymentId),
    {
      message: "Provide exactly one of expenseId or paymentId",
    },
  );

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof DocumentServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
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
    const document = await createDocument(parsedBody.data);
    res.status(201).json({ data: document });
  } catch (error) {
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
