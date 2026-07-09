import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../db/prisma';
import {
  previewSubscriptionSmsReminders,
} from '../services/subscription-sms-reminder.service';
import { getSmsImpactStats } from '../services/subscription-sms-reconciliation.service';
import { sendSms } from '../services/sms.service';
import { isSmsSendingEnabled, setConfig, CONFIG_KEYS } from '../services/system-config.service';

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

export async function getSmsConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const enabled = await isSmsSendingEnabled();
    res.json({ smsSendingEnabled: enabled });
  } catch (err) {
    next(err);
  }
}

export async function updateSmsConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { smsSendingEnabled } = req.body as { smsSendingEnabled: boolean };
    if (typeof smsSendingEnabled !== 'boolean') {
      res.status(400).json({ error: 'smsSendingEnabled must be a boolean' });
      return;
    }
    const updatedBy = (req as any).user?.username ?? 'unknown';
    await setConfig(CONFIG_KEYS.SMS_SENDING_ENABLED, String(smsSendingEnabled), updatedBy);
    res.json({ smsSendingEnabled });
  } catch (err) {
    next(err);
  }
}

export async function retrySms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const date = parseDateOrUndefined(req.query.date);

    // Build the where clause: smsSent=false, optionally scoped to a date
    const where: Prisma.SubscriptionSmsLogWhereInput = { smsSent: false };
    if (date) {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      where.sentAt = { gte: dayStart, lte: dayEnd };
    }

    const failed = await prisma.subscriptionSmsLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 500,
    });

    if (failed.length === 0) {
      res.json({ retried: 0, succeeded: 0, failed: 0, message: 'No failed SMS entries found for the given filter.' });
      return;
    }

    let succeeded = 0;
    let failedCount = 0;

    await Promise.all(failed.map(async (entry) => {
      // Use the stored message text; fall back to rebuilding it for older records that predate the message column
      const text = entry.message ?? (
        `Your ${entry.serviceName} payment of $${Number(entry.subscriptionAmount).toFixed(2)} ` +
        `is due on ${entry.predictedChargeDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}. ` +
        `Please top up at least $${Number(entry.topUpAmount).toFixed(2)} to your Omari wallet ` +
        `to avoid a failed charge on your Omari Visa card.`
      );
      const sent = await sendSms(entry.mobileNr, text);
      await prisma.subscriptionSmsLog.update({
        where: { id: entry.id },
        data: {
          smsSent: sent,
          smsError: sent ? null : 'Retry failed — see console logs',
        },
      });
      if (sent) succeeded++; else failedCount++;
    }));

    res.json({ retried: failed.length, succeeded, failed: failedCount });
  } catch (err) {
    next(err);
  }
}
