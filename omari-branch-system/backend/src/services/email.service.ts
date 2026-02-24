/**
 * Email service for sending alert notifications via Gmail App Password.
 */

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../config/env";

const emailUser = env.EMAIL_USER;
const emailAppPassword = env.EMAIL_APP_PASSWORD.replace(/\s+/g, "");
const emailFrom = env.EMAIL_FROM;

if (!emailUser || !emailAppPassword || !emailFrom) {
  throw new Error("Missing EMAIL_USER / EMAIL_APP_PASSWORD / EMAIL_FROM in env");
}

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

export type SendEmailOptions = {
  to: string[];
  subject: string;
  html: string;
  text?: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    if (env.EMAIL_PROVIDER !== "gmail") {
      throw new Error(`Unsupported email provider: ${env.EMAIL_PROVIDER}`);
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailAppPassword,
      },
    });
  }

  return transporter;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToHtml(text: string): string {
  return `<pre style="font-family:Arial,sans-serif;white-space:pre-wrap;line-height:1.4;">${escapeHtml(text)}</pre>`;
}

export async function sendEmail(opts: SendEmailOptions): Promise<string> {
  const { to, subject, html, text } = opts;
  if (!to.length) {
    throw new Error("sendEmail requires at least one recipient");
  }

  const info = await getTransporter().sendMail({
    from: emailFrom,
    to: to.join(","),
    subject,
    text,
    html,
  });

  return info.messageId;
}

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
 * Send an alert email through Gmail SMTP.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<EmailSendResult> {
  const subject = formatSubject(payload);
  const textBody = formatBody(payload);

  try {
    await sendEmail({
      to: [payload.to],
      subject,
      text: textBody,
      html: textToHtml(textBody),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
