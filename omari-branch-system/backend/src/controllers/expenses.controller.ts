import type { NextFunction, Request, Response } from "express";
import { ExpenseStatus, ExpenseType } from "@prisma/client";
import { z } from "zod";

import {
  ExpenseServiceError,
  createExpense,
  deleteExpense,
  getExpenseById,
  listExpenses,
  updateExpense,
} from "../services/expenses.service";

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

const branchIdSchema = z.preprocess(
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

const periodSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/)
  .refine((value) => {
    const month = Number(value.slice(5, 7));
    return month >= 1 && month <= 12;
  }, "Invalid period");

const currencySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.string().min(3).max(3),
);

const createExpenseSchema = z
  .object({
    branchId: branchIdSchema,
    expenseType: z.nativeEnum(ExpenseType),
    period: periodSchema,
    dueDate: dateSchema,
    amount: z.number().min(0),
    currency: currencySchema.optional(),
    vendor: z.string().optional(),
    notes: z.string().optional(),
    createdBy: z.string().optional(),
  })
  .strict();

const updateExpenseSchema = z
  .object({
    expenseType: z.nativeEnum(ExpenseType).optional(),
    period: periodSchema.optional(),
    dueDate: dateSchema.optional(),
    amount: z.number().min(0).optional(),
    currency: currencySchema.optional(),
    vendor: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

const listQuerySchema = z.object({
  branchId: branchIdSchema.optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  period: periodSchema.optional(),
  dueFrom: dateSchema.optional(),
  dueTo: dateSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

function normalizeQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof ExpenseServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export async function createExpenseHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedBody = createExpenseSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const expense = await createExpense(parsedBody.data);
    res.status(201).json({ data: expense });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function listExpensesHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    branchId: normalizeQueryValue(req.query.branchId),
    status: normalizeQueryValue(req.query.status),
    expenseType: normalizeQueryValue(req.query.expenseType),
    period: normalizeQueryValue(req.query.period),
    dueFrom: normalizeQueryValue(req.query.dueFrom),
    dueTo: normalizeQueryValue(req.query.dueTo),
    page: normalizeQueryValue(req.query.page),
    pageSize: normalizeQueryValue(req.query.pageSize),
  };

  const parsedQuery = listQuerySchema.safeParse(queryInput);
  if (!parsedQuery.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedQuery.error.flatten(),
    });
    return;
  }

  if (
    parsedQuery.data.dueFrom &&
    parsedQuery.data.dueTo &&
    parsedQuery.data.dueFrom > parsedQuery.data.dueTo
  ) {
    res.status(400).json({
      error: "dueFrom must be less than or equal to dueTo",
    });
    return;
  }

  try {
    const result = await listExpenses(parsedQuery.data);
    res.json(result);
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function getExpenseByIdHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const expense = await getExpenseById(parsedId.data);
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.json({ data: expense });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function updateExpenseHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsedBody = updateExpenseSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const expense = await updateExpense(parsedId.data, parsedBody.data);
    if (!expense) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }
    res.json({ data: expense });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function deleteExpenseHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const deleted = await deleteExpense(parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: "Expense not found" });
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
