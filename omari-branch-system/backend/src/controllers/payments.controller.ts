import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  PaymentServiceError,
  createPayment,
  deletePayment,
  listPaymentsForExpense,
} from "../services/payments.service";

function normalizeDateInput(value: string): Date | null {
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

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

const idParamSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => BigInt(value));

const dateSchema = z.string().transform((value, ctx) => {
  const parsed = normalizeDateInput(value);
  if (!parsed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid date",
    });
    return z.NEVER;
  }
  return parsed;
});

const currencySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.string().min(3).max(3),
);

const createPaymentSchema = z
  .object({
    paidDate: dateSchema,
    amountPaid: z.number().gt(0),
    currency: currencySchema.optional(),
    reference: z.string().optional(),
    notes: z.string().optional(),
    createdBy: z.string().optional(),
  })
  .strict();

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof PaymentServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export async function createPaymentHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
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
    const result = await createPayment(parsedId.data, parsedBody.data);
    res.status(201).json({ data: result.payment, expense: result.expense });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function listPaymentsForExpenseHandler(
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
    const payments = await listPaymentsForExpense(parsedId.data);
    if (!payments) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.json({ items: payments });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function deletePaymentHandler(
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
    const deleted = await deletePayment(parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: "Payment not found" });
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
