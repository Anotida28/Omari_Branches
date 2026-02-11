import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  MetricServiceError,
  deleteMetric,
  getMetricByBranchDate,
  getMetricById,
  listMetrics,
  upsertMetric,
} from "../services/metrics.service";

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

const upsertMetricSchema = z
  .object({
    branchId: branchIdSchema,
    date: dateSchema,
    cashBalance: z.number().min(0),
    cashInVolume: z.number().int().min(0),
    cashInValue: z.number().min(0),
    cashOutVolume: z.number().int().min(0),
    cashOutValue: z.number().min(0),
  })
  .strict();

const listQuerySchema = z.object({
  branchId: branchIdSchema.optional(),
  dateFrom: dateSchema.optional(),
  dateTo: dateSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

const byBranchDateQuerySchema = z.object({
  branchId: branchIdSchema,
  date: dateSchema,
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
  if (error instanceof MetricServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }
  return false;
}

export async function upsertMetricHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedBody = upsertMetricSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    const metric = await upsertMetric(parsedBody.data);
    res.json({ data: metric });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function listMetricsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    branchId: normalizeQueryValue(req.query.branchId),
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
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
    parsedQuery.data.dateFrom &&
    parsedQuery.data.dateTo &&
    parsedQuery.data.dateFrom > parsedQuery.data.dateTo
  ) {
    res.status(400).json({
      error: "dateFrom must be less than or equal to dateTo",
    });
    return;
  }

  try {
    const result = await listMetrics(parsedQuery.data);
    res.json(result);
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function getMetricByIdHandler(
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
    const metric = await getMetricById(parsedId.data);
    if (!metric) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }
    res.json({ data: metric });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function getMetricByBranchDateHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    branchId: normalizeQueryValue(req.query.branchId),
    date: normalizeQueryValue(req.query.date),
  };

  const parsedQuery = byBranchDateQuerySchema.safeParse(queryInput);
  if (!parsedQuery.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedQuery.error.flatten(),
    });
    return;
  }

  try {
    const metric = await getMetricByBranchDate(
      parsedQuery.data.branchId,
      parsedQuery.data.date,
    );
    if (!metric) {
      res.status(404).json({ error: "Metric not found" });
      return;
    }
    res.json({ data: metric });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }
    next(error);
  }
}

export async function deleteMetricHandler(
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
    const deleted = await deleteMetric(parsedId.data);
    if (!deleted) {
      res.status(404).json({ error: "Metric not found" });
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
