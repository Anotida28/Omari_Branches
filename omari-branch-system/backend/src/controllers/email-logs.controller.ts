import type { NextFunction, Request, Response } from "express";

import { listEmailLogs } from "../services/email-logs.service";

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
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return undefined;
}

export async function getEmailLogs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listEmailLogs({
      emailType: parseStringOrUndefined(req.query.emailType),
      status: parseStringOrUndefined(req.query.status),
      sentTo: parseStringOrUndefined(req.query.sentTo),
      branchId: parseBigIntOrUndefined(req.query.branchId),
      dateFrom: parseDateOrUndefined(req.query.dateFrom),
      dateTo: parseDateOrUndefined(req.query.dateTo),
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}
