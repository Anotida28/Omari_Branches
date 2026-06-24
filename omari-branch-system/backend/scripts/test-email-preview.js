/**
 * Sends a preview of the custom report email using realistic mock data.
 * No database connection required.
 *
 * Usage (from the backend/ directory):
 *   node scripts/test-email-preview.js your@email.com
 */

"use strict";

const path = require("path");

// Load .env before anything else
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const TO_EMAIL = process.argv[2] || "n02311860m@students.nust.ac.zw";

const { buildCustomReportHtml, buildCustomReportText } =
  require("../dist/services/custom-report-email.service");
const { sendEmail } = require("../dist/services/email.service");

// ── Mock data ────────────────────────────────────────────────────────────────

const REPORT_DATE = "Monday, 23 June 2025";

/** @type {import("../dist/services/custom-report-types").SectionData[]} */
const mockSections = [
  {
    type: "BRANCH_PERFORMANCE",
    date: REPORT_DATE,
    params: { showCashIn: true, showCashOut: true, showEFloat: true, showCommission: true },
    rows: [
      { branchName: "Harare CBD",      cashInVolume: 142, cashInValue: 28450.0,  cashOutVolume: 98, cashOutValue: 19200.0,  totalTransactionVolume: 240, eFloatBalance: 52000.0, totalCommission: 341.4  },
      { branchName: "Bulawayo Main",   cashInVolume: 87,  cashInValue: 17320.5,  cashOutVolume: 61, cashOutValue: 12100.75, totalTransactionVolume: 148, eFloatBalance: 31500.0, totalCommission: 207.85 },
      { branchName: "Mutare Gateway",  cashInVolume: 55,  cashInValue: 9850.0,   cashOutVolume: 34, cashOutValue: 6400.0,   totalTransactionVolume: 89,  eFloatBalance: 3200.0,  totalCommission: 118.2  },
      { branchName: "Gweru Centre",    cashInVolume: 31,  cashInValue: 5200.0,   cashOutVolume: 22, cashOutValue: 3900.0,   totalTransactionVolume: 53,  eFloatBalance: 1800.0,  totalCommission: 62.4   },
    ],
  },
  {
    type: "TOP_PERFORMERS",
    date: REPORT_DATE,
    params: { metric: "cashIn", limit: 3, order: "desc" },
    rows: [
      { rank: 1, branchName: "Harare CBD",     value: 28450.0 },
      { rank: 2, branchName: "Bulawayo Main",  value: 17320.5 },
      { rank: 3, branchName: "Mutare Gateway", value: 9850.0  },
    ],
  },
  {
    type: "FLOAT_POSITION",
    date: REPORT_DATE,
    params: { threshold: 5000, order: "asc" },
    threshold: 5000,
    rows: [
      { branchName: "Gweru Centre",    eFloatBalance: 1800.0,  status: "low"  },
      { branchName: "Mutare Gateway",  eFloatBalance: 3200.0,  status: "low"  },
      { branchName: "Bulawayo Main",   eFloatBalance: 31500.0, status: "good" },
      { branchName: "Harare CBD",      eFloatBalance: 52000.0, status: "good" },
    ],
  },
  {
    type: "TRANSACTION_TRENDS",
    date: REPORT_DATE,
    params: { metric: "cashIn" },
    rows: [
      { branchName: "Harare CBD",      yesterday: 28450.0, avg7d: 22100.0, changePercent: 28.7  },
      { branchName: "Bulawayo Main",   yesterday: 17320.5, avg7d: 19500.0, changePercent: -11.2 },
      { branchName: "Mutare Gateway",  yesterday: 9850.0,  avg7d: 9200.0,  changePercent: 7.1   },
      { branchName: "Gweru Centre",    yesterday: 5200.0,  avg7d: 6800.0,  changePercent: -23.5 },
    ],
  },
  {
    type: "REVENUE_BREAKDOWN",
    date: REPORT_DATE,
    totalDeposits: 479.45,
    totalWithdrawals: 250.4,
    grandTotal: 729.85,
    rows: [
      { branchName: "Harare CBD",     commissionOnDeposits: 228.6,  commissionOnWithdrawals: 112.8, totalCommission: 341.4  },
      { branchName: "Bulawayo Main",  commissionOnDeposits: 138.5,  commissionOnWithdrawals: 69.35, totalCommission: 207.85 },
      { branchName: "Mutare Gateway", commissionOnDeposits: 78.8,   commissionOnWithdrawals: 39.4,  totalCommission: 118.2  },
      { branchName: "Gweru Centre",   commissionOnDeposits: 33.55,  commissionOnWithdrawals: 28.85, totalCommission: 62.4   },
    ],
  },
  {
    type: "WEEK_SNAPSHOT",
    params: { metric: "cashIn" },
    days: [
      { date: "Mon 16 Jun 2025", dayLabel: "Mon", value: 48200.0,  volume: 412 },
      { date: "Tue 17 Jun 2025", dayLabel: "Tue", value: 51340.0,  volume: 438 },
      { date: "Wed 18 Jun 2025", dayLabel: "Wed", value: 44120.0,  volume: 381 },
      { date: "Thu 19 Jun 2025", dayLabel: "Thu", value: 55870.0,  volume: 471 },
      { date: "Fri 20 Jun 2025", dayLabel: "Fri", value: 62450.0,  volume: 529 },
      { date: "Sat 21 Jun 2025", dayLabel: "Sat", value: 38900.0,  volume: 318 },
      { date: "Sun 22 Jun 2025", dayLabel: "Sun", value: 60820.0,  volume: 530 },
    ],
    grandValue: 361700.0,
    grandVolume: 3079,
  },
  {
    type: "UPCOMING_PAYMENTS",
    asOfDate: REPORT_DATE,
    params: { daysAhead: 14 },
    payments: [
      { branchName: "Gweru Centre",   expenseType: "Electricity", dueDate: "25 Jun 2025", amount: 420.0,  currency: "USD", daysUntilDue: 2  },
      { branchName: "Harare CBD",     expenseType: "Rent",        dueDate: "30 Jun 2025", amount: 1800.0, currency: "USD", daysUntilDue: 7  },
      { branchName: "Bulawayo Main",  expenseType: "Security",    dueDate: "30 Jun 2025", amount: 550.0,  currency: "USD", daysUntilDue: 7  },
      { branchName: "Mutare Gateway", expenseType: "Internet",    dueDate: "05 Jul 2025", amount: 180.0,  currency: "USD", daysUntilDue: 12 },
    ],
  },
  {
    type: "OVERDUE_SUMMARY",
    asOfDate: REPORT_DATE,
    totalAmount: 960.0,
    payments: [
      { branchName: "Mutare Gateway", expenseType: "Water",    dueDate: "10 Jun 2025", amount: 210.0, currency: "USD", daysOverdue: 13 },
      { branchName: "Gweru Centre",   expenseType: "Internet", dueDate: "15 Jun 2025", amount: 750.0, currency: "USD", daysOverdue: 8  },
    ],
  },
  {
    type: "ALERTS_SUMMARY",
    params: { limit: 10 },
    alerts: [
      { branchName: "Harare CBD",    expenseType: "Electricity", dueDate: "30 Jun 2025", dayOffset: -2, sentAt: new Date().toISOString() },
      { branchName: "Bulawayo Main", expenseType: "Rent",        dueDate: "25 Jun 2025", dayOffset:  2, sentAt: new Date().toISOString() },
      { branchName: "Gweru Centre",  expenseType: "Security",    dueDate: "20 Jun 2025", dayOffset: -3, sentAt: new Date().toISOString() },
    ],
  },
  {
    type: "WALLET_SUMMARY",
    asOfDate: REPORT_DATE,
    totalCustomers: 2241880,
    activeIn30Days: 1048432,
    newIn30Days: 12045,
    dormantOver90Days: 387210,
    totalLifetimeValue: 4318672.45,
    activityIn30Days: 892340.0,
  },
  {
    type: "WALLET_RETENTION",
    asOfDate: REPORT_DATE,
    totalCustomers: 2241880,
    active30: 1048432,
    inactive30to60: 403188,
    inactive60to90: 403050,
    dormant90plus: 387210,
  },
  {
    type: "NEW_CUSTOMERS",
    date: REPORT_DATE,
    newYesterday: 284,
    avg7d: 231,
    totalThisMonth: 4812,
  },
  {
    type: "TOP_WALLET_CUSTOMERS",
    asOfDate: REPORT_DATE,
    params: { metric: "last30d", limit: 5 },
    rows: [
      { rank: 1, fullName: "T. Moyo",      mobileNumber: "+263 77 123 4567", value: 18420.0,  lifetimeVolume: 342 },
      { rank: 2, fullName: "S. Ncube",     mobileNumber: "+263 71 234 5678", value: 14350.0,  lifetimeVolume: 287 },
      { rank: 3, fullName: "P. Chiweshe",  mobileNumber: "+263 78 345 6789", value: 11200.0,  lifetimeVolume: 219 },
      { rank: 4, fullName: "R. Dube",      mobileNumber: "+263 73 456 7890", value: 9870.0,   lifetimeVolume: 198 },
      { rank: 5, fullName: "M. Mlambo",    mobileNumber: "+263 77 567 8901", value: 8340.0,   lifetimeVolume: 176 },
    ],
  },
];

// ── Send ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Building email preview for: ${TO_EMAIL}`);

  const html = buildCustomReportHtml("om526127", mockSections, `${REPORT_DATE} (Preview)`);
  const text = buildCustomReportText(mockSections, REPORT_DATE);

  await sendEmail({
    to: [TO_EMAIL],
    subject: `[PREVIEW] Your Daily Report — ${REPORT_DATE}`,
    html,
    text,
  });

  console.log(`Email sent to ${TO_EMAIL}`);
}

main().catch((err) => {
  console.error("Failed to send preview email:", err.message);
  process.exit(1);
});
