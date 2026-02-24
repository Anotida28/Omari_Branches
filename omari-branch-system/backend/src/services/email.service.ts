/**
 * Email service for sending alert notifications.
 * Currently a mock implementation that logs emails.
 * Can be replaced with actual email provider (SendGrid, SES, etc.) later.
 */

export type AlertEmailPayload = {
  to: string;
  branchName: string;
  expenseType: string;
  period: string;
  dueDate: string;
  amount: string;
  balanceRemaining: string;
  alertType: "DUE_REMINDER" | "OVERDUE_ESCALATION";
  dayOffset: number;
};

export type EmailSendResult = {
  success: boolean;
  error?: string;
};

/**
 * Format the email subject based on alert type.
 */
function formatSubject(payload: AlertEmailPayload): string {
  const { branchName, expenseType, period, alertType, dayOffset } = payload;

  if (alertType === "DUE_REMINDER") {
    const days = Math.abs(dayOffset);
    return `[Reminder] ${branchName}: ${expenseType} for ${period} due in ${days} day${days !== 1 ? "s" : ""}`;
  }

  return `[OVERDUE] ${branchName}: ${expenseType} for ${period} is ${dayOffset} day${dayOffset !== 1 ? "s" : ""} overdue`;
}

/**
 * Format the email body based on alert type.
 */
function formatBody(payload: AlertEmailPayload): string {
  const { branchName, expenseType, period, dueDate, amount, balanceRemaining, alertType, dayOffset } = payload;

  const header = alertType === "DUE_REMINDER"
    ? `This is a reminder that ${expenseType} for ${branchName} is due soon.`
    : `ATTENTION: ${expenseType} for ${branchName} is now overdue.`;

  return `
${header}

Branch: ${branchName}
Expense Type: ${expenseType}
Period: ${period}
Due Date: ${dueDate}
Total Amount: ${amount}
Balance Remaining: ${balanceRemaining}

${alertType === "DUE_REMINDER"
    ? `Please ensure payment is made before the due date.`
    : `This expense is ${dayOffset} day(s) overdue. Please take immediate action.`
}

---
Omari Branch System - Automated Alert
`.trim();
}

/**
 * Send an alert email (mock implementation).
 * In production, replace with actual email provider.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<EmailSendResult> {
  const subject = formatSubject(payload);
  const body = formatBody(payload);

  // Mock implementation - just log the email
  console.log(`\n========== EMAIL SENT ==========`);
  console.log(`To: ${payload.to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body:\n${body}`);
  console.log(`================================\n`);

  // Simulate async email send with small delay
  await new Promise(resolve => setTimeout(resolve, 50));

  // For testing, you can make certain emails "fail"
  // e.g., if email contains "fail" for testing error handling
  if (payload.to.includes("fail@")) {
    return {
      success: false,
      error: "Simulated email failure for testing",
    };
  }

  return { success: true };
}

/**
 * Send multiple alert emails in batch.
 * Returns results for each email attempt.
 */
export async function sendAlertEmailBatch(
  payloads: AlertEmailPayload[]
): Promise<Map<string, EmailSendResult>> {
  const results = new Map<string, EmailSendResult>();

  for (const payload of payloads) {
    const result = await sendAlertEmail(payload);
    results.set(payload.to, result);
  }

  return results;
}
