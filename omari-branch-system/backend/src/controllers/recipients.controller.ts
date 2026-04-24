import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  RecipientServiceError,
  createRecipient,
  deleteRecipient,
  getRecipientById,
  listRecipients,
  updateRecipient,
} from "../services/recipients.service";

const recipientIdSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => BigInt(value));

const emailSchema = z.string().email("Invalid email format").min(1);

const createRecipientSchema = z
  .object({
    email: emailSchema,
    name: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

const updateRecipientSchema = z
  .object({
    email: emailSchema.optional(),
    name: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof RecipientServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

/**
 * GET /api/recipients
 */
export async function listRecipientsHandler(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const recipients = await listRecipients();
    res.json({ items: recipients });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

/**
 * POST /api/recipients
 */
export async function createRecipientHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsedBody = createRecipientSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const recipient = await createRecipient(parsedBody.data);
    res.status(201).json({ data: recipient });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

/**
 * GET /api/recipients/:recipientId
 */
export async function getRecipientHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsedId = recipientIdSchema.safeParse(req.params.recipientId);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid recipient ID" });
    return;
  }

  try {
    const recipient = await getRecipientById(parsedId.data);

    if (!recipient) {
      res.status(404).json({ error: "Recipient not found" });
      return;
    }

    res.json({ data: recipient });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

/**
 * PATCH /api/recipients/:recipientId
 */
export async function updateRecipientHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsedId = recipientIdSchema.safeParse(req.params.recipientId);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid recipient ID" });
    return;
  }

  const parsedBody = updateRecipientSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const recipient = await updateRecipient(parsedId.data, parsedBody.data);

    if (!recipient) {
      res.status(404).json({ error: "Recipient not found" });
      return;
    }

    res.json({ data: recipient });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

/**
 * DELETE /api/recipients/:recipientId
 */
export async function deleteRecipientHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const parsedId = recipientIdSchema.safeParse(req.params.recipientId);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid recipient ID" });
    return;
  }

  try {
    const deleted = await deleteRecipient(parsedId.data);

    if (!deleted) {
      res.status(404).json({ error: "Recipient not found" });
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
