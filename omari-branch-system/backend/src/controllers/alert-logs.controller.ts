import type { Request, Response, NextFunction } from "express";
import { AlertRuleType, AlertSendStatus } from "@prisma/client";

import {
  listAlertLogs,
  getAlertLogById,
  getAlertLogStats,
} from "../services/alert-logs.service";

// ============================================================================
// Helpers
// ============================================================================

function parseBigIntOrUndefined(value: unknown): bigint | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  try {
    return BigInt(String(value));
  } catch {
    return undefined;
  }
}

function parseDateOrUndefined(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const date = new Date(String(value));
  return isNaN(date.getTime()) ? undefined : date;
}

function parseRuleTypeOrUndefined(value: unknown): AlertRuleType | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const str = String(value).toUpperCase();
  if (str === "DUE_REMINDER" || str === "OVERDUE_ESCALATION") {
    return str as AlertRuleType;
  }
  return undefined;
}

function parseStatusOrUndefined(value: unknown): AlertSendStatus | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const str = String(value).toUpperCase();
  if (
    str === "SENT" ||
    str === "FAILED" ||
    str === "SKIPPED" ||
    str === "PENDING"
  ) {
    return str as AlertSendStatus;
  }
  return undefined;
}

// ============================================================================
// Controllers
// ============================================================================

/**
 * GET /api/alerts/logs
 * List alert logs with optional filters.
 */
export async function getAlertLogs(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const branchId = parseBigIntOrUndefined(req.query.branchId);
    const expenseId = parseBigIntOrUndefined(req.query.expenseId);
    const ruleType = parseRuleTypeOrUndefined(req.query.ruleType);
    const status = parseStatusOrUndefined(req.query.status);
    const dateFrom = parseDateOrUndefined(req.query.dateFrom);
    const dateTo = parseDateOrUndefined(req.query.dateTo);
    const page = req.query.page ? Number(req.query.page) : undefined;
    const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;

    const result = await listAlertLogs({
      branchId,
      expenseId,
      ruleType,
      status,
      dateFrom,
      dateTo,
      page,
      pageSize,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alerts/logs/:id
 * Get a single alert log by ID.
 */
export async function getAlertLogByIdController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const id = parseBigIntOrUndefined(req.params.id);
    if (id === undefined) {
      return res.status(400).json({ error: "Invalid alert log ID" });
    }

    const alertLog = await getAlertLogById(id);
    if (!alertLog) {
      return res.status(404).json({ error: "Alert log not found" });
    }

    res.json(alertLog);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/alerts/stats
 * Get alert statistics summary.
 */
export async function getAlertStatsController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const stats = await getAlertLogStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
}
