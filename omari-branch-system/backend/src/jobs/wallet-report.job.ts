import { prisma } from "../db/prisma";
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

export function money(value: number, currency: string): string {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "USD" ? `$${formatted}` : `${currency} ${formatted}`;
}

export function buildWalletReportBody(
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

export function buildWalletReportHtml(reportDate: string, rows: WalletDailySummaryRow[]): string {
  const H = "#1e3a5f";

  if (rows.length === 0) {
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:20px;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
  <div style="background:${H};padding:22px 24px">
    <div style="font-size:20px;font-weight:700;color:#fff">Daily Wallet Performance Snapshot</div>
    <div style="font-size:13px;color:#93c5fd;margin-top:4px">Report Date: ${reportDate}</div>
  </div>
  <div style="padding:24px;color:#6b7280;text-align:center">No wallet transaction data was recorded for this date.</div>
  <div style="padding:14px 24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e9f0">Omari Wallet System — Automated Daily Report</div>
</div>
</body></html>`;
  }

  const th = (label: string, right = false) =>
    `<th style="padding:10px 14px;color:#fff;font-size:12px;font-weight:600;${right ? "text-align:right;" : "text-align:left;"}">${label}</th>`;
  const td = (content: string, right = false, bold = false) =>
    `<td style="padding:11px 14px;border-bottom:1px solid #e5e9f0;${right ? "text-align:right;" : ""}${bold ? "font-weight:700;" : ""}">${content}</td>`;

  const rowsHtml = rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
    const noData = row.totalVolume === 0 && row.totalValue === 0;
    const badge = noData
      ? `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;background:#f3f4f6;color:#374151">No Data</span>`
      : `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;background:#dcfce7;color:#14532d">Active</span>`;
    return `<tr style="background:${bg}">
      ${td(`<strong>${row.currency} Wallet</strong>`)}
      ${td(noData ? "—" : row.totalVolume.toLocaleString(), true)}
      ${td(noData ? "—" : money(row.totalValue, row.currency), true)}
      ${td(noData ? "—" : money(row.totalCommission, row.currency), true)}
      ${td(noData ? "—" : row.activeAccounts.toLocaleString(), true)}
      ${td(badge)}
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
  <div style="background:${H};padding:22px 24px">
    <div style="font-size:20px;font-weight:700;color:#fff">Daily Wallet Performance Snapshot</div>
    <div style="font-size:13px;color:#93c5fd;margin-top:4px">Report Date: ${reportDate} &nbsp;·&nbsp; ${rows.length} Currenc${rows.length !== 1 ? "ies" : "y"}</div>
  </div>
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:${H}">
        <tr>
          ${th("Currency")}
          ${th("Transactions", true)}
          ${th("Total Value", true)}
          ${th("Commission", true)}
          ${th("Active Wallets", true)}
          ${th("Status")}
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
  <div style="padding:14px 24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e9f0">
    Omari Wallet System — Automated Daily Report
  </div>
</div>
</body>
</html>`;
}

async function hasReportAlreadySent(sentTo: string, reportDate: Date): Promise<boolean> {
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
  const text = buildWalletReportBody(reportDateText, rows);
  const html = buildWalletReportHtml(reportDateText, rows);

  for (const recipient of recipients) {
    try {
      if (await hasReportAlreadySent(recipient.email, reportDate)) {
        result.skippedAlreadySent++;
        continue;
      }

      await sendEmail({ to: [recipient.email], subject, text, html });

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
