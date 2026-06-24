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
  const metrics     = data.params.metrics?.length ? data.params.metrics : ["cashIn"];
  const sortBy      = data.params.sortBy ?? metrics[0] ?? "cashIn";
  const orderLabel  = (data.params.order ?? "desc") === "desc" ? "Top" : "Bottom";
  const sortLabel   = metricLabel[sortBy] ?? sortBy;
  const colCount    = 2 + metrics.length;

  const headerCells = [th("Rank"), th("Branch"), ...metrics.map((m) => th(metricLabel[m] ?? m, true))].join("");

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    const metricCells = metrics.map((m) => {
      const val = row[m as keyof typeof row] as number | undefined;
      return td(val !== undefined ? money(val) : "—", true, m === sortBy);
    }).join("");
    return `<tr style="background:${bg}">
      ${td(`<strong>#${row.rank}</strong>`, false, true)}
      ${td(row.branchName)}
      ${metricCells}
    </tr>`;
  }).join("");

  const table = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rows || noDataRow(colCount, "No branch metrics for this date.")}</tbody>
  </table></div>`;

  return sectionWrapper(
    `${orderLabel} ${data.rows.length} Branches — ${sortLabel}`,
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
    cashIn: "Cash In", cashOut: "Cash Out", volume: "Txn Volume",
  };
  const metrics = data.params.metrics?.length ? data.params.metrics : ["cashIn"];
  const sortBy  = data.params.sortBy ?? metrics[0] ?? "cashIn";

  const headerCells = [
    th("Branch"),
    ...metrics.flatMap((m) => [th(metricLabel[m] ?? m, true), th("vs 7d Avg", true)]),
  ].join("");

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    const metricCells = metrics.flatMap((m) => {
      const md = row[m as "cashIn" | "cashOut" | "volume"] as
        | { yesterday: number; avg7d: number; changePercent: number }
        | undefined;
      const isMoney = m !== "volume";
      const fmt = (v: number) => isMoney ? money(v) : v.toLocaleString();
      const up = (md?.changePercent ?? 0) >= 0;
      const color = up ? "#16a34a" : "#dc2626";
      const isSortCol = m === sortBy;
      return [
        td(md ? fmt(md.yesterday) : "—", true, isSortCol),
        `<td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;text-align:right;font-size:13px;font-weight:${isSortCol ? 600 : 400};color:${color}">${md ? `${up ? "▲" : "▼"} ${Math.abs(md.changePercent).toFixed(1)}%` : "—"}</td>`,
      ];
    }).join("");
    return `<tr style="background:${bg}">${td(`<strong>${row.branchName}</strong>`)}${metricCells}</tr>`;
  }).join("");

  const colCount = 1 + metrics.length * 2;
  return sectionWrapper(
    "Transaction Trends",
    `Yesterday vs 7-day average · sorted by ${metricLabel[sortBy] ?? sortBy}`,
    `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows || noDataRow(colCount, "No trend data available.")}</tbody>
    </table></div>`,
  );
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
  const metricLabel: Record<string, string> = { last30d: "30-Day Value", lifetime: "Lifetime Value" };
  const metrics = data.params.metrics?.length ? data.params.metrics : ["last30d"];
  const sortBy  = data.params.sortBy ?? metrics[0] ?? "last30d";
  const sortLabel = metricLabel[sortBy] ?? sortBy;

  const metricHeaders = metrics.map((m) => th(metricLabel[m] ?? m, true)).join("");
  const colCount = 3 + metrics.length + 1;

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    const metricCells = metrics.map((m) => {
      const val = row[m as "last30d" | "lifetime"] as number | undefined;
      return td(val !== undefined ? money(val) : "—", true, m === sortBy);
    }).join("");
    return `<tr style="background:${bg}">
      ${td(`<strong>#${row.rank}</strong>`, false, true)}
      ${td(row.fullName)}
      ${td(row.mobileNumber)}
      ${metricCells}
      ${td(row.lifetimeVolume.toLocaleString(), true)}
    </tr>`;
  }).join("");

  return sectionWrapper(
    `Top ${data.rows.length} Wallet Customers`,
    `As of ${data.asOfDate} · sorted by ${sortLabel}`,
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Rank")}${th("Name")}${th("Mobile")}${metricHeaders}${th("Total Txns", true)}</tr></thead>
      <tbody>${rows || noDataRow(colCount, "No customer data available.")}</tbody>
    </table>`,
  );
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
  const metrics      = data.params.metrics?.length ? data.params.metrics : ["cashIn"];
  const primaryMetric = metrics[0] ?? "cashIn";
  const fmt = (m: string, v: number) => m !== "volume" ? money(v) : v.toLocaleString();

  const maxVal = Math.max(
    ...data.days.map((d) => (d[primaryMetric as keyof typeof d] as number | undefined) ?? 0),
    1,
  );

  const metricHeaders = metrics.map((m) => th(metricLabel[m] ?? m, true)).join("");

  const rows = data.days.map((day, i) => {
    const bg      = i % 2 === 0 ? "#fff" : "#f8fafc";
    const primary = (day[primaryMetric as keyof typeof day] as number | undefined) ?? 0;
    const barPct  = Math.round((primary / maxVal) * 100);
    const isToday = i === data.days.length - 1;
    const metricCells = metrics.map((m) => {
      const val = (day[m as keyof typeof day] as number | undefined) ?? 0;
      return `<td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:13px;font-weight:600;text-align:right">${fmt(m, val)}</td>`;
    }).join("");
    return `<tr style="background:${bg}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:13px;font-weight:${isToday ? 700 : 400}">${day.dayLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e9f0;font-size:12px;color:#6b7280">${day.date}</td>
      ${metricCells}
      <td style="padding:8px 16px;border-bottom:1px solid #e5e9f0;min-width:120px">
        <div style="background:#e5e9f0;border-radius:4px;height:10px;overflow:hidden">
          <div style="background:${BRAND};width:${barPct}%;height:100%;border-radius:4px"></div>
        </div>
      </td>
    </tr>`;
  }).join("");

  const grandMap: Record<string, number | undefined> = {
    cashIn:     data.grandCashIn,
    cashOut:    data.grandCashOut,
    commission: data.grandCommission,
    volume:     data.grandVolume,
  };
  const grandCells = metrics.map((m) => {
    const val = grandMap[m] ?? 0;
    return `<td style="padding:10px 12px;font-size:13px;font-weight:700;text-align:right">${fmt(m, val)}</td>`;
  }).join("");
  const showTxnsFooter = !metrics.includes("volume");
  const footer = `<tr style="background:#eef2f8">
    <td colspan="2" style="padding:10px 12px;font-size:13px;font-weight:700">7-DAY TOTAL</td>
    ${grandCells}
    ${showTxnsFooter ? `<td style="padding:10px 12px;font-size:12px;color:#6b7280">${data.grandVolume.toLocaleString()} txns</td>` : `<td></td>`}
  </tr>`;

  const title = metrics.length === 1
    ? `7-Day Snapshot — ${metricLabel[metrics[0]] ?? metrics[0]}`
    : "7-Day Snapshot";

  return sectionWrapper(title, "Last 7 days including yesterday",
    `<table style="width:100%;border-collapse:collapse">
      <thead><tr>${th("Day")}${th("Date")}${metricHeaders}${th("")}</tr></thead>
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
        const sortBy = d.params.sortBy ?? d.params.metrics?.[0] ?? "cashIn";
        lines.push(`=== Top Performers — ${sortBy} (${d.date}) ===`);
        for (const r of d.rows) {
          const vals = (d.params.metrics ?? ["cashIn"])
            .map((m) => `${m}: $${((r[m as keyof typeof r] as number) ?? 0).toFixed(2)}`)
            .join(" | ");
          lines.push(`#${r.rank} ${r.branchName}: ${vals}`);
        }
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
        const tMetrics = d.params.metrics?.length ? d.params.metrics : ["cashIn"];
        const tSortBy  = d.params.sortBy ?? tMetrics[0] ?? "cashIn";
        lines.push(`=== Transaction Trends (${d.date}) — sorted by ${tSortBy} ===`);
        for (const r of d.rows) {
          const vals = tMetrics.map((m) => {
            const md = r[m as "cashIn" | "cashOut" | "volume"] as
              | { yesterday: number; changePercent: number }
              | undefined;
            if (!md) return `${m}: —`;
            const v = m !== "volume" ? `$${md.yesterday.toFixed(2)}` : md.yesterday.toLocaleString();
            return `${m}: ${v} (${md.changePercent >= 0 ? "+" : ""}${md.changePercent.toFixed(1)}%)`;
          }).join(" | ");
          lines.push(`${r.branchName}: ${vals}`);
        }
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
        const wMetrics = d.params.metrics?.length ? d.params.metrics : ["last30d"];
        lines.push(`=== Top Wallet Customers ===`);
        for (const r of d.rows) {
          const vals = wMetrics.map((m) => {
            const val = r[m as "last30d" | "lifetime"] as number | undefined;
            return `${m}: ${val !== undefined ? `$${val.toFixed(2)}` : "—"}`;
          }).join(" | ");
          lines.push(`#${r.rank} ${r.fullName} (${r.mobileNumber}): ${vals}`);
        }
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
        const sMetrics = d.params.metrics?.length ? d.params.metrics : ["cashIn"];
        lines.push(`=== 7-Day Snapshot ===`);
        for (const day of d.days) {
          const vals = sMetrics.map((m) => {
            const val = (day[m as keyof typeof day] as number | undefined) ?? 0;
            return `${m}: ${m !== "volume" ? `$${val.toFixed(2)}` : val.toLocaleString()}`;
          }).join(" | ");
          lines.push(`${day.dayLabel} ${day.date}: ${vals}`);
        }
        lines.push("");
        break;
      }
    }
  }

  lines.push("---");
  lines.push("Omari Branch System — Automated Daily Report");
  return lines.join("\n");
}
