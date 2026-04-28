import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  RecurringReminderServiceError,
  createRecurringReminder,
  deleteRecurringReminder,
  getRecurringReminderById,
  listRecurringReminders,
  updateRecurringReminder,
} from "../services/recurring-reminders.service";
import { ExpenseType } from "../shared/prisma-enums";

const idParamSchema = z.string().regex(/^\d+$/).transform((value) => BigInt(value));

const branchIdSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative()])
    .transform((value) => BigInt(value)),
);

const currencySchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
  z.string().min(3).max(3),
);

const createSchema = z.object({
  branchId: branchIdSchema,
  expenseType: z.nativeEnum(ExpenseType),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31),
  amount: z.coerce.number().min(0),
  currency: currencySchema.optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
  createdBy: z.string().optional(),
}).strict();

const updateSchema = z.object({
  branchId: branchIdSchema.optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: currencySchema.optional(),
  vendor: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
}).strict().refine((data) => Object.keys(data).length > 0, {
  message: "At least one field is required",
});

const listSchema = z.object({
  branchId: branchIdSchema.optional(),
  expenseType: z.nativeEnum(ExpenseType).optional(),
  isActive: z.preprocess((value) => {
    if (value === undefined || value === "") return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

function normalizeQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof RecurringReminderServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export async function createRecurringReminderHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }

  try {
    const reminder = await createRecurringReminder(parsed.data);
    res.status(201).json({ data: reminder });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
}

export async function listRecurringRemindersHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsed = listSchema.safeParse({
    branchId: normalizeQueryValue(req.query.branchId),
    expenseType: normalizeQueryValue(req.query.expenseType),
    isActive: normalizeQueryValue(req.query.isActive),
    page: normalizeQueryValue(req.query.page),
    pageSize: normalizeQueryValue(req.query.pageSize),
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }

  try {
    res.json(await listRecurringReminders(parsed.data));
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
}

export async function getRecurringReminderByIdHandler(
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
    const reminder = await getRecurringReminderById(parsedId.data);
    if (!reminder) {
      res.status(404).json({ error: "Recurring reminder not found" });
      return;
    }
    res.json({ data: reminder });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
}

export async function updateRecurringReminderHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedId = idParamSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
    return;
  }

  try {
    const reminder = await updateRecurringReminder(parsedId.data, parsed.data);
    if (!reminder) {
      res.status(404).json({ error: "Recurring reminder not found" });
      return;
    }
    res.json({ data: reminder });
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
}

export async function deleteRecurringReminderHandler(
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
    const deleted = await deleteRecurringReminder(parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: "Recurring reminder not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    if (handleServiceError(res, error)) return;
    next(error);
  }
}
