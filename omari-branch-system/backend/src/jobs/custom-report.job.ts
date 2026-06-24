import { prisma } from "../db/prisma";
import { sendEmail } from "../services/email.service";
import {
  EmailSendStatus,
  EmailType,
  createEmailLog,
} from "../services/emailer.service";
import { withLock } from "../services/job-lock.service";
import { formatDateString, getTodayInHarare } from "../services/alert-evaluation.service";
import { buildAllSectionsData } from "../services/custom-report-data.service";
import {
  buildCustomReportHtml,
  buildCustomReportText,
} from "../services/custom-report-email.service";
import type { UserReportConfigData, ReportSection } from "../services/custom-report-types";

const JOB_NAME = "custom-report-emailer";
const JOB_LOCK_DURATION_MS = 15 * 60 * 1000;

export type CustomReportJobResult = {
  reportDate: string;
  usersProcessed: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  errors: string[];
};

function parseConfig(raw: { sections: string; branchIds: string; isEnabled: boolean; deliveryEmail: string }): UserReportConfigData {
  let sections: ReportSection[] = [];
  let branchIds: string[] = [];
  try { sections = JSON.parse(raw.sections) as ReportSection[]; } catch { sections = []; }
  try { branchIds = JSON.parse(raw.branchIds) as string[]; } catch { branchIds = []; }
  return { isEnabled: raw.isEnabled, deliveryEmail: raw.deliveryEmail, sections, branchIds };
}

async function hasAlreadySent(sentTo: string, reportDate: Date): Promise<boolean> {
  const count = await prisma.emailLog.count({
    where: {
      emailType: EmailType.CUSTOM_REPORT,
      sentTo,
      reportDate,
      status: EmailSendStatus.SENT,
    },
  });
  return count > 0;
}

async function sendCustomReport(params: {
  userId: bigint;
  username: string;
  to: string;
  config: UserReportConfigData;
  reportDate: Date;
  reportDateText: string;
}): Promise<"sent" | "failed" | "skipped"> {
  const { userId, username, to, config, reportDate, reportDateText } = params;

  if (config.sections.length === 0) return "skipped";
  if (await hasAlreadySent(to, reportDate)) return "skipped";

  const subject = `Your Daily Report — ${reportDateText}`;

  try {
    const sectionsData = await buildAllSectionsData(config.sections, config.branchIds);
    const html = buildCustomReportHtml(username, sectionsData, reportDateText);
    const text = buildCustomReportText(sectionsData, reportDateText);

    await sendEmail({ to: [to], subject, html, text });
    await createEmailLog({
      emailType: EmailType.CUSTOM_REPORT,
      recipientId: null,
      sentTo: to,
      subject,
      status: EmailSendStatus.SENT,
      branchId: null,
      reportDate,
      metadata: `userId=${userId.toString()};sections=${config.sections.length}`,
    });
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await createEmailLog({
      emailType: EmailType.CUSTOM_REPORT,
      recipientId: null,
      sentTo: to,
      subject,
      status: EmailSendStatus.FAILED,
      errorMessage: message,
      branchId: null,
      reportDate,
      metadata: `userId=${userId.toString()}`,
    });
    return "failed";
  }
}

export async function runCustomReportJob(): Promise<CustomReportJobResult> {
  const today = getTodayInHarare();
  const reportDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const reportDateText = formatDateString(reportDate);

  const configs = await prisma.userReportConfig.findMany({
    where: { isEnabled: true },
    include: { user: { select: { id: true, username: true } } },
  });

  const result: CustomReportJobResult = {
    reportDate: reportDateText,
    usersProcessed: configs.length,
    sentCount: 0,
    failedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  console.log(`[CustomReportJob] Processing ${configs.length} user report(s) for ${reportDateText}`);

  for (const raw of configs) {
    const config = parseConfig(raw);
    const outcome = await sendCustomReport({
      userId: raw.userId,
      username: raw.user.username,
      to: config.deliveryEmail,
      config,
      reportDate,
      reportDateText,
    });

    if (outcome === "sent") result.sentCount++;
    else if (outcome === "failed") {
      result.failedCount++;
      result.errors.push(`Failed to send to ${config.deliveryEmail} (userId=${raw.userId})`);
    } else {
      result.skippedCount++;
    }
  }

  console.log(
    `[CustomReportJob] Done: sent=${result.sentCount}, failed=${result.failedCount}, skipped=${result.skippedCount}`,
  );

  return result;
}

export async function runCustomReportJobWithLock(): Promise<{
  executed: boolean;
  result?: CustomReportJobResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, runCustomReportJob, JOB_LOCK_DURATION_MS);
}
