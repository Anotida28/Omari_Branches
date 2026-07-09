import { prisma } from '../db/prisma';

export const CONFIG_KEYS = {
  SMS_SENDING_ENABLED: 'sms_sending_enabled',
} as const;

export async function getConfigBool(key: string, defaultValue: boolean): Promise<boolean> {
  const row = await prisma.systemConfig.findUnique({ where: { key } });
  if (!row) return defaultValue;
  return row.value === 'true';
}

export async function setConfig(key: string, value: string, updatedBy?: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where:  { key },
    update: { value, updatedBy: updatedBy ?? null },
    create: { key, value, updatedBy: updatedBy ?? null },
  });
}

export async function isSmsSendingEnabled(): Promise<boolean> {
  return getConfigBool(CONFIG_KEYS.SMS_SENDING_ENABLED, true);
}
