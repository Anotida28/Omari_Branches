import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { prisma } from "../db/prisma";
import { sendEmail } from "../services/email.service";
import { formatDateString, getTodayInHarare } from "../services/alert-evaluation.service";
import { buildAllSectionsData } from "../services/custom-report-data.service";
import { buildCustomReportHtml, buildCustomReportText } from "../services/custom-report-email.service";
import type { ReportSection, UserReportConfigData } from "../services/custom-report-types";

const VALID_SECTION_TYPES = [
  "BRANCH_PERFORMANCE",
  "TOP_PERFORMERS",
  "WALLET_SUMMARY",
  "WALLET_RETENTION",
  "ALERTS_SUMMARY",
] as const;

const sectionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(VALID_SECTION_TYPES),
  params: z.record(z.string(), z.unknown()).default({}),
});

const configSchema = z.object({
  isEnabled: z.boolean(),
  deliveryEmail: z.string().email("deliveryEmail must be a valid email address"),
  sections: z.array(sectionSchema).max(10, "Maximum 10 sections allowed"),
  branchIds: z.array(z.string()).default([]),
});

function parseStoredConfig(raw: { isEnabled: boolean; deliveryEmail: string; sections: string; branchIds: string }): UserReportConfigData {
  let sections: ReportSection[] = [];
  let branchIds: string[] = [];
  try { sections = JSON.parse(raw.sections) as ReportSection[]; } catch { sections = []; }
  try { branchIds = JSON.parse(raw.branchIds) as string[]; } catch { branchIds = []; }
  return { isEnabled: raw.isEnabled, deliveryEmail: raw.deliveryEmail, sections, branchIds };
}

export async function getMyReportConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authUser!.id;
    const row = await prisma.userReportConfig.findUnique({ where: { userId } });
    if (!row) {
      res.json({ data: null });
      return;
    }
    res.json({ data: parseStoredConfig(row) });
  } catch (error) {
    next(error);
  }
}

export async function saveMyReportConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authUser!.id;
    const parsed = configSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", details: parsed.error.flatten() });
      return;
    }

    const { isEnabled, deliveryEmail, sections, branchIds } = parsed.data;

    const row = await prisma.userReportConfig.upsert({
      where: { userId },
      update: {
        isEnabled,
        deliveryEmail,
        sections: JSON.stringify(sections),
        branchIds: JSON.stringify(branchIds),
      },
      create: {
        userId,
        isEnabled,
        deliveryEmail,
        sections: JSON.stringify(sections),
        branchIds: JSON.stringify(branchIds),
      },
    });

    res.json({ data: parseStoredConfig(row) });
  } catch (error) {
    next(error);
  }
}

export async function sendTestReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authUser!.id;
    const username = req.authUser!.username;

    const row = await prisma.userReportConfig.findUnique({ where: { userId } });
    if (!row) {
      res.status(404).json({ error: "No report config found. Save your report first." });
      return;
    }

    const config = parseStoredConfig(row);
    if (config.sections.length === 0) {
      res.status(400).json({ error: "Add at least one section to your report before sending a test." });
      return;
    }

    const today = getTodayInHarare();
    const reportDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const reportDateText = formatDateString(reportDate);
    const subject = `[TEST] Your Daily Report — ${reportDateText}`;

    const sectionsData = await buildAllSectionsData(config.sections, config.branchIds);
    const html = buildCustomReportHtml(username, sectionsData, `${reportDateText} (Test)`);
    const text = buildCustomReportText(sectionsData, reportDateText);

    await sendEmail({ to: [config.deliveryEmail], subject, html, text });

    res.json({ ok: true, sentTo: config.deliveryEmail });
  } catch (error) {
    next(error);
  }
}
