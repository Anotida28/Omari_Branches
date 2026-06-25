import sql from "mssql";

import { getSourcePool } from "../db/source-db";

const SUMMARY_TABLE = "[reporting].[omari_agent_summary_since_launch_daily]";

export type AgentSearchResult = {
  agentAccount: string;
  fullName: string | null;
  mobileNumber: string | null;
};

export type AgentTrendPoint = {
  date: string;
  cashInVolume: number;
  cashOutVolume: number;
  totalTransactionVolume: number;
  cashInValue: number;
  cashOutValue: number;
  totalTransactionValue: number;
  commissionOnDeposits: number;
  commissionOnWithdrawals: number;
  totalCommission: number;
};

export type AgentTrendsKpis = {
  totalTransactionValue: number;
  totalTransactionVolume: number;
  totalCommission: number;
  cashInValue: number;
  cashOutValue: number;
};

export type AgentTrendsResult = {
  kpis: AgentTrendsKpis;
  trend: AgentTrendPoint[];
};

// In-memory cache: load all ~6,761 agents once per hour instead of scanning 5.9M rows on every keystroke
let _agentListCache: { data: AgentSearchResult[]; expiresAt: number } | null = null;

function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toStr(value: unknown): string {
  return String(value ?? "").trim();
}

function toNullStr(value: unknown): string | null {
  const s = toStr(value);
  return s.length > 0 ? s : null;
}

export async function searchAgents(q: string, limit = 20): Promise<AgentSearchResult[]> {
  const pool = await getSourcePool();
  const request = pool.request();
  const term = `%${q.trim()}%`;
  request.input("q", sql.NVarChar(200), term);
  request.input("lim", sql.Int, Math.min(Math.max(1, limit), 50));

  const result = await request.query(`
    SELECT TOP (@lim)
      LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120)))) AS agentAccount,
      MAX(NULLIF(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))), '')) AS fullName,
      MAX(NULLIF(LTRIM(RTRIM(CAST([mobile_number] AS VARCHAR(120)))), '')) AS mobileNumber
    FROM ${SUMMARY_TABLE} WITH (NOLOCK)
    WHERE
      LTRIM(RTRIM(CAST([full_name]      AS VARCHAR(255)))) LIKE @q
      OR LTRIM(RTRIM(CAST([first_name]  AS VARCHAR(120)))) LIKE @q
      OR LTRIM(RTRIM(CAST([last_name]   AS VARCHAR(120)))) LIKE @q
      OR LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120)))) LIKE @q
    GROUP BY LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120))))
    ORDER BY MAX(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))))
  `);

  return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    agentAccount: toStr(row.agentAccount),
    fullName: toNullStr(row.fullName),
    mobileNumber: toNullStr(row.mobileNumber),
  }));
}

export async function listAllAgents(): Promise<AgentSearchResult[]> {
  const now = Date.now();
  if (_agentListCache && _agentListCache.expiresAt > now) {
    return _agentListCache.data;
  }

  const pool = await getSourcePool();
  const request = pool.request();
  const result = await request.query(`
    SELECT
      LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120)))) AS agentAccount,
      MAX(NULLIF(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))), '')) AS fullName,
      MAX(NULLIF(LTRIM(RTRIM(CAST([mobile_number] AS VARCHAR(120)))), '')) AS mobileNumber
    FROM ${SUMMARY_TABLE} WITH (NOLOCK)
    GROUP BY LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120))))
    ORDER BY MAX(NULLIF(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))), ''))
  `);

  const data = (result.recordset as Array<Record<string, unknown>>).map((row) => ({
    agentAccount: toStr(row.agentAccount),
    fullName: toNullStr(row.fullName),
    mobileNumber: toNullStr(row.mobileNumber),
  }));

  _agentListCache = { data, expiresAt: now + 60 * 60 * 1000 };
  return data;
}

export async function getAgentTrends(
  agentAccounts: string[],
  dateFrom: Date,
  dateTo: Date,
): Promise<AgentTrendsResult> {
  const empty: AgentTrendsResult = {
    kpis: { totalTransactionValue: 0, totalTransactionVolume: 0, totalCommission: 0, cashInValue: 0, cashOutValue: 0 },
    trend: [],
  };

  if (agentAccounts.length === 0) return empty;

  const pool = await getSourcePool();
  const request = pool.request();
  request.input("dateFrom", sql.Date, dateFrom);
  request.input("dateTo", sql.Date, dateTo);

  const inClause = agentAccounts
    .slice(0, 100)
    .map((acc, i) => {
      request.input(`acc${i}`, sql.VarChar(120), acc.trim());
      return `@acc${i}`;
    })
    .join(", ");

  const result = await request.query(`
    SELECT
      CAST([date_id] AS DATE) AS metricDate,
      SUM(COALESCE([number_of_deposits],   0)) AS cashInVolume,
      SUM(COALESCE([number_of_withdrawals],0)) AS cashOutVolume,
      SUM(COALESCE([total_volume],         0)) AS totalTransactionVolume,
      SUM(COALESCE([value_of_deposits],    0)) AS cashInValue,
      SUM(COALESCE([value_of_withdrawals], 0)) AS cashOutValue,
      SUM(COALESCE([total_value],          0)) AS totalTransactionValue,
      SUM(COALESCE([commission_on_deposits],   0)) AS commissionOnDeposits,
      SUM(COALESCE([commission_on_withdrawals],0)) AS commissionOnWithdrawals,
      SUM(COALESCE([total_commission],     0)) AS totalCommission
    FROM ${SUMMARY_TABLE} WITH (NOLOCK)
    WHERE [agent_account] IN (${inClause})
      AND [date_id] >= @dateFrom
      AND [date_id] <= @dateTo
    GROUP BY CAST([date_id] AS DATE)
    ORDER BY CAST([date_id] AS DATE)
  `);

  const trend: AgentTrendPoint[] = (result.recordset as Array<Record<string, unknown>>).map((row) => {
    const d = row.metricDate as Date;
    return {
      date: d.toISOString().slice(0, 10),
      cashInVolume: Math.trunc(toNum(row.cashInVolume)),
      cashOutVolume: Math.trunc(toNum(row.cashOutVolume)),
      totalTransactionVolume: Math.trunc(toNum(row.totalTransactionVolume)),
      cashInValue: toNum(row.cashInValue),
      cashOutValue: toNum(row.cashOutValue),
      totalTransactionValue: toNum(row.totalTransactionValue),
      commissionOnDeposits: toNum(row.commissionOnDeposits),
      commissionOnWithdrawals: toNum(row.commissionOnWithdrawals),
      totalCommission: toNum(row.totalCommission),
    };
  });

  const kpis: AgentTrendsKpis = {
    totalTransactionValue: trend.reduce((s, p) => s + p.totalTransactionValue, 0),
    totalTransactionVolume: trend.reduce((s, p) => s + p.totalTransactionVolume, 0),
    totalCommission: trend.reduce((s, p) => s + p.totalCommission, 0),
    cashInValue: trend.reduce((s, p) => s + p.cashInValue, 0),
    cashOutValue: trend.reduce((s, p) => s + p.cashOutValue, 0),
  };

  return { kpis, trend };
}
