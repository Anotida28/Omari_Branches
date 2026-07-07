import axios from 'axios';

import { env } from '../config/env';

export function isSmsConfigured(): boolean {
  return !!(env.OMARISMS_URL && env.OMARISMS_USER && env.OMARISMS_USER_PASSWORD && env.OMARISMS_USER_SENDER);
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
      return true;
    }

    console.warn(`[SMS] Non-success response for ${phoneNumber}:`, res.data);
    return false;
  } catch (error: any) {
    console.error(`[SMS] Error sending to ${phoneNumber}:`, error.message);
    return false;
  }
}
