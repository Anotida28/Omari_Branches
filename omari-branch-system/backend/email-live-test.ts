/**
 * Live email delivery test script.
 * Run with: npx ts-node email-live-test.ts
 *
 * Sends 5 real emails one by one to the target address and reports results.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { prisma } from "./src/db/prisma";
import { sendEmail, sendAlertEmail, type AlertEmailPayload } from "./src/services/email.service";
import { buildBranchReportBody, buildBranchReportHtml } from "./src/jobs/daily-branch-report.job";
import { buildWalletReportBody, buildWalletReportHtml } from "./src/jobs/wallet-report.job";
import type { WalletDailySummaryRow } from "./src/services/wallet.service";

const TARGET = "Lourencer@oldmutual.co.zw";
const TODAY = new Date().toISOString().slice(0, 10);

// ─── helpers ────────────────────────────────────────────────────────────────

function header(n: number, title: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  TEST ${n}: ${title}`);
  console.log(`${"─".repeat(60)}`);
}

function ok(label: string, detail?: string) {
  console.log(`  ✅  ${label}${detail ? `  →  ${detail}` : ""}`);
}

function fail(label: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  console.log(`  ❌  ${label}`);
  console.log(`       ${msg}`);
}

function textToHtml(text: string): string {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.45;">${esc}</pre>`;
}

// ─── Test 1: Basic delivery ──────────────────────────────────────────────────

async function test1() {
  header(1, "Basic delivery (plain text + HTML)");
  const subject = `[Test 1] Omari Email Delivery Check — ${TODAY}`;
  const message = [
    "Hello from Omari Branch System,",
    "",
    "This is a basic delivery test sent from the live email service.",
    `Provider: ${process.env.EMAIL_PROVIDER ?? "bulkmailer"}`,
    `From:     ${process.env.BULK_MAILER_FROM ?? process.env.EMAIL_FROM}`,
    `To:       ${TARGET}`,
    `Date:     ${TODAY}`,
    "",
    "If you received this, the delivery pipeline is working.",
    "",
    "— Omari Branch System",
  ].join("\n");

  try {
    const msgId = await sendEmail({
      to: [TARGET],
      subject,
      text: message,
      html: textToHtml(message),
    });
    ok("Email accepted", msgId);
  } catch (e) {
    fail("Email rejected", e);
  }
}

// ─── Test 2: DUE_REMINDER alert ──────────────────────────────────────────────

async function test2() {
  header(2, "DUE_REMINDER alert email");
  const payload: AlertEmailPayload = {
    to: TARGET,
    branchName: "Harare - Main",
    expenseType: "RENT",
    period: "2026-06",
    dueDate: "2026-06-30",
    amount: "$1,500.00",
    alertType: "DUE_REMINDER",
    dayOffset: -7,
  };

  try {
    const result = await sendAlertEmail(payload);
    if (result.success) {
      ok("DUE_REMINDER sent", `subject: "[Reminder] Harare - Main: RENT for 2026-06 due in 7 days"`);
    } else {
      fail("DUE_REMINDER failed", result.error);
    }
  } catch (e) {
    fail("DUE_REMINDER threw", e);
  }
}

// ─── Test 3: OVERDUE_ESCALATION alert ────────────────────────────────────────

async function test3() {
  header(3, "OVERDUE_ESCALATION alert email");
  const payload: AlertEmailPayload = {
    to: TARGET,
    branchName: "Bulawayo - Central",
    expenseType: "ZESA",
    period: "2026-05",
    dueDate: "2026-05-31",
    amount: "$320.00",
    alertType: "OVERDUE_ESCALATION",
    dayOffset: 5,
  };

  try {
    const result = await sendAlertEmail(payload);
    if (result.success) {
      ok("OVERDUE_ESCALATION sent", `subject: "[OVERDUE] Bulawayo - Central: ZESA for 2026-05 is 5 days overdue"`);
    } else {
      fail("OVERDUE_ESCALATION failed", result.error);
    }
  } catch (e) {
    fail("OVERDUE_ESCALATION threw", e);
  }
}

// ─── Test 4: Daily branch report (real data from DB) ─────────────────────────

async function test4() {
  header(4, "Daily branch report email (real DB data)");

  // Find the most recent metric date
  const latestAgg = await prisma.branchMetric.aggregate({ _max: { metricDate: true } });
  const latestDate = latestAgg._max.metricDate;

  if (!latestDate) {
    console.log("  ⚠️  No branch metrics in DB — skipping");
    return;
  }

  const reportDateText = latestDate.toISOString().slice(0, 10);

  const rawMetrics = await prisma.branchMetric.findMany({
    where: { metricDate: latestDate },
    include: { branch: { select: { id: true, city: true, label: true } } },
    orderBy: [{ branch: { city: "asc" } }, { branch: { label: "asc" } }],
  });

  const metrics = rawMetrics.map((m) => ({
    branchId: m.branchId,
    branchName: `${m.branch.city} - ${m.branch.label}`,
    date: reportDateText,
    eFloatBalance: m.eFloatBalance,
    cashInVolume: m.cashInVolume,
    cashInValue: m.cashInValue,
    cashOutVolume: m.cashOutVolume,
    cashOutValue: m.cashOutValue,
    totalTransactionVolume: m.totalTransactionVolume,
    totalTransactionValue: m.totalTransactionValue,
    totalCommission: m.totalCommission,
  }));

  console.log(`  Using report date: ${reportDateText} (${metrics.length} branches)`);

  const subject = `[Test 4] Daily Branch Report — ${reportDateText}`;
  const text = buildBranchReportBody(reportDateText, metrics);
  const html = buildBranchReportHtml(reportDateText, metrics);

  try {
    const msgId = await sendEmail({ to: [TARGET], subject, text, html });
    ok(`Branch report sent (${metrics.length} branches)`, msgId);
  } catch (e) {
    fail("Branch report failed", e);
  }
}

// ─── Test 5: Daily wallet report (real data from DB) ─────────────────────────

async function test5() {
  header(5, "Daily wallet report email (real DB data)");

  const { getWalletDailySummary } = await import("./src/services/wallet.service");
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  const reportDateText = yesterday.toISOString().slice(0, 10);

  let rows: WalletDailySummaryRow[] = [];
  try {
    rows = await getWalletDailySummary(yesterday);
    console.log(`  Using report date: ${reportDateText} (${rows.length} currency rows)`);
  } catch (e) {
    console.log(`  ⚠️  Could not load wallet summary (${e instanceof Error ? e.message : e}) — sending empty-data version`);
  }

  const subject = `[Test 5] Daily Wallet Report — ${reportDateText}`;
  const text = buildWalletReportBody(reportDateText, rows);
  const html = buildWalletReportHtml(reportDateText, rows);

  try {
    const msgId = await sendEmail({ to: [TARGET], subject, text, html });
    ok(`Wallet report sent (${rows.length} currency rows)`, msgId);
  } catch (e) {
    fail("Wallet report failed", e);
  }
}

// ─── Runner ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nOmari Email Live Test`);
  console.log(`Target : ${TARGET}`);
  console.log(`Date   : ${TODAY}`);
  console.log(`Provider: ${process.env.EMAIL_PROVIDER ?? "bulkmailer"}`);

  await test1();
  await test2();
  await test3();
  await test4();
  await test5();

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  All tests complete. Check inbox at ${TARGET}`);
  console.log(`${"─".repeat(60)}\n`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
