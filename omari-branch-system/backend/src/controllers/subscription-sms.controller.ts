import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../db/prisma';
import {
  previewSubscriptionSmsReminders,
} from '../services/subscription-sms-reminder.service';
import { getSmsImpactStats } from '../services/subscription-sms-reconciliation.service';

function parseDateOrUndefined(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
}

export async function getSmsLog(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dateFrom  = parseDateOrUndefined(req.query.dateFrom);
    const dateTo    = parseDateOrUndefined(req.query.dateTo);
    const lane      = parseStringOrUndefined(req.query.lane);
    const service   = parseStringOrUndefined(req.query.serviceName);
    const sentParam = parseStringOrUndefined(req.query.smsSent);

    const where: Prisma.SubscriptionSmsLogWhereInput = {};

    if (dateFrom || dateTo) {
      where.sentAt = {};
      if (dateFrom) where.sentAt.gte = dateFrom;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.sentAt.lte = end;
      }
    }
    if (lane)    where.lane        = lane;
    if (service) where.serviceName = service;
    if (sentParam !== undefined) where.smsSent = sentParam === 'true';

    const [entries, total, allForSummary] = await Promise.all([
      prisma.subscriptionSmsLog.findMany({ where, orderBy: { sentAt: 'desc' }, take: 500 }),
      prisma.subscriptionSmsLog.count({ where }),
      prisma.subscriptionSmsLog.findMany({
        where,
        select: { smsSent: true, serviceName: true, topUpAmount: true },
      }),
    ]);

    const sentCount = allForSummary.filter(e => e.smsSent).length;
    const serviceFreq: Record<string, number> = {};
    let totalTopUp = 0;
    for (const e of allForSummary) {
      serviceFreq[e.serviceName] = (serviceFreq[e.serviceName] ?? 0) + 1;
      totalTopUp += Number(e.topUpAmount);
    }
    const topService = Object.entries(serviceFreq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    res.json({
      summary: {
        totalSent:             sentCount,
        totalFailed:           allForSummary.length - sentCount,
        successRate:           allForSummary.length > 0 ? Math.round((sentCount / allForSummary.length) * 100) : 0,
        topService,
        totalTopUpValueAtRisk: Math.round(totalTopUp * 100) / 100,
      },
      entries: entries.map(e => ({
        id:                  e.id.toString(),
        sentAt:              e.sentAt.toISOString(),
        mobileNr:            e.mobileNr,
        serviceName:         e.serviceName,
        lane:                e.lane,
        subscriptionAmount:  Number(e.subscriptionAmount),
        feeAmount:           Number(e.feeAmount),
        totalNeeded:         Number(e.totalNeeded),
        currentBalance:      Number(e.currentBalance),
        topUpAmount:         Number(e.topUpAmount),
        predictedChargeDate: e.predictedChargeDate.toISOString().slice(0, 10),
        smsSent:             e.smsSent,
        smsError:            e.smsError,
      })),
      total,
    });
  } catch (err) {
    next(err);
  }
}

export async function getSmsPreview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await previewSubscriptionSmsReminders();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSmsImpact(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const days = parseInt(String(req.query.days ?? '30'), 10);
    const result = await getSmsImpactStats(Number.isFinite(days) && days >= 0 ? days : 30);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
