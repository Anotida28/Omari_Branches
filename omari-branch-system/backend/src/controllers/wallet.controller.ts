import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  WalletServiceError,
  getWalletOverview,
} from "../services/wallet.service";
import { runWalletCustomerActivitySyncJobWithLock } from "../jobs/wallet-customer-activity-sync.job";

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

function normalizeQueryValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
}

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

const overviewQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    asOfDate: dateSchema.optional(),
    compare: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value !== "false"),
  })
  .strict();

function handleServiceError(res: Response, error: unknown): boolean {
  if (error instanceof WalletServiceError) {
    res.status(error.status).json({ error: error.message });
    return true;
  }

  return false;
}

export async function getWalletOverviewHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    asOfDate: normalizeQueryValue(req.query.asOfDate),
    compare: normalizeQueryValue(req.query.compare),
  };

  const parsedQuery = overviewQuerySchema.safeParse(queryInput);
  if (!parsedQuery.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedQuery.error.flatten(),
    });
    return;
  }

  if (parsedQuery.data.dateFrom > parsedQuery.data.dateTo) {
    res.status(400).json({
      error: "dateFrom must be less than or equal to dateTo",
    });
    return;
  }

  try {
    const data = await getWalletOverview({
      dateFrom: parsedQuery.data.dateFrom,
      dateTo: parsedQuery.data.dateTo,
      asOfDate: parsedQuery.data.asOfDate ?? new Date(),
      compare: parsedQuery.data.compare ?? true,
    });

    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function syncWalletCustomerActivityHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { executed, result, error } =
      await runWalletCustomerActivitySyncJobWithLock();

    if (!executed) {
      res.status(409).json({
        error: "Wallet customer activity sync is already running on another instance",
      });
      return;
    }

    if (error) {
      throw error;
    }

    res.json({
      message: "Wallet customer activity snapshot sync completed",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
