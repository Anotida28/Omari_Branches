import type {
  SectionData,
  BranchPerformanceSectionData,
  TopPerformersSectionData,
  WalletSummarySectionData,
  WalletRetentionSectionData,
  AlertsSummarySectionData,
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

function renderBranchPerformance(data: BranchPerformanceSectionData): string {
  const p = data.params as BranchPerformanceParams;
  const showCashIn = p.showCashIn !== false;
  const showCashOut = p.showCashOut !== false;
  const showEFloat = p.showEFloat !== false;
  const showCommission = p.showCommission !== false;

  const headers = [
    th("Branch"),
    showCashIn ? th("Cash In", true) : "",
    showCashOut ? th("Cash Out", true) : "",
    showCashIn && showCashOut ? th("Net Cash", true) : "",
    th("Txns", true),
    showEFloat ? th("E-Float", true) : "",
    showCommission ? th("Commission", true) : "",
  ].join("");

  const rows = data.rows.map((row, i) => {
    const net = row.cashInValue - row.cashOutValue;
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>${row.branchName}</strong>`)}
      ${showCashIn ? td(`${row.cashInVolume} txns<br/>${money(row.cashInValue)}`, true) : ""}
      ${showCashOut ? td(`${row.cashOutVolume} txns<br/>${money(row.cashOutValue)}`, true) : ""}
      ${showCashIn && showCashOut ? td(money(net), true) : ""}
      ${td(row.totalTransactionVolume.toLocaleString(), true)}
      ${showEFloat ? td(money(row.eFloatBalance), true) : ""}
      ${showCommission ? td(money(row.totalCommission), true) : ""}
    </tr>`;
  }).join("");

  const noData = `<tr><td colspan="8" style="padding:24px;text-align:center;color:#6b7280;font-size:13px">No branch metrics for this date.</td></tr>`;

  const table = `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows || noData}</tbody>
  </table></div>`;

  return sectionWrapper("Branch Performance", `Date: ${data.date} · ${data.rows.length} branch(es)`, table);
}

function renderTopPerformers(data: TopPerformersSectionData): string {
  const metricLabel: Record<string, string> = {
    cashIn: "Cash In",
    cashOut: "Cash Out",
    eFloat: "E-Float Balance",
    commission: "Commission",
  };
  const metric = data.params.metric ?? "cashIn";
  const label = metricLabel[metric] ?? metric;
  const orderLabel = (data.params.order ?? "desc") === "desc" ? "Top" : "Bottom";

  const rows = data.rows.map((row, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      ${td(`<strong>#${row.rank}</strong>`, false, true)}
      ${td(row.branchName)}
      ${td(money(row.value), true, true)}
    </tr>`;
  }).join("");

  const noData = `<tr><td colspan="3" style="padding:24px;text-align:center;color:#6b7280;font-size:13px">No branch metrics for this date.</td></tr>`;

  const table = `<table style="width:100%;border-collapse:collapse">
    <thead><tr>${th("Rank")}${th("Branch")}${th(label, true)}</tr></thead>
    <tbody>${rows || noData}</tbody>
  </table>`;

  return sectionWrapper(
    `${orderLabel} ${data.rows.length} Branches — ${label}`,
    `Date: ${data.date}`,
    table,
  );
}

function renderWalletSummary(data: WalletSummarySectionData): string {
  const stats = [
    ["Total Customers", data.totalCustomers.toLocaleString()],
    ["Active (Last 30 Days)", `${data.activeIn30Days.toLocaleString()} ${pct(data.activeIn30Days, data.totalCustomers) !== "—" ? `(${pct(data.activeIn30Days, data.totalCustomers)})` : ""}`],
    ["New (Last 30 Days)", data.newIn30Days.toLocaleString()],
    ["Dormant (90+ Days)", `${data.dormantOver90Days.toLocaleString()} ${pct(data.dormantOver90Days, data.totalCustomers) !== "—" ? `(${pct(data.dormantOver90Days, data.totalCustomers)})` : ""}`],
    ["Total Lifetime Value", money(data.totalLifetimeValue)],
    ["30-Day Activity Value", money(data.activityIn30Days)],
  ];

  const rows = stats.map(([label, val], i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    return `<tr style="background:${bg}">
      <td style="padding:10px 16px;font-size:13px;color:#374151">${label}</td>
      <td style="padding:10px 16px;font-size:13px;font-weight:600;text-align:right">${val}</td>
    </tr>`;
  }).join("");

  const table = `<table style="width:100%;border-collapse:collapse"><tbody>${rows}</tbody></table>`;

  return sectionWrapper("Wallet Customer Summary", `As of ${data.asOfDate}`, table);
}

function renderWalletRetention(data: WalletRetentionSectionData): string {
  const bands = [
    { label: "Active (0–30 days)", count: data.active30, color: "#16a34a" },
    { label: "Inactive (30–60 days)", count: data.inactive30to60, color: "#ca8a04" },
    { label: "Inactive (60–90 days)", count: data.inactive60to90, color: "#ea580c" },
    { label: "Dormant (90+ days)", count: data.dormant90plus, color: "#dc2626" },
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
    <tfoot><tr style="background:#eef2f8;font-weight:700">
      ${td("TOTAL", false, true)}
      ${td(data.totalCustomers.toLocaleString(), true, true)}
      ${td("100%", true, true)}
    </tr></tfoot>
  </table>`;

  return sectionWrapper("Wallet Retention & Dormancy", `As of ${data.asOfDate} · ${data.totalCustomers.toLocaleString()} customers`, table);
}

function renderAlertsSummary(data: AlertsSummarySectionData): string {
  if (data.alerts.length === 0) {
    const noData = `<div style="padding:24px;text-align:center;color:#6b7280;font-size:13px">No alerts in the last 7 days.</div>`;
    return sectionWrapper("Recent Alerts", "Last 7 days", noData);
  }

  const rows = data.alerts.map((alert, i) => {
    const bg = i % 2 === 0 ? "#fff" : "#f8fafc";
    const dayText = alert.dayOffset < 0 ? `${Math.abs(alert.dayOffset)}d overdue` : `${alert.dayOffset}d early`;
    const color = alert.dayOffset < 0 ? "#dc2626" : "#ca8a04";
    return `<tr style="background:${bg}">
      ${td(alert.branchName)}
      ${td(alert.expenseType)}
      ${td(alert.dueDate, true)}
      ${td(`<span style="color:${color};font-weight:600">${dayText}</span>`, true)}
    </tr>`;
  }).join("");

  const table = `<table style="width:100%;border-collapse:collapse">
    <thead><tr>${th("Branch")}${th("Type")}${th("Due Date", true)}${th("Status", true)}</tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

  return sectionWrapper("Recent Alerts", `Last 7 days · ${data.alerts.length} alert(s)`, table);
}

export function renderSection(data: SectionData): string {
  switch (data.type) {
    case "BRANCH_PERFORMANCE":
      return renderBranchPerformance(data as BranchPerformanceSectionData);
    case "TOP_PERFORMERS":
      return renderTopPerformers(data as TopPerformersSectionData);
    case "WALLET_SUMMARY":
      return renderWalletSummary(data as WalletSummarySectionData);
    case "WALLET_RETENTION":
      return renderWalletRetention(data as WalletRetentionSectionData);
    case "ALERTS_SUMMARY":
      return renderAlertsSummary(data as AlertsSummarySectionData);
    default:
      return "";
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
    <div style="font-size:13px;color:#93c5fd;margin-top:4px">
      Hi ${recipientName} · ${reportDate}
    </div>
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

export function buildCustomReportText(
  sections: SectionData[],
  reportDate: string,
): string {
  const lines: string[] = [`Your Daily Report — ${reportDate}`, ""];

  for (const data of sections) {
    switch (data.type) {
      case "BRANCH_PERFORMANCE": {
        const d = data as BranchPerformanceSectionData;
        lines.push(`=== Branch Performance (${d.date}) ===`);
        for (const row of d.rows) {
          lines.push(`${row.branchName}: Cash In $${row.cashInValue} | Cash Out $${row.cashOutValue} | E-Float $${row.eFloatBalance}`);
        }
        lines.push("");
        break;
      }
      case "TOP_PERFORMERS": {
        const d = data as TopPerformersSectionData;
        lines.push(`=== Top Performers — ${d.params.metric ?? "cashIn"} (${d.date}) ===`);
        for (const row of d.rows) {
          lines.push(`#${row.rank} ${row.branchName}: $${row.value}`);
        }
        lines.push("");
        break;
      }
      case "WALLET_SUMMARY": {
        const d = data as WalletSummarySectionData;
        lines.push(`=== Wallet Summary (${d.asOfDate}) ===`);
        lines.push(`Total Customers: ${d.totalCustomers}`);
        lines.push(`Active 30d: ${d.activeIn30Days} | New 30d: ${d.newIn30Days} | Dormant 90d+: ${d.dormantOver90Days}`);
        lines.push(`Lifetime Value: $${d.totalLifetimeValue} | 30d Activity: $${d.activityIn30Days}`);
        lines.push("");
        break;
      }
      case "WALLET_RETENTION": {
        const d = data as WalletRetentionSectionData;
        lines.push(`=== Wallet Retention (${d.asOfDate}) ===`);
        lines.push(`Active 0-30d: ${d.active30} | Inactive 30-60d: ${d.inactive30to60} | Inactive 60-90d: ${d.inactive60to90} | Dormant 90d+: ${d.dormant90plus}`);
        lines.push("");
        break;
      }
      case "ALERTS_SUMMARY": {
        const d = data as AlertsSummarySectionData;
        lines.push(`=== Recent Alerts ===`);
        for (const alert of d.alerts) {
          lines.push(`${alert.branchName} — ${alert.expenseType} due ${alert.dueDate}`);
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
