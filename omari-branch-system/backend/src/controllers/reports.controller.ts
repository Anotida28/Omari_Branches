import type { NextFunction, Request, Response } from "express";

import { getReportsData } from "../services/reports.service";

function parseDate(value: unknown, name: string): Date {
  if (typeof value !== "string" || !value) {
    throw Object.assign(new Error(`Missing required query param: ${name}`), { status: 400 });
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (isNaN(d.getTime())) {
    throw Object.assign(new Error(`Invalid date for ${name}: ${value}`), { status: 400 });
  }
  return d;
}

export async function getReportsDataHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const dateFrom = parseDate(req.query.dateFrom, "dateFrom");
    const dateTo = parseDate(req.query.dateTo, "dateTo");
    const branchIdRaw = req.query.branchId;
    const branchId =
      typeof branchIdRaw === "string" && branchIdRaw ? BigInt(branchIdRaw) : undefined;

    const data = await getReportsData({ branchId, dateFrom, dateTo });
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
