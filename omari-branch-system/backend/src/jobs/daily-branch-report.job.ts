import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import {
  EmailSendStatus,
  EmailType,
  createEmailLog,
  getRecipientsForEmailType,
} from "../services/emailer.service";
import { sendEmail } from "../services/email.service";
import { withLock } from "../services/job-lock.service";
import { formatDateString, getTodayInHarare } from "../services/alert-evaluation.service";

const JOB_NAME = "daily-branch-report-emailer";
const JOB_LOCK_DURATION_MS = 15 * 60 * 1000;

type BranchReportMetric = {
  branchId: bigint;
  branchName: string;
  date: string;
  eFloatBalance: Prisma.Decimal;
  cashInVolume: number;
  cashInValue: Prisma.Decimal;
  cashOutVolume: number;
  cashOutValue: Prisma.Decimal;
  totalTransactionVolume: number;
  totalTransactionValue: Prisma.Decimal;
  totalCommission: Prisma.Decimal;
};

export type DailyBranchReportJobResult = {
  reportDate: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedAlreadySent: number;
  skippedNoMetrics: number;
  errors: string[];
};

function getYesterdayInHarare(): Date {
  const today = getTodayInHarare();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function money(value: Prisma.Decimal | number | string): string {
  const decimal = new Prisma.Decimal(value);
  return `$${decimal.toFixed(2)}`;
}

function buildStatusLine(metric: BranchReportMetric): string {
  const cashIn = new Prisma.Decimal(metric.cashInValue);
  const cashOut = new Prisma.Decimal(metric.cashOutValue);
  const eFloat = new Prisma.Decimal(metric.eFloatBalance);

  if (cashOut.greaterThan(cashIn)) {
    return "Cash out exceeded cash in for the day.";
  }
  if (eFloat.lessThan(500)) {
    return "E-float balance is low.";
  }
  if (metric.totalTransactionVolume === 0) {
    return "No transactions were recorded for the day.";
  }
  return "Branch activity is within normal daily range.";
}

function buildReportBody(reportDate: string, metrics: BranchReportMetric[]): string {
  if (metrics.length === 0) {
    return `Daily Branch Performance Snapshot\n\nDate: ${reportDate}\n\nNo branch metrics were recorded for this date.`;
  }

  const sections = metrics.map((metric) => {
    const netCash = new Prisma.Decimal(metric.cashInValue).minus(metric.cashOutValue);
    return [
      metric.branchName,
      `Cash In: ${metric.cashInVolume} txns / ${money(metric.cashInValue)}`,
      `Cash Out: ${metric.cashOutVolume} txns / ${money(metric.cashOutValue)}`,
      `Net Cash: ${money(netCash)}`,
      `Total Volume: ${metric.totalTransactionVolume}`,
      `Total Value: ${money(metric.totalTransactionValue)}`,
      `Total Commission: ${money(metric.totalCommission)}`,
      `E-Float Balance: ${money(metric.eFloatBalance)}`,
      `Snapshot: ${buildStatusLine(metric)}`,
    ].join("\n");
  });

  return [
    "Daily Branch Performance Snapshot",
    "",
    `Date: ${reportDate}`,
    "",
    sections.join("\n\n"),
    "",
    "---",
    "Omari Branch System - Automated Daily Report",
  ].join("\n");
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  return `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.45;">${escaped}</pre>`;
}

async function loadReportMetrics(reportDate: Date): Promise<BranchReportMetric[]> {
  const metrics = await prisma.branchMetric.findMany({
    where: { metricDate: reportDate },
    include: {
      branch: { select: { id: true, city: true, label: true } },
    },
    orderBy: [{ branch: { city: "asc" } }, { branch: { label: "asc" } }],
  });

  return metrics.map((metric) => ({
    branchId: metric.branchId,
    branchName: `${metric.branch.city} - ${metric.branch.label}`,
    date: formatDateString(metric.metricDate),
    eFloatBalance: metric.eFloatBalance,
    cashInVolume: metric.cashInVolume,
    cashInValue: metric.cashInValue,
    cashOutVolume: metric.cashOutVolume,
    cashOutValue: metric.cashOutValue,
    totalTransactionVolume: metric.totalTransactionVolume,
    totalTransactionValue: metric.totalTransactionValue,
    totalCommission: metric.totalCommission,
  }));
}

async function hasReportAlreadySent(params: {
  sentTo: string;
  reportDate: Date;
  branchId: bigint | null;
}): Promise<boolean> {
  const count = await prisma.emailLog.count({
    where: {
      emailType: EmailType.DAILY_BRANCH_REPORT,
      sentTo: params.sentTo,
      reportDate: params.reportDate,
      branchId: params.branchId,
      status: EmailSendStatus.SENT,
    },
  });

  return count > 0;
}

async function sendReportEmail(params: {
  recipientId: bigint;
  to: string;
  reportDate: Date;
  reportDateText: string;
  branchId: bigint | null;
  metrics: BranchReportMetric[];
}): Promise<"sent" | "failed"> {
  const scopeLabel = params.branchId ? params.metrics[0]?.branchName ?? "Branch" : "All Branches";
  const subject = `Daily Branch Report - ${params.reportDateText} - ${scopeLabel}`;
  const text = buildReportBody(params.reportDateText, params.metrics);

  try {
    await sendEmail({
      to: [params.to],
      subject,
      text,
      html: textToHtml(text),
    });
    await createEmailLog({
      emailType: EmailType.DAILY_BRANCH_REPORT,
      recipientId: params.recipientId,
      sentTo: params.to,
      subject,
      status: EmailSendStatus.SENT,
      branchId: params.branchId,
      reportDate: params.reportDate,
      metadata: `metrics=${params.metrics.length}`,
    });
    return "sent";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await createEmailLog({
      emailType: EmailType.DAILY_BRANCH_REPORT,
      recipientId: params.recipientId,
      sentTo: params.to,
      subject,
      status: EmailSendStatus.FAILED,
      errorMessage: message,
      branchId: params.branchId,
      reportDate: params.reportDate,
      metadata: `metrics=${params.metrics.length}`,
    });
    return "failed";
  }
}

export async function runDailyBranchReportJob(): Promise<DailyBranchReportJobResult> {
  const reportDate = getYesterdayInHarare();
  const reportDateText = formatDateString(reportDate);
  const recipients = await getRecipientsForEmailType(EmailType.DAILY_BRANCH_REPORT);
  const metrics = await loadReportMetrics(reportDate);
  const metricsByBranchId = new Map(metrics.map((metric) => [metric.branchId.toString(), metric]));

  const result: DailyBranchReportJobResult = {
    reportDate: reportDateText,
    recipientCount: recipients.length,
    sentCount: 0,
    failedCount: 0,
    skippedAlreadySent: 0,
    skippedNoMetrics: 0,
    errors: [],
  };

  console.log(`[DailyReportJob] Starting report send for ${reportDateText}`);

  for (const recipient of recipients) {
    const branchId = recipient.branchId;
    const scopedMetrics = branchId
      ? [metricsByBranchId.get(branchId.toString())].filter((metric): metric is BranchReportMetric => Boolean(metric))
      : metrics;

    if (scopedMetrics.length === 0) {
      result.skippedNoMetrics++;
      await createEmailLog({
        emailType: EmailType.DAILY_BRANCH_REPORT,
        recipientId: recipient.id,
        sentTo: recipient.email,
        subject: `Daily Branch Report - ${reportDateText}`,
        status: EmailSendStatus.SKIPPED,
        branchId,
        reportDate,
        errorMessage: "No branch metrics found for report scope",
      });
      continue;
    }

    if (await hasReportAlreadySent({ sentTo: recipient.email, reportDate, branchId })) {
      result.skippedAlreadySent++;
      continue;
    }

    const sendResult = await sendReportEmail({
      recipientId: recipient.id,
      to: recipient.email,
      reportDate,
      reportDateText,
      branchId,
      metrics: scopedMetrics,
    });

    if (sendResult === "sent") {
      result.sentCount++;
    } else {
      result.failedCount++;
      result.errors.push(`Failed to send ${reportDateText} report to ${recipient.email}`);
    }
  }

  console.log(
    `[DailyReportJob] Completed: sent=${result.sentCount}, failed=${result.failedCount}, skipped=${result.skippedAlreadySent + result.skippedNoMetrics}`,
  );

  return result;
}

export async function runDailyBranchReportJobWithLock(): Promise<{
  executed: boolean;
  result?: DailyBranchReportJobResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, runDailyBranchReportJob, JOB_LOCK_DURATION_MS);
}
