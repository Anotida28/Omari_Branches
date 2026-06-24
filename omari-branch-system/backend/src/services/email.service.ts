/**
 * Email delivery service.
 *
 * The app now sends through the bulk mailer API by default.
 * Gmail SMTP remains as an optional fallback provider.
 */

import http from "node:http";
import https from "node:https";

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "../config/env";

export type AlertEmailPayload = {
  to: string;
  branchName: string;
  expenseType: string;
  period: string;
  dueDate: string;
  amount: string;
  alertType: string;
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

function normalizeEmailError(error: unknown): Error {
  const err = error as {
    code?: string;
    responseCode?: number;
    message?: string;
  };

  if (err?.code === "EAUTH" || err?.responseCode === 535) {
    return new Error(
      "Google SMTP auth failed (535). Verify EMAIL_USER is the real mailbox login, EMAIL_APP_PASSWORD is a current app password, and 2-Step Verification + App Passwords are enabled for that account."
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function gmailCredentialsAvailable(): boolean {
  return !!(env.EMAIL_FROM && env.EMAIL_USER && env.EMAIL_APP_PASSWORD);
}

function getTransporter(): Transporter {
  if (!transporter) {
    if (!gmailCredentialsAvailable()) {
      throw new Error(
        "Gmail credentials not configured. Set EMAIL_FROM, EMAIL_USER, and EMAIL_APP_PASSWORD in .env",
      );
    }

    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.EMAIL_USER!,
        pass: env.EMAIL_APP_PASSWORD!.replace(/\s+/g, ""),
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

function stripHtml(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBulkMailerMessage(opts: SendEmailOptions): string {
  // Prefer HTML so the mailer renders a rich email; fall back to plain text
  const html = opts.html?.trim();
  if (html) {
    return html;
  }

  const text = opts.text?.trim();
  if (text) {
    return text;
  }

  throw new Error("Bulk mailer requires a non-empty message body");
}

function normalizeBulkMailerAuthorizationHeader(): string | null {
  const token = env.BULK_MAILER_AUTH_TOKEN?.trim();
  if (!token) {
    return null;
  }

  return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

function buildMultipartFormBody(
  fields: Array<{ name: string; value: string }>,
  boundary: string,
): Buffer {
  const lines: string[] = [];

  for (const field of fields) {
    lines.push(`--${boundary}`);
    lines.push(`Content-Disposition: form-data; name="${field.name}"`);
    lines.push("");
    lines.push(field.value);
  }

  lines.push(`--${boundary}--`);
  lines.push("");

  return Buffer.from(lines.join("\r\n"), "utf8");
}

function postMultipartForm(
  targetUrl: URL,
  fields: Array<{ name: string; value: string }>,
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const boundary = `----omari-boundary-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const body = buildMultipartFormBody(fields, boundary);
    const isHttps = targetUrl.protocol === "https:";
    const client = isHttps ? https : http;
    const authorization = normalizeBulkMailerAuthorizationHeader();

    const headers: Record<string, string | number> = {
      Accept: "application/json, text/plain, */*",
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length,
    };

    if (authorization) {
      headers.Authorization = authorization;
    }

    const requestOptions = {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port ? Number(targetUrl.port) : isHttps ? 443 : 80,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: "POST",
      headers,
      timeout: env.BULK_MAILER_TIMEOUT_MS,
      ...(isHttps
        ? { rejectUnauthorized: !env.BULK_MAILER_TRUST_SERVER_CERTIFICATE }
        : {}),
    };

    const req = client.request(requestOptions, (res) => {
      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        responseBody += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          body: responseBody,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error(`Bulk mailer request timed out after ${env.BULK_MAILER_TIMEOUT_MS}ms`));
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(body);
    req.end();
  });
}

function getBulkMailerSendUrl(): URL {
  const baseUrl = env.BULK_MAILER_BASE_URL.replace(/\/+$/, "");
  const path = env.BULK_MAILER_SEND_PATH.startsWith("/")
    ? env.BULK_MAILER_SEND_PATH
    : `/${env.BULK_MAILER_SEND_PATH}`;

  return new URL(`${baseUrl}${path}`);
}

async function sendViaBulkMailer(opts: SendEmailOptions): Promise<string> {
  const message = normalizeBulkMailerMessage(opts);
  const targetUrl = getBulkMailerSendUrl();
  let acceptedCount = 0;

  for (const recipient of opts.to) {
    const response = await postMultipartForm(targetUrl, [
      { name: "subject", value: opts.subject },
      { name: "from", value: env.BULK_MAILER_FROM! },
      { name: "to", value: recipient },
      { name: "message", value: message },
    ]);

    const normalizedBody = response.body.trim().toLowerCase();
    if (response.statusCode < 200 || response.statusCode >= 300 || normalizedBody !== "true") {
      throw new Error(
        `Bulk mailer rejected recipient ${recipient} with status ${response.statusCode}: ${response.body.trim() || "empty response"}`
      );
    }

    acceptedCount += 1;
  }

  return `bulk-mailer-accepted:${acceptedCount}:${Date.now()}`;
}

async function sendViaGmail(opts: SendEmailOptions): Promise<string> {
  const { to, subject, html, text } = opts;
  if (!to.length) {
    throw new Error("sendEmail requires at least one recipient");
  }

  const info = await getTransporter().sendMail({
    from: env.EMAIL_FROM!,
    to: to.join(","),
    subject,
    text,
    html,
  });

  return info.messageId;
}

export async function sendEmail(opts: SendEmailOptions): Promise<string> {
  if (!opts.to.length) {
    throw new Error("sendEmail requires at least one recipient");
  }

  if (env.EMAIL_PROVIDER === "bulkmailer") {
    try {
      return await sendViaBulkMailer(opts);
    } catch (bulkError) {
      if (!gmailCredentialsAvailable()) {
        throw normalizeEmailError(bulkError);
      }
      console.warn(
        `[email] Bulk mailer failed (${(bulkError as Error).message}). Falling back to Gmail.`,
      );
      try {
        return await sendViaGmail(opts);
      } catch (gmailError) {
        throw normalizeEmailError(gmailError);
      }
    }
  }

  try {
    return await sendViaGmail(opts);
  } catch (error) {
    throw normalizeEmailError(error);
  }
}

export function formatSubject(payload: AlertEmailPayload): string {
  const { branchName, expenseType, period, alertType, dayOffset } = payload;

  if (alertType === "DUE_REMINDER") {
    const days = Math.abs(dayOffset);
    return `[Reminder] ${branchName}: ${expenseType} for ${period} due in ${days} day${days !== 1 ? "s" : ""}`;
  }

  return `[OVERDUE] ${branchName}: ${expenseType} for ${period} is ${dayOffset} day${dayOffset !== 1 ? "s" : ""} overdue`;
}

export function formatBody(payload: AlertEmailPayload): string {
  const { branchName, expenseType, period, dueDate, amount, alertType, dayOffset } = payload;

  const header = alertType === "DUE_REMINDER"
    ? `This is a reminder that ${expenseType} for ${branchName} is due soon.`
    : `ATTENTION: ${expenseType} for ${branchName} is now overdue.`;

  return `
${header}

Branch: ${branchName}
Expense Type: ${expenseType}
Period: ${period}
Due Date: ${dueDate}
Expected Amount: ${amount}

${alertType === "DUE_REMINDER"
    ? "Please review this expense before the due date."
    : `This expense is ${dayOffset} day(s) overdue. Please follow up with the branch.`
}

---
Omari Branch System - Automated Alert
`.trim();
}

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
    const normalizedError = normalizeEmailError(error);
    return {
      success: false,
      error: normalizedError.message,
    };
  }
}

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
