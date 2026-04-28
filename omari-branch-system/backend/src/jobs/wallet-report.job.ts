import {
  EmailSendStatus,
  EmailType,
  createEmailLog,
  getRecipientsForEmailType,
} from "../services/emailer.service";
import { sendEmail } from "../services/email.service";
import { isSourceMetricsConfigured } from "../services/source-agent-metrics.service";
import { withLock } from "../services/job-lock.service";
import { formatDateString, getTodayInHarare } from "../services/alert-evaluation.service";
import { getWalletDailySummary, type WalletDailySummaryRow } from "../services/wallet.service";

const JOB_NAME = "daily-wallet-report-emailer";
const JOB_LOCK_DURATION_MS = 10 * 60 * 1000;

export type WalletReportJobResult = {
  reportDate: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedAlreadySent: number;
  skippedNoSource: number;
  errors: string[];
};

function getYesterdayInHarare(): Date {
  const today = getTodayInHarare();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function money(value: number, currency: string): string {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${formatted}` : `${currency} ${formatted}`;
}

function buildReportBody(
  reportDate: string,
  rows: WalletDailySummaryRow[],
): string {
  if (rows.length === 0) {
    return [
      "Wallet Daily Performance Snapshot",
      "",
      `Date: ${reportDate}`,
      "",
      "No wallet transaction data was recorded for this date.",
      "",
      "---",
      "Omari Wallet System - Automated Daily Report",
    ].join("\n");
  }

  const sections = rows.map((row) => {
    const cur = row.currency;
    const noData = row.totalVolume === 0 && row.totalValue === 0;

    if (noData) {
      return [`${cur} Wallet`, `  No transactions recorded.`].join("\n");
    }

    return [
      `${cur} Wallet`,
      `  Transactions  : ${row.totalVolume.toLocaleString()} txns / ${money(row.totalValue, cur)}`,
      `  Commission    : ${money(row.totalCommission, cur)}`,
      `  Active Wallets: ${row.activeAccounts.toLocaleString()}`,
    ].join("\n");
  });

  return [
    "Wallet Daily Performance Snapshot",
    "",
    `Date: ${reportDate}`,
    "",
    sections.join("\n\n"),
    "",
    "---",
    "Omari Wallet System - Automated Daily Report",
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

async function hasReportAlreadySent(sentTo: string, reportDate: Date): Promise<boolean> {
  const { prisma } = await import("../db/prisma");
  const count = await prisma.emailLog.count({
    where: {
      emailType: EmailType.DAILY_WALLET_REPORT,
      sentTo,
      reportDate,
      status: EmailSendStatus.SENT,
    },
  });
  return count > 0;
}

export async function runDailyWalletReportJob(): Promise<WalletReportJobResult> {
  const reportDate = getYesterdayInHarare();
  const reportDateText = formatDateString(reportDate);

  console.log(`[WalletReportJob] Starting report send for ${reportDateText}`);

  const result: WalletReportJobResult = {
    reportDate: reportDateText,
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    skippedAlreadySent: 0,
    skippedNoSource: 0,
    errors: [],
  };

  const recipients = await getRecipientsForEmailType(EmailType.DAILY_WALLET_REPORT);
  result.recipientCount = recipients.length;

  if (recipients.length === 0) {
    console.log(`[WalletReportJob] No recipients subscribed to ${EmailType.DAILY_WALLET_REPORT}`);
    return result;
  }

  if (!isSourceMetricsConfigured()) {
    console.log(`[WalletReportJob] Source SQL not configured — skipping wallet report`);
    result.skippedNoSource = recipients.length;
    return result;
  }

  let rows: WalletDailySummaryRow[];
  try {
    rows = await getWalletDailySummary(reportDate);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to query wallet data: ${msg}`);
    console.error(`[WalletReportJob] Failed to query wallet data:`, error);
    return result;
  }

  const subject = `Daily Wallet Report - ${reportDateText}`;
  const text = buildReportBody(reportDateText, rows);

  for (const recipient of recipients) {
    try {
      if (await hasReportAlreadySent(recipient.email, reportDate)) {
        result.skippedAlreadySent++;
        continue;
      }

      await sendEmail({ to: [recipient.email], subject, text, html: textToHtml(text) });

      await createEmailLog({
        emailType: EmailType.DAILY_WALLET_REPORT,
        recipientId: recipient.id,
        sentTo: recipient.email,
        subject,
        status: EmailSendStatus.SENT,
        reportDate,
        metadata: `rows=${rows.length}`,
      });

      result.sentCount++;
      console.log(`[WalletReportJob] Sent ${reportDateText} report to ${recipient.email}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      await createEmailLog({
        emailType: EmailType.DAILY_WALLET_REPORT,
        recipientId: recipient.id,
        sentTo: recipient.email,
        subject,
        status: EmailSendStatus.FAILED,
        errorMessage: msg,
        reportDate,
      }).catch(() => undefined);

      result.failedCount++;
      result.errors.push(`Failed to send to ${recipient.email}: ${msg}`);
      console.error(`[WalletReportJob] Failed to send to ${recipient.email}:`, error);
    }
  }

  console.log(
    `[WalletReportJob] Completed: sent=${result.sentCount}, failed=${result.failedCount}, skipped=${result.skippedAlreadySent}`,
  );

  return result;
}

export async function runDailyWalletReportJobWithLock(): Promise<{
  executed: boolean;
  result?: WalletReportJobResult;
  error?: Error;
}> {
  return withLock(JOB_NAME, runDailyWalletReportJob, JOB_LOCK_DURATION_MS);
}
