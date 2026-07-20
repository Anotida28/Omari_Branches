import type { NextFunction, Request, Response } from 'express';

import { fetchFlocashAnalytics, fetchResellerDetail } from '../services/flocash-analytics.service';

export async function getAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const data = await fetchFlocashAnalytics(forceRefresh);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getResellerDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { accountId } = req.params;
    if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
      res.status(400).json({ error: 'accountId is required' });
      return;
    }
    const data = await fetchResellerDetail(accountId.trim());
    res.json(data);
  } catch (err) {
    next(err);
  }
}
