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

export type BranchReportMetric = {
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

export function buildStatusLine(metric: BranchReportMetric): string {
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

export function buildBranchReportBody(reportDate: string, metrics: BranchReportMetric[]): string {
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

function statusBadge(metric: BranchReportMetric): { label: string; color: string; bg: string } {
  const cashIn = new Prisma.Decimal(metric.cashInValue);
  const cashOut = new Prisma.Decimal(metric.cashOutValue);
  const eFloat = new Prisma.Decimal(metric.eFloatBalance);
  if (cashOut.greaterThan(cashIn))
    return { label: "Cash-out Exceeded", color: "#7f1d1d", bg: "#fee2e2" };
  if (eFloat.lessThan(500))
    return { label: "Low E-Float", color: "#78350f", bg: "#fef3c7" };
  if (metric.totalTransactionVolume === 0)
    return { label: "No Transactions", color: "#374151", bg: "#f3f4f6" };
  return { label: "Normal", color: "#14532d", bg: "#dcfce7" };
}

export function buildBranchReportHtml(reportDate: string, metrics: BranchReportMetric[]): string {
  const H = "#1e3a5f";
  const cell = (content: string, right = false, bold = false) =>
    `<td style="padding:9px 12px;border-bottom:1px solid #e5e9f0;${right ? "text-align:right;" : ""}${bold ? "font-weight:600;" : ""}">${content}</td>`;

  let totalCashIn = new Prisma.Decimal(0);
  let totalCashOut = new Prisma.Decimal(0);
  let totalVolume = 0;
  let totalValue = new Prisma.Decimal(0);
  let totalCommission = new Prisma.Decimal(0);
  let totalEFloat = new Prisma.Decimal(0);

  const rows = metrics.map((m, i) => {
    const netCash = new Prisma.Decimal(m.cashInValue).minus(m.cashOutValue);
    const badge = statusBadge(m);
    totalCashIn = totalCashIn.plus(m.cashInValue);
    totalCashOut = totalCashOut.plus(m.cashOutValue);
    totalVolume += m.totalTransactionVolume;
    totalValue = totalValue.plus(m.totalTransactionValue);
    totalCommission = totalCommission.plus(m.totalCommission);
    totalEFloat = totalEFloat.plus(m.eFloatBalance);
    const bg = i % 2 === 0 ? "#ffffff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${cell(`<strong>${m.branchName}</strong>`)}
      ${cell(`${m.cashInVolume} txns<br/>${money(m.cashInValue)}`, true)}
      ${cell(`${m.cashOutVolume} txns<br/>${money(m.cashOutValue)}`, true)}
      ${cell(money(netCash), true)}
      ${cell(m.totalTransactionVolume.toLocaleString(), true)}
      ${cell(money(m.totalTransactionValue), true)}
      ${cell(money(m.totalCommission), true)}
      ${cell(money(m.eFloatBalance), true)}
      ${cell(`<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;background:${badge.bg};color:${badge.color}">${badge.label}</span>`)}
    </tr>`;
  }).join("");

  const totalNetCash = totalCashIn.minus(totalCashOut);
  const footerRow = `<tr style="background:#eef2f8;font-weight:700;border-top:2px solid ${H}">
    ${cell("TOTAL", false, true)}
    ${cell(money(totalCashIn), true, true)}
    ${cell(money(totalCashOut), true, true)}
    ${cell(money(totalNetCash), true, true)}
    ${cell(totalVolume.toLocaleString(), true, true)}
    ${cell(money(totalValue), true, true)}
    ${cell(money(totalCommission), true, true)}
    ${cell(money(totalEFloat), true, true)}
    ${cell("")}
  </tr>`;

  const th = (label: string, right = false) =>
    `<th style="padding:10px 12px;color:#fff;font-size:12px;font-weight:600;${right ? "text-align:right;" : "text-align:left;"}">${label}</th>`;

  const noData = `<tr><td colspan="9" style="padding:24px;text-align:center;color:#6b7280">No branch metrics were recorded for this date.</td></tr>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
<div style="max-width:960px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
  <div style="background:${H};padding:22px 24px">
    <div style="font-size:20px;font-weight:700;color:#fff">Daily Branch Performance Snapshot</div>
    <div style="font-size:13px;color:#93c5fd;margin-top:4px">Report Date: ${reportDate} &nbsp;·&nbsp; ${metrics.length} Branch${metrics.length !== 1 ? "es" : ""}</div>
  </div>
  <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead style="background:${H}">
        <tr>
          ${th("Branch")}
          ${th("Cash In", true)}
          ${th("Cash Out", true)}
          ${th("Net Cash", true)}
          ${th("Txns", true)}
          ${th("Total Value", true)}
          ${th("Commission", true)}
          ${th("E-Float", true)}
          ${th("Status")}
        </tr>
      </thead>
      <tbody>${metrics.length > 0 ? rows : noData}</tbody>
      ${metrics.length > 0 ? `<tfoot>${footerRow}</tfoot>` : ""}
    </table>
  </div>
  <div style="padding:14px 24px;font-size:11px;color:#9ca3af;border-top:1px solid #e5e9f0">
    Omari Branch System — Automated Daily Report
  </div>
</div>
</body>
</html>`;
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
  const text = buildBranchReportBody(params.reportDateText, params.metrics);
  const html = buildBranchReportHtml(params.reportDateText, params.metrics);

  try {
    await sendEmail({
      to: [params.to],
      subject,
      text,
      html,
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
