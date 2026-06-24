import type {
  SectionData,
  BranchPerformanceSectionData,
  TopPerformersSectionData,
  WalletSummarySectionData,
  WalletRetentionSectionData,
  AlertsSummarySectionData,
  FloatPositionSectionData,
  TransactionTrendsSectionData,
  NewCustomersSectionData,
  TopWalletCustomersSectionData,
  RevenueBreakdownSectionData,
  UpcomingPaymentsSectionData,
  OverdueSummarySectionData,
  WeekSnapshotSectionData,
  BranchPerformanceParams,
} from "./custom-report-types";

const BRAND = "#1e3a5f";

function money(value: number): string {
  return `$${value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

function pct(part: number, total: number): string {
  if (total === 0) return "—";
  return `${((part / total) * 100).toFixed(1)}%`;
}

function th(label: string, right = false): string {
  return `<th style="padding:9px 12px;color:#fff;font-size:12px;font-weight:600;background:${BRAND};${right ? "text-align:right" : "text-align:left"}">${label}</th>`;
}

function td(content: string, right = false, bold = false): string {
  return `<td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:13px;${right ? "text-align:right;" : ""}${bold ? "font-weight:600;" : ""}">${content}</td>`;
}

function sectionWrapper(title: string, subtitle: string, body: string): string {
  return `
<div style="margin-bottom:28px">
  <div style="background:${BRAND};padding:12px 20px;border-radius:6px 6px 0 0">
    <div style="font-size:15px;font-weight:700;color:#fff">${title}</div>
    <div style="font-size:12px;color:#93c5fd;margin-top:2px">${subtitle}</div>
  </div>
  <div style="border:1px solid #e5e9f0;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">
    ${body}
  </div>
</div>`;
}

function noDataRow(cols: number, msg = "No data available."): string {
  return `<tr><td colspan="${cols}" style="padding:24px;text-align:center;color:#6b7280;font-size:13px">${msg}</td></tr>`;
}

// ─── Original 5 renderers ─────────────────────────────────────────────────────

function renderBranchPerformance(data: BranchPerformanceSectionData): string {
  const p = data.params as BranchPerformanceParams;
  const showCashIn     = p.showCashIn     !== false;
  const showCashOut    = p.showCashOut    !== false;
  const showEFloat     = p.showEFloat     !== false;
  const showCommission = p.showCommission !== false;

  const headers = [
    th("Branch"),
    showCashIn     ? th("Cash In",    true) : "",
    showCashOut    ? th("Cash Out",   true) : "",
    showCashIn && showCashOut ? th("Net Cash", true) : "",
    th("Txns", true),
    showEFloat     ? th("E-Float",    true) : "",
    showCommission ? th("Commission", true) : "",
  ].join("");

  const rows = data.rows.map((row, i) => {
    const net = row.cashInValue - row.cashOutValue;
    const bg  = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>${row.branchName}</strong>`)}
      ${showCashIn  ? td(`${row.cashInVolume} txns<br/>${money(row.cashInValue)}`,   true) : ""}
      ${showCashOut ? td(`${row.cashOutVolume} txns<br/>${money(row.cashOutValue)}`, true) : ""}
      ${showCashIn && showCashOut ? td(money(net), true) : ""}
      ${td(row.totalTransactionVolume.toLocaleString(), true)}
      ${showEFloat     ? td(money(row.eFloatBalance),   true) : ""}
      ${showCommission ? td(money(row.totalCommission), true) : ""}
    </tr>`;
  }).join("");

  const table = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows || noDataRow(8, "No branch metrics for this date.")}</tbody>
  </table></div>`;

  return sectionWrapper("Branch Performance", `Date: ${data.date} · ${data.rows.length} branch(es)`, table);
}

function renderTopPerformers(data: TopPerformersSectionData): string {
  const metricLabel: Record<string, string> = {
    cashIn: "Cash In", cashOut: "Cash Out", eFloat: "E-Float Balance", commission: "Commission",
  };
  const metric     = data.params.metric ?? "cashIn";
  const label      = metricLabel[metric] ?? metric;
  const orderLabel = (data.params.order ?? "desc") === "desc" ? "Top" : "Bottom";

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>#${row.rank}</strong>`, false, true)}
      ${td(row.branchName)}
      ${td(money(row.value), true, true)}
    </tr>`;
  }).join("");

  const table = `<table style="width:100%;border-collapse:collapse">
    <thead><tr>${th("Rank")}${th("Branch")}${th(label, true)}</tr></thead>
    <tbody>${rows || noDataRow(3, "No branch metrics for this date.")}</tbody>
  </table>`;

  return sectionWrapper(
    `${orderLabel} ${data.rows.length} Branches — ${label}`,
    `Date: ${data.date}`,
    table,
  );
}

function renderWalletSummary(data: WalletSummarySectionData): string {
  const stats = [
    ["Total Customers",         data.totalCustomers.toLocaleString()],
    ["Active (Last 30 Days)",   `${data.activeIn30Days.toLocaleString()} (${pct(data.activeIn30Days, data.totalCustomers)})`],
    ["New (Last 30 Days)",      data.newIn30Days.toLocaleString()],
    ["Dormant (90+ Days)",      `${data.dormantOver90Days.toLocaleString()} (${pct(data.dormantOver90Days, data.totalCustomers)})`],
    ["Total Lifetime Value",    money(data.totalLifetimeValue)],
    ["30-Day Activity Value",   money(data.activityIn30Days)],
  ];

  const rows = stats.map(([label, val], i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      <td style="padding:10px 16px;font-size:13px;color:#374151">${label}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right">${val}</td>
    </tr>`;
  }).join("");

  return sectionWrapper("Wallet Customer Summary", `As of ${data.asOfDate}`,
    `<table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>`);
}

function renderWalletRetention(data: WalletRetentionSectionData): string {
  const bands = [
    { label: "Active (0–30 days)",     count: data.active30,        color: "#16a34a" },
    { label: "Inactive (30–60 days)",  count: data.inactive30to60,  color: "#ca8a04" },
    { label: "Inactive (60–90 days)",  count: data.inactive60to90,  color: "#ea580c" },
    { label: "Dormant (90+ days)",     count: data.dormant90plus,   color: "#dc2626" },
  ];

  const rows = bands.map(({ label, count, color }, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      <td style="padding:10px 16px;font-size:13px"><span style="color:${color};font-weight:600">●</span> ${label}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right">${count.toLocaleString()}</td>
      <td style="padding:10px 16px;font-size:13px;text-align:right;color:#6b7280">${pct(count, data.totalCustomers)}</td>
    </tr>`;
  }).join("");

  const table = `<table style="width:100%;border-collapse:collapse">
    <thead><tr>${th("Activity Band")}${th("Customers", true)}${th("% of Total", true)}</tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="background:#eef2f8">
      ${td("TOTAL", false, true)}${td(data.totalCustomers.toLocaleString(), true, true)}${td("100%", true, true)}
    </tr></tfoot>
  </table>`;

  return sectionWrapper(
    "Wallet Retention & Dormancy",
    `As of ${data.asOfDate} · ${data.totalCustomers.toLocaleString()} customers`,
    table,
  );
}

function renderAlertsSummary(data: AlertsSummarySectionData): string {
  if (data.alerts.length === 0) {
    return sectionWrapper("Recent Alerts", "Last 7 days",
      `<div style="padding:24px;text-align:center;color:#6b7280;font-size:13px">No alerts in the last 7 days.</div>`);
  }

  const rows = data.alerts.map((alert, i) => {
    const bg      = i % 2 === 0 ? "#fff" : "#f8fafc";
    const dayText = alert.dayOffset < 0 ? `${Math.abs(alert.dayOffset)}d overdue` : `${alert.dayOffset}d early`;
    const color   = alert.dayOffset < 0 ? "#dc2626" : "#ca8a04";
    return `<tr style="background:${bg}">
      ${td(alert.branchName)}${td(alert.expenseType)}${td(alert.dueDate, true)}
      ${td(`<span style="color:${color};font-weight:600">${dayText}</span>`, true)}
    </tr>`;
  }).join("");

  return sectionWrapper("Recent Alerts", `Last 7 days · ${data.alerts.length} alert(s)`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Branch")}${th("Type")}${th("Due Date", true)}${th("Status", true)}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

// ─── New 8 renderers ──────────────────────────────────────────────────────────

function renderFloatPosition(data: FloatPositionSectionData): string {
  const statusStyle = (s: "low" | "ok" | "good") => {
    if (s === "low")  return `background:#fee2e2;color:#dc2626;font-weight:700;`;
    if (s === "ok")   return `background:#fef9c3;color:#ca8a04;font-weight:700;`;
    return `background:#dcfce7;color:#16a34a;font-weight:700;`;
  };

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>${row.branchName}</strong>`)}
      ${td(money(row.eFloatBalance), true, true)}
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;text-align:center">
        <span style="padding:2px 10px;border-radius:12px;font-size:12px;${statusStyle(row.status)}">${row.status.toUpperCase()}</span>
      </td>
    </tr>`;
  }).join("");

  const low = data.rows.filter((r) => r.status === "low").length;
  const subtitle = `Date: ${data.date} · Threshold: ${money(data.threshold)}${low > 0 ? ` · ⚠ ${low} branch(es) low` : ""}`;

  return sectionWrapper("E-Float Position", subtitle,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Branch")}${th("E-Float Balance", true)}${th("Status")}</tr></thead>
      <tbody>${rows || noDataRow(3, "No float data for this date.")}</tbody>
    </table>`);
}

function renderTransactionTrends(data: TransactionTrendsSectionData): string {
  const metricLabel: Record<string, string> = {
    cashIn: "Cash In ($)", cashOut: "Cash Out ($)", volume: "Txn Volume",
  };
  const label = metricLabel[data.params.metric ?? "cashIn"] ?? "Cash In";
  const isMoney = (data.params.metric ?? "cashIn") !== "volume";

  const rows = data.rows.map((row, i) => {
    const bg    = i % 2 === 0 ? "#fff" : "#f8fafc";
    const up    = row.changePercent >= 0;
    const arrow = up ? "▲" : "▼";
    const color = up ? "#16a34a" : "#dc2626";
    const fmt   = (v: number) => isMoney ? money(v) : v.toLocaleString();
    return `<tr style="background:${bg}">
      ${td(`<strong>${row.branchName}</strong>`)}
      ${td(fmt(row.yesterday), true, true)}
      ${td(fmt(row.avg7d), true)}
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;text-align:right;font-weight:600;color:${color}">
        ${arrow} ${Math.abs(row.changePercent).toFixed(1)}%
      </td>
    </tr>`;
  }).join("");

  return sectionWrapper("Transaction Trends", `Yesterday vs 7-day average · ${label}`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Branch")}${th("Yesterday", true)}${th("7-Day Avg", true)}${th("Change", true)}</tr></thead>
      <tbody>${rows || noDataRow(4, "No trend data available.")}</tbody>
    </table>`);
}

function renderNewCustomers(data: NewCustomersSectionData): string {
  const stats = [
    ["New Yesterday",       data.newYesterday.toLocaleString()],
    ["Daily Average (7d)",  data.avg7d.toLocaleString()],
    ["Total This Month",    data.totalThisMonth.toLocaleString()],
  ];

  const rows = stats.map(([label, val], i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      <td style="padding:10px 16px;font-size:13px;color:#374151">${label}</td>
      <td style="padding:10px 16px;font-size:14px;font-weight:700;text-align:right;color:${BRAND}">${val}</td>
    </tr>`;
  }).join("");

  return sectionWrapper("New Wallet Customers", `As of ${data.date}`,
    `<table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>`);
}

function renderTopWalletCustomers(data: TopWalletCustomersSectionData): string {
  const metricLabel = data.params.metric === "lifetime" ? "Lifetime Value" : "30-Day Value";

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>#${row.rank}</strong>`, false, true)}
      ${td(row.fullName)}
      ${td(row.mobileNumber)}
      ${td(money(row.value), true, true)}
      ${td(row.lifetimeVolume.toLocaleString(), true)}
    </tr>`;
  }).join("");

  return sectionWrapper(`Top ${data.rows.length} Wallet Customers`, `As of ${data.asOfDate} · by ${metricLabel}`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Rank")}${th("Name")}${th("Mobile")}${th(metricLabel, true)}${th("Total Txns", true)}</tr></thead>
      <tbody>${rows || noDataRow(5, "No customer data available.")}</tbody>
    </table>`);
}

function renderRevenueBreakdown(data: RevenueBreakdownSectionData): string {
  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>${row.branchName}</strong>`)}
      ${td(money(row.commissionOnDeposits),   true)}
      ${td(money(row.commissionOnWithdrawals), true)}
      ${td(money(row.totalCommission),         true, true)}
    </tr>`;
  }).join("");

  const footer = `<tr style="background:#eef2f8">
    ${td("<strong>TOTAL</strong>")}
    ${td(money(data.totalDeposits),    true, true)}
    ${td(money(data.totalWithdrawals), true, true)}
    ${td(money(data.grandTotal),       true, true)}
  </tr>`;

  return sectionWrapper("Revenue Breakdown", `Date: ${data.date} · Commission by type`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Branch")}${th("Deposit Comm.", true)}${th("Withdrawal Comm.", true)}${th("Total", true)}</tr></thead>
      <tbody>${rows || noDataRow(4, "No revenue data for this date.")}</tbody>
      <tfoot>${footer}</tfoot>
    </table>`);
}

function renderUpcomingPayments(data: UpcomingPaymentsSectionData): string {
  const daysAhead = data.params.daysAhead ?? 14;

  const rows = data.payments.map((p, i) => {
    const bg    = i % 2 === 0 ? "#fff" : "#f8fafc";
    const urgent = p.daysUntilDue <= 3;
    const color  = urgent ? "#dc2626" : "#374151";
    return `<tr style="background:${bg}">
      ${td(`<strong>${p.branchName}</strong>`)}
      ${td(p.expenseType)}
      ${td(`<span style="color:${color};font-weight:${urgent ? 700 : 400}">${p.dueDate}</span>`, true)}
      ${td(`<span style="color:${color};font-weight:${urgent ? 700 : 400}">${p.daysUntilDue}d</span>`, true)}
      ${td(`${p.currency} ${money(p.amount)}`, true, true)}
    </tr>`;
  }).join("");

  return sectionWrapper(
    "Upcoming Payments",
    `Next ${daysAhead} days · ${data.payments.length} payment(s) due · As of ${data.asOfDate}`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Branch")}${th("Type")}${th("Due Date", true)}${th("Days", true)}${th("Amount", true)}</tr></thead>
      <tbody>${rows || noDataRow(5, `No payments due in the next ${daysAhead} days.`)}</tbody>
    </table>`);
}

function renderOverdueSummary(data: OverdueSummarySectionData): string {
  if (data.payments.length === 0) {
    return sectionWrapper("Overdue Payments", `As of ${data.asOfDate}`,
      `<div style="padding:24px;text-align:center;color:#16a34a;font-size:13px;font-weight:600">✓ No overdue payments.</div>`);
  }

  const rows = data.payments.map((p, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>${p.branchName}</strong>`)}
      ${td(p.expenseType)}
      ${td(`<span style="color:#dc2626">${p.dueDate}</span>`, true)}
      ${td(`<span style="color:#dc2626;font-weight:700">${p.daysOverdue}d</span>`, true)}
      ${td(`${p.currency} ${money(p.amount)}`, true, true)}
    </tr>`;
  }).join("");

  return sectionWrapper(
    "Overdue Payments",
    `As of ${data.asOfDate} · ${data.payments.length} overdue · Total: ${money(data.totalAmount)}`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Branch")}${th("Type")}${th("Was Due", true)}${th("Days Overdue", true)}${th("Amount", true)}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`);
}

function renderWeekSnapshot(data: WeekSnapshotSectionData): string {
  const metricLabel: Record<string, string> = {
    cashIn: "Cash In", cashOut: "Cash Out", volume: "Txn Volume", commission: "Commission",
  };
  const metric  = data.params.metric ?? "cashIn";
  const label   = metricLabel[metric] ?? "Cash In";
  const isMoney = metric !== "volume";
  const fmt     = (v: number) => isMoney ? money(v) : v.toLocaleString();

  const maxVal = Math.max(...data.days.map((d) => d.value), 1);

  const rows = data.days.map((day, i) => {
    const bg      = i % 2 === 0 ? "#fff" : "#f8fafc";
    const barPct  = Math.round((day.value / maxVal) * 100);
    const isToday = i === data.days.length - 1;
    return `<tr style="background:${bg}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:13px;font-weight:${isToday ? 700 : 400}">${day.dayLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:12px;color:#6b7280">${day.date}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:13px;font-weight:600;text-align:right">${fmt(day.value)}</td>
      <td style="padding:8px 16px;border-bottom:1px solid #e5e9f0;min-width:120px">
        <div style="background:#e5e9f0;border-radius:4px;height:10px;overflow:hidden">
          <div style="background:${BRAND};width:${barPct}%;height:100%;border-radius:4px"></div>
        </div>
      </td>
    </tr>`;
  }).join("");

  const footer = `<tr style="background:#eef2f8">
    <td colspan="2" style="padding:10px 12px;font-size:13px;font-weight:700">7-DAY TOTAL</td>
    <td style="padding:10px 12px;font-size:13px;font-weight:700;text-align:right">${fmt(data.grandValue)}</td>
    <td style="padding:10px 12px;font-size:12px;color:#6b7280">${data.grandVolume.toLocaleString()} txns</td>
  </tr>`;

  return sectionWrapper(`7-Day Snapshot — ${label}`, "Last 7 days including yesterday",
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Day")}${th("Date")}${th(label, true)}${th("")}</tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>${footer}</tfoot>
    </table>`);
}

// ─── Public ───────────────────────────────────────────────────────────────────

export function renderSection(data: SectionData): string {
  switch (data.type) {
    case "BRANCH_PERFORMANCE":   return renderBranchPerformance(data as BranchPerformanceSectionData);
    case "TOP_PERFORMERS":       return renderTopPerformers(data as TopPerformersSectionData);
    case "WALLET_SUMMARY":       return renderWalletSummary(data as WalletSummarySectionData);
    case "WALLET_RETENTION":     return renderWalletRetention(data as WalletRetentionSectionData);
    case "ALERTS_SUMMARY":       return renderAlertsSummary(data as AlertsSummarySectionData);
    case "FLOAT_POSITION":       return renderFloatPosition(data as FloatPositionSectionData);
    case "TRANSACTION_TRENDS":   return renderTransactionTrends(data as TransactionTrendsSectionData);
    case "NEW_CUSTOMERS":        return renderNewCustomers(data as NewCustomersSectionData);
    case "TOP_WALLET_CUSTOMERS": return renderTopWalletCustomers(data as TopWalletCustomersSectionData);
    case "REVENUE_BREAKDOWN":    return renderRevenueBreakdown(data as RevenueBreakdownSectionData);
    case "UPCOMING_PAYMENTS":    return renderUpcomingPayments(data as UpcomingPaymentsSectionData);
    case "OVERDUE_SUMMARY":      return renderOverdueSummary(data as OverdueSummarySectionData);
    case "WEEK_SNAPSHOT":        return renderWeekSnapshot(data as WeekSnapshotSectionData);
    default: return "";
  }
}

export function buildCustomReportHtml(
  recipientName: string,
  sections: SectionData[],
  reportDate: string,
): string {
  const sectionHtml = sections.map(renderSection).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;color:#1a1a2e">
<div style="max-width:900px;margin:0 auto">
  <div style="background:${BRAND};padding:22px 28px;border-radius:8px 8px 0 0">
    <div style="font-size:22px;font-weight:700;color:#fff">Your Daily Report</div>
    <div style="font-size:13px;color:#93c5fd;margin-top:4px">Hi ${recipientName} · ${reportDate}</div>
  </div>
  <div style="background:#fff;padding:24px 28px;border-radius:0 0 8px 8px;box-shadow:0 2px 8px rgba(0,0,0,0.12)">
    ${sectionHtml}
    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e9f0;font-size:11px;color:#9ca3af">
      Omari Branch System — Personalised Daily Report · Unsubscribe or change your settings in the Report Builder.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function buildCustomReportText(sections: SectionData[], reportDate: string): string {
  const lines: string[] = [`Your Daily Report — ${reportDate}`, ""];

  for (const data of sections) {
    switch (data.type) {
      case "BRANCH_PERFORMANCE": {
        const d = data as BranchPerformanceSectionData;
        lines.push(`=== Branch Performance (${d.date}) ===`);
        for (const r of d.rows) lines.push(`${r.branchName}: Cash In $${r.cashInValue} | Cash Out $${r.cashOutValue} | E-Float $${r.eFloatBalance}`);
        lines.push("");
        break;
      }
      case "TOP_PERFORMERS": {
        const d = data as TopPerformersSectionData;
        lines.push(`=== Top Performers — ${d.params.metric ?? "cashIn"} (${d.date}) ===`);
        for (const r of d.rows) lines.push(`#${r.rank} ${r.branchName}: $${r.value}`);
        lines.push("");
        break;
      }
      case "WALLET_SUMMARY": {
        const d = data as WalletSummarySectionData;
        lines.push(`=== Wallet Summary (${d.asOfDate}) ===`);
        lines.push(`Total: ${d.totalCustomers} | Active 30d: ${d.activeIn30Days} | New 30d: ${d.newIn30Days} | Dormant 90d+: ${d.dormantOver90Days}`);
        lines.push("");
        break;
      }
      case "WALLET_RETENTION": {
        const d = data as WalletRetentionSectionData;
        lines.push(`=== Wallet Retention (${d.asOfDate}) ===`);
        lines.push(`Active: ${d.active30} | 30-60d: ${d.inactive30to60} | 60-90d: ${d.inactive60to90} | Dormant: ${d.dormant90plus}`);
        lines.push("");
        break;
      }
      case "ALERTS_SUMMARY": {
        const d = data as AlertsSummarySectionData;
        lines.push(`=== Recent Alerts ===`);
        for (const a of d.alerts) lines.push(`${a.branchName} — ${a.expenseType} due ${a.dueDate}`);
        lines.push("");
        break;
      }
      case "FLOAT_POSITION": {
        const d = data as FloatPositionSectionData;
        lines.push(`=== Float Position (${d.date}) ===`);
        for (const r of d.rows) lines.push(`${r.branchName}: $${r.eFloatBalance} [${r.status.toUpperCase()}]`);
        lines.push("");
        break;
      }
      case "TRANSACTION_TRENDS": {
        const d = data as TransactionTrendsSectionData;
        lines.push(`=== Transaction Trends (${d.date}) ===`);
        for (const r of d.rows) lines.push(`${r.branchName}: Yesterday ${r.yesterday} | Avg7d ${r.avg7d.toFixed(0)} | ${r.changePercent >= 0 ? "+" : ""}${r.changePercent.toFixed(1)}%`);
        lines.push("");
        break;
      }
      case "NEW_CUSTOMERS": {
        const d = data as NewCustomersSectionData;
        lines.push(`=== New Customers (${d.date}) ===`);
        lines.push(`Yesterday: ${d.newYesterday} | 7d Avg: ${d.avg7d} | This Month: ${d.totalThisMonth}`);
        lines.push("");
        break;
      }
      case "TOP_WALLET_CUSTOMERS": {
        const d = data as TopWalletCustomersSectionData;
        lines.push(`=== Top Wallet Customers ===`);
        for (const r of d.rows) lines.push(`#${r.rank} ${r.fullName} (${r.mobileNumber}): $${r.value}`);
        lines.push("");
        break;
      }
      case "REVENUE_BREAKDOWN": {
        const d = data as RevenueBreakdownSectionData;
        lines.push(`=== Revenue Breakdown (${d.date}) ===`);
        lines.push(`Total: $${d.grandTotal} | Deposits: $${d.totalDeposits} | Withdrawals: $${d.totalWithdrawals}`);
        lines.push("");
        break;
      }
      case "UPCOMING_PAYMENTS": {
        const d = data as UpcomingPaymentsSectionData;
        lines.push(`=== Upcoming Payments (next ${d.params.daysAhead ?? 14} days) ===`);
        for (const p of d.payments) lines.push(`${p.branchName} — ${p.expenseType} due ${p.dueDate} in ${p.daysUntilDue}d ($${p.amount})`);
        lines.push("");
        break;
      }
      case "OVERDUE_SUMMARY": {
        const d = data as OverdueSummarySectionData;
        lines.push(`=== Overdue Payments ===`);
        if (d.payments.length === 0) { lines.push("No overdue payments."); }
        else for (const p of d.payments) lines.push(`${p.branchName} — ${p.expenseType} ${p.daysOverdue}d overdue ($${p.amount})`);
        lines.push("");
        break;
      }
      case "WEEK_SNAPSHOT": {
        const d = data as WeekSnapshotSectionData;
        lines.push(`=== 7-Day Snapshot ===`);
        for (const day of d.days) lines.push(`${day.dayLabel} ${day.date}: ${day.value} (${day.volume} txns)`);
        lines.push("");
        break;
      }
    }
  }

  lines.push("---");
  lines.push("Omari Branch System — Automated Daily Report");
  return lines.join("\n");
}
