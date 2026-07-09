import axios from 'axios';

import { env } from '../config/env';
import { sendEmail } from './email.service';

export function isSmsConfigured(): boolean {
  return !!(env.OMARISMS_URL && env.OMARISMS_USER && env.OMARISMS_USER_PASSWORD && env.OMARISMS_USER_SENDER);
}

const SMS_ALERT_RECIPIENTS = [
  'takudzwag@oldmutual.co.zw',
  'timukudzemah@oldmutual.co.zw',
  'jasperm@oldmutual.co.zw',
  'tanyaradzwau@oldmutual.co.zw',
  'lourencer@oldmutual.co.zw',
];

async function fireLowCreditAlert(remaining: number): Promise<void> {
  try {
    await sendEmail({
      to: SMS_ALERT_RECIPIENTS,
      subject: `[Omari] SMS credits low — ${remaining} remaining`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;">
          <h3 style="color:#d32f2f;">SMS Credit Warning</h3>
          <p>The ZSS SMS gateway account has <strong>${remaining} credits remaining</strong>,
          which is below the alert threshold of <strong>${env.SMS_LOW_CREDIT_THRESHOLD}</strong>.</p>
          <p>Please top up at <a href="https://secure.zss.co.zw">secure.zss.co.zw</a> before
          the daily subscription reminder job runs to avoid missed customer notifications.</p>
        </div>`,
      text: `SMS credits low: ${remaining} remaining (threshold: ${env.SMS_LOW_CREDIT_THRESHOLD}). Top up at secure.zss.co.zw.`,
    });
    console.log(`[SMS] Low-credit alert sent to ${SMS_ALERT_RECIPIENTS.join(', ')}`);
  } catch (err: any) {
    console.error('[SMS] Failed to send low-credit alert email:', err.message);
  }
}

export async function sendSms(phoneNumber: string, message: string): Promise<boolean> {
  if (!isSmsConfigured()) {
    console.warn('[SMS] Not configured — skipping send to', phoneNumber);
    return false;
  }

  const baseUrl = env.OMARISMS_URL!.replace(/\?$/, '');

  try {
    const res = await axios.get<string>(baseUrl, {
      params: {
        user: env.OMARISMS_USER,
        password: env.OMARISMS_USER_PASSWORD,
        msisdn: phoneNumber,
        sender: env.OMARISMS_USER_SENDER,
        message,
      },
      responseType: 'text',
      timeout: 30_000,
    });

    // ZSS gateway returns XML: <RESPONSE><status>1</status>...</RESPONSE>
    // Fall back to JSON parsing for any future gateway that returns JSON.
    let data: any = {};
    const raw = typeof res.data === 'string' ? res.data : '';
    try { data = raw ? JSON.parse(raw) : res.data; } catch { /* XML — handled below */ }

    const success =
      data.status === 1 ||
      data.success === true ||
      raw.includes('<status>1</status>') ||
      raw.toLowerCase().includes('success');

    if (success) {
      console.log(`[SMS] Sent to ${phoneNumber}`);
      const credits = typeof data.credits === 'number' ? data.credits : null;
      if (credits !== null) {
        console.log(`[SMS] Remaining credits: ${credits}`);
        if (credits < env.SMS_LOW_CREDIT_THRESHOLD) {
          console.warn(`[SMS] LOW CREDIT WARNING: only ${credits} credits remaining (threshold: ${env.SMS_LOW_CREDIT_THRESHOLD})`);
          fireLowCreditAlert(credits).catch(() => {});
        }
      }
      return true;
    }

    console.warn(`[SMS] Non-success response for ${phoneNumber}:`, res.data);
    return false;
  } catch (error: any) {
    console.error(`[SMS] Error sending to ${phoneNumber}:`, error.message);
    return false;
  }
}
