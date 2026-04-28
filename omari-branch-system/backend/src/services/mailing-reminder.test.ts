/**
 * Mailing & Reminder Service Tests
 *
 * Covers pure functions across:
 *   - email.service (subject/body formatting)
 *   - recurring-reminders.service (date math, state)
 *   - daily-branch-report.job (report body, status line)
 *   - wallet-report.job (money formatting, report body)
 *
 * Run with: npx ts-node src/services/mailing-reminder.test.ts
 */

import { Prisma } from "@prisma/client";

import { formatBody, formatSubject, type AlertEmailPayload } from "./email.service";
import {
  dueDateForMonth,
  getNextDueDate,
  getReminderStateForDueDate,
  periodForDate,
} from "./recurring-reminders.service";
import {
  buildBranchReportBody,
  buildStatusLine,
  type BranchReportMetric,
} from "../jobs/daily-branch-report.job";
import { buildWalletReportBody, money } from "../jobs/wallet-report.job";
import type { WalletDailySummaryRow } from "./wallet.service";

// ============================================================================
// Test Utilities
// ============================================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   ${(error as Error).message}`);
    failed++;
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `${message ? message + ": " : ""}Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertContains(actual: string, substring: string, message?: string) {
  if (!actual.includes(substring)) {
    throw new Error(
      `${message ? message + ": " : ""}Expected string to contain "${substring}", but got:\n${actual}`,
    );
  }
}

function assertNotContains(actual: string, substring: string, message?: string) {
  if (actual.includes(substring)) {
    throw new Error(
      `${message ? message + ": " : ""}Expected string NOT to contain "${substring}"`,
    );
  }
}

// ============================================================================
// Factories
// ============================================================================

function makeAlertPayload(overrides: Partial<AlertEmailPayload> = {}): AlertEmailPayload {
  return {
    to: "test@example.com",
    branchName: "Harare - Main",
    expenseType: "RENT",
    period: "2026-04",
    dueDate: "2026-04-30",
    amount: "$1,000.00",
    alertType: "DUE_REMINDER",
    dayOffset: -7,
    ...overrides,
  };
}

function makeBranchMetric(overrides: Partial<BranchReportMetric> = {}): BranchReportMetric {
  return {
    branchId: BigInt(1),
    branchName: "Harare - Main",
    date: "2026-04-27",
    eFloatBalance: new Prisma.Decimal(5000),
    cashInVolume: 20,
    cashInValue: new Prisma.Decimal(10000),
    cashOutVolume: 15,
    cashOutValue: new Prisma.Decimal(8000),
    totalTransactionVolume: 35,
    totalTransactionValue: new Prisma.Decimal(18000),
    totalCommission: new Prisma.Decimal(180),
    ...overrides,
  };
}

function makeWalletRow(overrides: Partial<WalletDailySummaryRow> = {}): WalletDailySummaryRow {
  return {
    currency: "USD",
    totalVolume: 500,
    totalValue: 25000,
    totalCommission: 250,
    activeAccounts: 120,
    ...overrides,
  };
}

// ============================================================================
// email.service — formatSubject
// ============================================================================

console.log("\n=== email.service: formatSubject ===\n");

test("DUE_REMINDER subject shows days until due", () => {
  const subject = formatSubject(makeAlertPayload({ alertType: "DUE_REMINDER", dayOffset: -7 }));
  assertContains(subject, "[Reminder]");
  assertContains(subject, "Harare - Main");
  assertContains(subject, "RENT");
  assertContains(subject, "2026-04");
  assertContains(subject, "7 days");
});

test("DUE_REMINDER subject uses singular 'day' for 1", () => {
  const subject = formatSubject(makeAlertPayload({ alertType: "DUE_REMINDER", dayOffset: -1 }));
  assertContains(subject, "1 day");
  assertNotContains(subject, "1 days");
});

test("OVERDUE_ESCALATION subject shows [OVERDUE] prefix", () => {
  const subject = formatSubject(
    makeAlertPayload({ alertType: "OVERDUE_ESCALATION", dayOffset: 3 }),
  );
  assertContains(subject, "[OVERDUE]");
  assertContains(subject, "3 day");
  assertContains(subject, "overdue");
});

test("OVERDUE_ESCALATION subject uses singular 'day' for 1", () => {
  const subject = formatSubject(
    makeAlertPayload({ alertType: "OVERDUE_ESCALATION", dayOffset: 1 }),
  );
  assertContains(subject, "1 day");
  assertNotContains(subject, "1 days");
});

// ============================================================================
// email.service — formatBody
// ============================================================================

console.log("\n=== email.service: formatBody ===\n");

test("DUE_REMINDER body contains all key fields", () => {
  const body = formatBody(makeAlertPayload());
  assertContains(body, "Harare - Main");
  assertContains(body, "RENT");
  assertContains(body, "2026-04");
  assertContains(body, "2026-04-30");
  assertContains(body, "$1,000.00");
  assertContains(body, "Please review this expense before the due date.");
});

test("OVERDUE_ESCALATION body contains overdue message", () => {
  const body = formatBody(
    makeAlertPayload({ alertType: "OVERDUE_ESCALATION", dayOffset: 3 }),
  );
  assertContains(body, "ATTENTION");
  assertContains(body, "overdue");
  assertContains(body, "3 day(s) overdue");
});

test("body contains Omari attribution footer", () => {
  const body = formatBody(makeAlertPayload());
  assertContains(body, "Omari Branch System");
});

// ============================================================================
// recurring-reminders.service — dueDateForMonth
// ============================================================================

console.log("\n=== recurring-reminders.service: dueDateForMonth ===\n");

test("dueDateForMonth returns correct date for normal day", () => {
  const date = dueDateForMonth(2026, 3, 15); // April 2026 (monthIndex=3)
  assertEqual(date.toISOString().slice(0, 10), "2026-04-15");
});

test("dueDateForMonth clamps to last day of February (non-leap)", () => {
  const date = dueDateForMonth(2026, 1, 31); // Feb 2026
  assertEqual(date.toISOString().slice(0, 10), "2026-02-28");
});

test("dueDateForMonth clamps to last day of February (leap year)", () => {
  const date = dueDateForMonth(2024, 1, 31); // Feb 2024 (leap)
  assertEqual(date.toISOString().slice(0, 10), "2024-02-29");
});

test("dueDateForMonth clamps to last day of April (30 days)", () => {
  const date = dueDateForMonth(2026, 3, 31); // April only has 30 days
  assertEqual(date.toISOString().slice(0, 10), "2026-04-30");
});

test("dueDateForMonth handles day 1 correctly", () => {
  const date = dueDateForMonth(2026, 0, 1); // Jan 1
  assertEqual(date.toISOString().slice(0, 10), "2026-01-01");
});

// ============================================================================
// recurring-reminders.service — periodForDate
// ============================================================================

console.log("\n=== recurring-reminders.service: periodForDate ===\n");

test("periodForDate formats YYYY-MM correctly", () => {
  const date = new Date(Date.UTC(2026, 3, 15)); // April 2026
  assertEqual(periodForDate(date), "2026-04");
});

test("periodForDate pads single-digit month", () => {
  const date = new Date(Date.UTC(2026, 0, 1)); // January 2026
  assertEqual(periodForDate(date), "2026-01");
});

test("periodForDate handles December", () => {
  const date = new Date(Date.UTC(2026, 11, 31)); // December 2026
  assertEqual(periodForDate(date), "2026-12");
});

// ============================================================================
// recurring-reminders.service — getNextDueDate
// ============================================================================

console.log("\n=== recurring-reminders.service: getNextDueDate ===\n");

test("getNextDueDate returns this month's due date when not yet passed", () => {
  const today = new Date(Date.UTC(2026, 3, 10)); // April 10
  const due = getNextDueDate(20, today); // due on 20th
  assertEqual(due.toISOString().slice(0, 10), "2026-04-20");
});

test("getNextDueDate returns this month when due date is today", () => {
  const today = new Date(Date.UTC(2026, 3, 20)); // April 20
  const due = getNextDueDate(20, today);
  assertEqual(due.toISOString().slice(0, 10), "2026-04-20");
});

test("getNextDueDate returns next month when due date has passed", () => {
  const today = new Date(Date.UTC(2026, 3, 21)); // April 21 — past the 20th
  const due = getNextDueDate(20, today);
  assertEqual(due.toISOString().slice(0, 10), "2026-05-20");
});

test("getNextDueDate clamps to last day of next month (Feb)", () => {
  const today = new Date(Date.UTC(2026, 0, 31)); // Jan 31 — past the 30th
  const due = getNextDueDate(30, today); // due on 30th, next month = Feb = 28 days
  assertEqual(due.toISOString().slice(0, 10), "2026-02-28");
});

// ============================================================================
// recurring-reminders.service — getReminderStateForDueDate
// ============================================================================

console.log("\n=== recurring-reminders.service: getReminderStateForDueDate ===\n");

test("getReminderStateForDueDate returns UPCOMING when days remain", () => {
  const today = new Date(Date.UTC(2026, 3, 20));
  const dueDate = new Date(Date.UTC(2026, 3, 27));
  const { state, daysToDue } = getReminderStateForDueDate(dueDate, today);
  assertEqual(state, "UPCOMING");
  assertEqual(daysToDue, 7);
});

test("getReminderStateForDueDate returns DUE_TODAY when daysToDue is 0", () => {
  const today = new Date(Date.UTC(2026, 3, 20));
  const { state, daysToDue } = getReminderStateForDueDate(today, today);
  assertEqual(state, "DUE_TODAY");
  assertEqual(daysToDue, 0);
});

test("getReminderStateForDueDate returns OVERDUE when past due", () => {
  const today = new Date(Date.UTC(2026, 3, 25));
  const dueDate = new Date(Date.UTC(2026, 3, 20));
  const { state, daysToDue } = getReminderStateForDueDate(dueDate, today);
  assertEqual(state, "OVERDUE");
  assertEqual(daysToDue, -5);
});

// ============================================================================
// daily-branch-report.job — buildStatusLine
// ============================================================================

console.log("\n=== daily-branch-report.job: buildStatusLine ===\n");

test("buildStatusLine: cash out exceeded cash in", () => {
  const metric = makeBranchMetric({
    cashInValue: new Prisma.Decimal(5000),
    cashOutValue: new Prisma.Decimal(8000),
  });
  assertEqual(buildStatusLine(metric), "Cash out exceeded cash in for the day.");
});

test("buildStatusLine: low e-float warning", () => {
  const metric = makeBranchMetric({
    cashInValue: new Prisma.Decimal(5000),
    cashOutValue: new Prisma.Decimal(2000),
    eFloatBalance: new Prisma.Decimal(499),
  });
  assertEqual(buildStatusLine(metric), "E-float balance is low.");
});

test("buildStatusLine: no transactions recorded", () => {
  const metric = makeBranchMetric({
    cashInValue: new Prisma.Decimal(0),
    cashOutValue: new Prisma.Decimal(0),
    eFloatBalance: new Prisma.Decimal(5000),
    totalTransactionVolume: 0,
  });
  assertEqual(buildStatusLine(metric), "No transactions were recorded for the day.");
});

test("buildStatusLine: normal activity", () => {
  const metric = makeBranchMetric(); // default: healthy values
  assertEqual(buildStatusLine(metric), "Branch activity is within normal daily range.");
});

// ============================================================================
// daily-branch-report.job — buildBranchReportBody
// ============================================================================

console.log("\n=== daily-branch-report.job: buildBranchReportBody ===\n");

test("buildBranchReportBody: empty metrics returns no-data message", () => {
  const body = buildBranchReportBody("2026-04-27", []);
  assertContains(body, "No branch metrics were recorded");
  assertContains(body, "2026-04-27");
});

test("buildBranchReportBody: single branch contains all fields", () => {
  const body = buildBranchReportBody("2026-04-27", [makeBranchMetric()]);
  assertContains(body, "Harare - Main");
  assertContains(body, "Cash In:");
  assertContains(body, "Cash Out:");
  assertContains(body, "E-Float Balance:");
  assertContains(body, "Total Commission:");
  assertContains(body, "Daily Branch Performance Snapshot");
  assertContains(body, "Omari Branch System");
});

test("buildBranchReportBody: multiple branches are separated", () => {
  const body = buildBranchReportBody("2026-04-27", [
    makeBranchMetric({ branchName: "Harare - Main" }),
    makeBranchMetric({ branchId: BigInt(2), branchName: "Masvingo - Central" }),
  ]);
  assertContains(body, "Harare - Main");
  assertContains(body, "Masvingo - Central");
});

test("buildBranchReportBody: report date is in header", () => {
  const body = buildBranchReportBody("2026-04-27", [makeBranchMetric()]);
  assertContains(body, "Date: 2026-04-27");
});

// ============================================================================
// wallet-report.job — money
// ============================================================================

console.log("\n=== wallet-report.job: money ===\n");

test("money formats USD with $ prefix", () => {
  assertEqual(money(1234.56, "USD"), "$1,234.56");
});

test("money formats ZWL with currency code prefix", () => {
  assertEqual(money(1234.56, "ZWL"), "ZWL 1,234.56");
});

test("money formats zero correctly", () => {
  assertEqual(money(0, "USD"), "$0.00");
});

test("money formats large numbers with comma separators", () => {
  assertEqual(money(1000000, "USD"), "$1,000,000.00");
});

test("money always shows 2 decimal places", () => {
  assertEqual(money(5, "USD"), "$5.00");
  assertEqual(money(5.1, "USD"), "$5.10");
});

// ============================================================================
// wallet-report.job — buildWalletReportBody
// ============================================================================

console.log("\n=== wallet-report.job: buildWalletReportBody ===\n");

test("buildWalletReportBody: empty rows returns no-data message", () => {
  const body = buildWalletReportBody("2026-04-27", []);
  assertContains(body, "No wallet transaction data was recorded");
  assertContains(body, "2026-04-27");
  assertContains(body, "Omari Wallet System");
});

test("buildWalletReportBody: USD row shows all fields", () => {
  const body = buildWalletReportBody("2026-04-27", [makeWalletRow()]);
  assertContains(body, "USD Wallet");
  assertContains(body, "500");       // totalVolume
  assertContains(body, "$25,000.00"); // totalValue
  assertContains(body, "$250.00");    // totalCommission
  assertContains(body, "120");        // activeAccounts
});

test("buildWalletReportBody: ZWL row uses currency code prefix", () => {
  const body = buildWalletReportBody("2026-04-27", [
    makeWalletRow({ currency: "ZWL", totalValue: 50000, totalCommission: 500 }),
  ]);
  assertContains(body, "ZWL Wallet");
  assertContains(body, "ZWL 50,000.00");
});

test("buildWalletReportBody: zero-transaction row shows no-data message per currency", () => {
  const body = buildWalletReportBody("2026-04-27", [
    makeWalletRow({ totalVolume: 0, totalValue: 0, totalCommission: 0 }),
  ]);
  assertContains(body, "No transactions recorded.");
});

test("buildWalletReportBody: multi-currency rows both appear", () => {
  const body = buildWalletReportBody("2026-04-27", [
    makeWalletRow({ currency: "USD" }),
    makeWalletRow({ currency: "ZWL", totalValue: 5000, totalCommission: 50 }),
  ]);
  assertContains(body, "USD Wallet");
  assertContains(body, "ZWL Wallet");
});

test("buildWalletReportBody: report date in header", () => {
  const body = buildWalletReportBody("2026-04-27", [makeWalletRow()]);
  assertContains(body, "Date: 2026-04-27");
});

test("buildWalletReportBody: contains Omari footer", () => {
  const body = buildWalletReportBody("2026-04-27", [makeWalletRow()]);
  assertContains(body, "Omari Wallet System - Automated Daily Report");
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

if (failed > 0) {
  process.exit(1);
}
