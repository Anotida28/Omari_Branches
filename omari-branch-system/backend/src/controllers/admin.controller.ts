import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { sendEmail } from "../services/email.service";

const testEmailSchema = z
  .object({
    to: z
      .union([z.string().email(), z.array(z.string().email()).min(1)])
      .transform((value) => (typeof value === "string" ? [value] : value)),
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(5000),
  })
  .strict();

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * POST /api/admin/test-email
 * Requires FULL_ACCESS via global write-access middleware.
 */
export async function sendTestEmailHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const parsedBody = testEmailSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  const { to, subject, message } = parsedBody.data;

  try {
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.5;">${escapeHtml(message).replace(/\n/g, "<br />")}</div>`;
    const messageId = await sendEmail({
      to,
      subject,
      text: message,
      html,
    });

    res.json({
      ok: true,
      message: "Test email sent",
      messageId,
      to,
    });
  } catch (error) {
    next(error);
  }
}
