import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import {
  WalletServiceError,
  getWalletCustomer360Detail,
  getWalletCustomerActivityGrowth,
  getWalletInsightsAlerts,
  getWalletLiquidity,
  getWalletRetentionDormancy,
  getWalletOverview,
  getWalletRevenuePerformance,
  getWalletTransactionPerformance,
  listWalletCustomer360,
} from "../services/wallet.service";
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

const currencySchema = z.enum(["USD", "ZWL"]).optional().default("USD");

const overviewQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    asOfDate: dateSchema.optional(),
    compare: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value !== "false"),
    currency: currencySchema,
  })
  .strict();

const customerActivityQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    currency: currencySchema,
  })
  .strict();

const retentionQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    asOfDate: dateSchema.optional(),
    currency: currencySchema,
  })
  .strict();

const transactionPerformanceQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    currency: currencySchema,
    useCase: z.string().trim().max(60).optional(),
  })
  .strict();

const revenuePerformanceQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    currency: currencySchema,
  })
  .strict();

const liquidityQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    asOfDate: dateSchema.optional(),
    currency: currencySchema,
  })
  .strict();

const customer360ListQuerySchema = z
  .object({
    search: z.string().trim().max(120).optional(),
    status: z.enum(["all", "active_a30", "dormant_90"]).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(5).max(100).default(25),
    asOfDate: dateSchema.optional(),
    currency: currencySchema,
  })
  .strict();

const customer360DetailQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    asOfDate: dateSchema.optional(),
    currency: currencySchema,
  })
  .strict();

const insightsAlertsQuerySchema = z
  .object({
    dateFrom: dateSchema,
    dateTo: dateSchema,
    asOfDate: dateSchema.optional(),
    currency: currencySchema,
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
    currency: normalizeQueryValue(req.query.currency),
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
      currency: parsedQuery.data.currency,
    });

    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletCustomerActivityGrowthHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = customerActivityQuerySchema.safeParse(queryInput);
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
    const data = await getWalletCustomerActivityGrowth(parsedQuery.data);
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletRetentionDormancyHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    asOfDate: normalizeQueryValue(req.query.asOfDate),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = retentionQuerySchema.safeParse(queryInput);
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
    const data = await getWalletRetentionDormancy({
      dateFrom: parsedQuery.data.dateFrom,
      dateTo: parsedQuery.data.dateTo,
      asOfDate: parsedQuery.data.asOfDate ?? parsedQuery.data.dateTo,
      currency: parsedQuery.data.currency,
    });
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletTransactionPerformanceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    currency: normalizeQueryValue(req.query.currency),
    useCase: normalizeQueryValue(req.query.useCase),
  };

  const parsedQuery = transactionPerformanceQuerySchema.safeParse(queryInput);
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
    const data = await getWalletTransactionPerformance({
      dateFrom: parsedQuery.data.dateFrom,
      dateTo: parsedQuery.data.dateTo,
      currency: parsedQuery.data.currency,
      useCase: parsedQuery.data.useCase,
    });
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletRevenuePerformanceHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = revenuePerformanceQuerySchema.safeParse(queryInput);
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
    const data = await getWalletRevenuePerformance(parsedQuery.data);
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletLiquidityHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    asOfDate: normalizeQueryValue(req.query.asOfDate),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = liquidityQuerySchema.safeParse(queryInput);
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
    const data = await getWalletLiquidity({
      dateFrom: parsedQuery.data.dateFrom,
      dateTo: parsedQuery.data.dateTo,
      asOfDate: parsedQuery.data.asOfDate ?? parsedQuery.data.dateTo,
      currency: parsedQuery.data.currency,
    });
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function listWalletCustomer360Handler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    search: normalizeQueryValue(req.query.search),
    status: normalizeQueryValue(req.query.status),
    page: normalizeQueryValue(req.query.page),
    pageSize: normalizeQueryValue(req.query.pageSize),
    asOfDate: normalizeQueryValue(req.query.asOfDate),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = customer360ListQuerySchema.safeParse(queryInput);
  if (!parsedQuery.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedQuery.error.flatten(),
    });
    return;
  }

  try {
    const data = await listWalletCustomer360({
      search: parsedQuery.data.search,
      status: parsedQuery.data.status ?? "all",
      page: parsedQuery.data.page,
      pageSize: parsedQuery.data.pageSize,
      asOfDate: parsedQuery.data.asOfDate ?? new Date(),
      currency: parsedQuery.data.currency,
    });
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletCustomer360DetailHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const customerId = typeof req.params.customerId === "string" ? req.params.customerId : "";
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    asOfDate: normalizeQueryValue(req.query.asOfDate),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = customer360DetailQuerySchema.safeParse(queryInput);
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
    const data = await getWalletCustomer360Detail({
      customerId,
      dateFrom: parsedQuery.data.dateFrom,
      dateTo: parsedQuery.data.dateTo,
      asOfDate: parsedQuery.data.asOfDate ?? parsedQuery.data.dateTo,
      currency: parsedQuery.data.currency,
    });
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

export async function getWalletInsightsAlertsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryInput = {
    dateFrom: normalizeQueryValue(req.query.dateFrom),
    dateTo: normalizeQueryValue(req.query.dateTo),
    asOfDate: normalizeQueryValue(req.query.asOfDate),
    currency: normalizeQueryValue(req.query.currency),
  };

  const parsedQuery = insightsAlertsQuerySchema.safeParse(queryInput);
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
    const data = await getWalletInsightsAlerts({
      dateFrom: parsedQuery.data.dateFrom,
      dateTo: parsedQuery.data.dateTo,
      asOfDate: parsedQuery.data.asOfDate ?? parsedQuery.data.dateTo,
      currency: parsedQuery.data.currency,
    });
    res.json({ data });
  } catch (error) {
    if (handleServiceError(res, error)) {
      return;
    }

    next(error);
  }
}

