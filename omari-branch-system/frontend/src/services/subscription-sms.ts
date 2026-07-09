import { api } from "./api";

export interface SmsLogEntry {
  id: string;
  sentAt: string;
  mobileNr: string;
  serviceName: string;
  lane: string;
  subscriptionAmount: number;
  feeAmount: number;
  totalNeeded: number;
  currentBalance: number;
  topUpAmount: number;
  predictedChargeDate: string;
  smsSent: boolean;
  smsError: string | null;
}

export interface SmsLogSummary {
  totalSent: number;
  totalFailed: number;
  successRate: number;
  topService: string;
  totalTopUpValueAtRisk: number;
}

export interface SmsLogResponse {
  summary: SmsLogSummary;
  entries: SmsLogEntry[];
  total: number;
}

export interface SmsPreviewEntry {
  mobileNr: string;
  customerName: string;
  serviceName: string;
  lane: string;
  subscriptionAmount: number;
  feeAmount: number;
  totalNeeded: number;
  currentBalance: number;
  topUpAmount: number;
  predictedChargeDate: string | null;
  daysUntilCharge: number | null;
  message: string;
}

export interface SmsPreviewResult {
  generatedAt: string;
  generationMs: number;
  totalCandidatesScanned: number;
  sufficientBalanceSkipped: number;
  totalToSend: number;
  lane1Count: number;
  lane2aCount: number;
  byService: Record<string, number>;
  totalTopUpNeeded: number;
  entries: SmsPreviewEntry[];
}

export async function fetchSmsLog(params: {
  dateFrom?: string;
  dateTo?: string;
  lane?: string;
  serviceName?: string;
  smsSent?: boolean;
}): Promise<SmsLogResponse> {
  const { data } = await api.get<SmsLogResponse>("/api/subscription-sms/log", {
    params: {
      ...(params.dateFrom    && { dateFrom:     params.dateFrom }),
      ...(params.dateTo      && { dateTo:        params.dateTo }),
      ...(params.lane        && { lane:          params.lane }),
      ...(params.serviceName && { serviceName:   params.serviceName }),
      ...(params.smsSent !== undefined && { smsSent: String(params.smsSent) }),
    },
  });
  return data;
}

export async function fetchSmsPreview(): Promise<SmsPreviewResult> {
  const { data } = await api.get<SmsPreviewResult>("/api/subscription-sms/preview", {
    timeout: 300_000, // 5 min — source DB query
  });
  return data;
}

export interface ImpactByService {
  serviceName:    string;
  sent:           number;
  converted:      number;
  conversionRate: number;
  revenue:        number;
}

export interface SmsImpactResult {
  days:                  number;
  smsSent:               number;
  smsCost:               number;
  conversions:           number;
  conversionRate:        number;
  revenueEarned:         number;
  netRoi:                number;
  pendingReconciliation: number;
  byService:             ImpactByService[];
}

export async function fetchSmsImpact(days: number): Promise<SmsImpactResult> {
  const { data } = await api.get<SmsImpactResult>("/api/subscription-sms/impact", {
    params: { days },
  });
  return data;
}

export interface SmsConfig {
  smsSendingEnabled: boolean;
}

export async function fetchSmsConfig(): Promise<SmsConfig> {
  const { data } = await api.get<SmsConfig>("/api/subscription-sms/config");
  return data;
}

export async function updateSmsConfig(enabled: boolean): Promise<SmsConfig> {
  const { data } = await api.put<SmsConfig>("/api/subscription-sms/config", {
    smsSendingEnabled: enabled,
  });
  return data;
}
