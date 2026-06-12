import type { NextFunction, Request, Response } from "express";

import { getDashboardOverview } from "../services/dashboard.service";

export async function getDashboardOverviewHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getDashboardOverview();
    res.json({ data });
  } catch (error) {
    next(error);
  }
}
