/**
 * Source agent metrics integration.
 *
 * Source-of-truth mapping:
 * - BranchAgentLine.lineNumber maps to the configured source line key column
 * - Default match column: reporting.omari_agent_summary_since_launch_daily.agent_account
 * - Imported daily metrics come from reporting.omari_agent_summary_since_launch_daily
 *
 * Imported fields:
 * - number_of_deposits   -> AgentLineMetric.cashInVolume
 * - value_of_deposits    -> AgentLineMetric.cashInValue
 * - number_of_withdrawals -> AgentLineMetric.cashOutVolume
 * - value_of_withdrawals -> AgentLineMetric.cashOutValue
 *
 * Fields not currently available from the source summary and therefore default
 * to zero in the app:
 * - cashBalance
 * - eFloatBalance
 * - cashInVault
 */

import sql from "mssql";

import { env } from "../config/env";

const PARAM_BATCH_SIZE = 400;

type QualifiedTableName = {
  schema: string;
  table: string;
};

export type SourceAgentReference = {
  lineNumber: string;
  agentAccount: string;
  customerId: string | null;
  fullName: string | null;
  mobileNumber: string | null;
};

export type SourceAgentMetricRow = {
  metricDate: Date;
  lineNumber: string;
  agentAccount: string;
  customerId: string | null;
  fullName: string | null;
  cashInVolume: number;
  cashInValue: number;
  cashOutVolume: number;
  cashOutValue: number;
};

export type SourceMetricMappingDescription = {
  configured: boolean;
  server: string | null;
  database: string | null;
  tlsServerName: string | null;
  summaryTable: string;
  lineMatchColumn: "agent_account" | "customer_id";
  importedFields: Array<{ source: string; target: string }>;
  defaultedFields: string[];
};

let poolPromise: Promise<sql.ConnectionPool> | null = null;

function normalizeSourceValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value).trim();
}

function normalizeNullableSourceValue(value: unknown): string | null {
  const normalized = normalizeSourceValue(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizeDateOnly(value: unknown): Date {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  const parsed = new Date(String(value));
  return new Date(
    Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()),
  );
}

function toNumericValue(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseQualifiedTableName(value: string): QualifiedTableName {
  const [schema, table] = value.split(".");
  return { schema, table };
}

function getSourceSummaryTable(): QualifiedTableName {
  return parseQualifiedTableName(env.SOURCE_SQL_AGENT_SUMMARY_TABLE);
}

function getMatchColumnSql(): "[agent_account]" | "[customer_id]" {
  return env.SOURCE_SQL_AGENT_LINE_MATCH_COLUMN === "customer_id"
    ? "[customer_id]"
    : "[agent_account]";
}

function getSourceConfig(): sql.config {
  return {
    server: env.SOURCE_SQL_SERVER ?? "",
    port: env.SOURCE_SQL_PORT,
    database: env.SOURCE_SQL_DATABASE ?? "",
    user: env.SOURCE_SQL_USER ?? "",
    password: env.SOURCE_SQL_PASSWORD ?? "",
    options: {
      encrypt: env.SOURCE_SQL_ENCRYPT,
      serverName: env.SOURCE_SQL_TLS_SERVER_NAME,
      trustServerCertificate: env.SOURCE_SQL_TRUST_SERVER_CERTIFICATE,
    },
    connectionTimeout: env.SOURCE_SQL_CONNECT_TIMEOUT_MS,
    requestTimeout: env.SOURCE_SQL_REQUEST_TIMEOUT_MS,
  };
}

function chunkValues<T>(values: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize));
  }
  return chunks;
}

function buildInClause(
  request: sql.Request,
  values: string[],
  prefix: string,
): string {
  return values
    .map((value, index) => {
      const name = `${prefix}${index}`;
      request.input(name, sql.VarChar(120), value);
      return `@${name}`;
    })
    .join(", ");
}

export function isSourceMetricsConfigured(): boolean {
  return Boolean(
    env.SOURCE_SQL_SERVER &&
      env.SOURCE_SQL_DATABASE &&
      env.SOURCE_SQL_USER &&
      env.SOURCE_SQL_PASSWORD,
  );
}

export function describeSourceMetricMapping(): SourceMetricMappingDescription {
  return {
    configured: isSourceMetricsConfigured(),
    server: env.SOURCE_SQL_SERVER ?? null,
    database: env.SOURCE_SQL_DATABASE ?? null,
    tlsServerName: env.SOURCE_SQL_TLS_SERVER_NAME ?? null,
    summaryTable: env.SOURCE_SQL_AGENT_SUMMARY_TABLE,
    lineMatchColumn: env.SOURCE_SQL_AGENT_LINE_MATCH_COLUMN,
    importedFields: [
      {
        source: "number_of_deposits",
        target: "AgentLineMetric.cashInVolume",
      },
      {
        source: "value_of_deposits",
        target: "AgentLineMetric.cashInValue",
      },
      {
        source: "number_of_withdrawals",
        target: "AgentLineMetric.cashOutVolume",
      },
      {
        source: "value_of_withdrawals",
        target: "AgentLineMetric.cashOutValue",
      },
    ],
    defaultedFields: ["cashBalance", "eFloatBalance", "cashInVault"],
  };
}

async function getPool(): Promise<sql.ConnectionPool> {
  if (!isSourceMetricsConfigured()) {
    throw new Error("Source SQL metrics connection is not configured.");
  }

  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(getSourceConfig())
      .connect()
      .catch((error: unknown) => {
        poolPromise = null;
        throw error;
      });
  }

  return poolPromise;
}

export async function findSourceAgentsByLineNumbers(
  lineNumbers: string[],
): Promise<Map<string, SourceAgentReference>> {
  const normalizedLineNumbers = Array.from(
    new Set(
      lineNumbers
        .map((lineNumber) => lineNumber.trim())
        .filter((lineNumber) => lineNumber.length > 0),
    ),
  );

  if (normalizedLineNumbers.length === 0 || !isSourceMetricsConfigured()) {
    return new Map();
  }

  const pool = await getPool();
  const { schema, table } = getSourceSummaryTable();
  const matchColumnSql = getMatchColumnSql();
  const references = new Map<string, SourceAgentReference>();

  for (const batch of chunkValues(normalizedLineNumbers, PARAM_BATCH_SIZE)) {
    const request = pool.request();
    const inClause = buildInClause(request, batch, "line");
    const query = `
      SELECT
        LTRIM(RTRIM(CAST(${matchColumnSql} AS VARCHAR(120)))) AS lineNumber,
        MAX(LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120))))) AS agentAccount,
        MAX(NULLIF(LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))), '')) AS customerId,
        MAX(NULLIF(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))), '')) AS fullName,
        MAX(NULLIF(LTRIM(RTRIM(CAST([mobile_number] AS VARCHAR(120)))), '')) AS mobileNumber
      FROM [${schema}].[${table}]
      WHERE ${matchColumnSql} IN (${inClause})
      GROUP BY LTRIM(RTRIM(CAST(${matchColumnSql} AS VARCHAR(120))))
    `;

    const result = await request.query(query);
    for (const row of result.recordset as Array<Record<string, unknown>>) {
      const lineNumber = normalizeSourceValue(row.lineNumber);
      if (!lineNumber) {
        continue;
      }

      references.set(lineNumber, {
        lineNumber,
        agentAccount: normalizeSourceValue(row.agentAccount),
        customerId: normalizeNullableSourceValue(row.customerId),
        fullName: normalizeNullableSourceValue(row.fullName),
        mobileNumber: normalizeNullableSourceValue(row.mobileNumber),
      });
    }
  }

  return references;
}

export async function fetchSourceAgentMetricRows(params: {
  lineNumbers: string[];
  dateFrom: Date;
  dateTo: Date;
}): Promise<SourceAgentMetricRow[]> {
  const normalizedLineNumbers = Array.from(
    new Set(
      params.lineNumbers
        .map((lineNumber) => lineNumber.trim())
        .filter((lineNumber) => lineNumber.length > 0),
    ),
  );

  if (normalizedLineNumbers.length === 0 || !isSourceMetricsConfigured()) {
    return [];
  }

  const pool = await getPool();
  const { schema, table } = getSourceSummaryTable();
  const matchColumnSql = getMatchColumnSql();
  const importedRows: SourceAgentMetricRow[] = [];

  for (const batch of chunkValues(normalizedLineNumbers, PARAM_BATCH_SIZE)) {
    const request = pool.request();
    request.input("dateFrom", sql.Date, params.dateFrom);
    request.input("dateTo", sql.Date, params.dateTo);

    const inClause = buildInClause(request, batch, "line");
    const query = `
      SELECT
        CAST([date_id] AS DATE) AS metricDate,
        LTRIM(RTRIM(CAST(${matchColumnSql} AS VARCHAR(120)))) AS lineNumber,
        MAX(LTRIM(RTRIM(CAST([agent_account] AS VARCHAR(120))))) AS agentAccount,
        MAX(NULLIF(LTRIM(RTRIM(CAST([customer_id] AS VARCHAR(120)))), '')) AS customerId,
        MAX(NULLIF(LTRIM(RTRIM(CAST([full_name] AS VARCHAR(255)))), '')) AS fullName,
        SUM(COALESCE([number_of_deposits], 0)) AS cashInVolume,
        SUM(COALESCE([value_of_deposits], 0)) AS cashInValue,
        SUM(COALESCE([number_of_withdrawals], 0)) AS cashOutVolume,
        SUM(COALESCE([value_of_withdrawals], 0)) AS cashOutValue
      FROM [${schema}].[${table}]
      WHERE [date_id] >= @dateFrom
        AND [date_id] <= @dateTo
        AND ${matchColumnSql} IN (${inClause})
      GROUP BY
        CAST([date_id] AS DATE),
        LTRIM(RTRIM(CAST(${matchColumnSql} AS VARCHAR(120))))
      ORDER BY
        CAST([date_id] AS DATE) ASC,
        LTRIM(RTRIM(CAST(${matchColumnSql} AS VARCHAR(120)))) ASC
    `;

    const result = await request.query(query);
    for (const row of result.recordset as Array<Record<string, unknown>>) {
      const lineNumber = normalizeSourceValue(row.lineNumber);
      if (!lineNumber) {
        continue;
      }

      importedRows.push({
        metricDate: normalizeDateOnly(row.metricDate),
        lineNumber,
        agentAccount: normalizeSourceValue(row.agentAccount),
        customerId: normalizeNullableSourceValue(row.customerId),
        fullName: normalizeNullableSourceValue(row.fullName),
        cashInVolume: Math.max(0, Math.trunc(toNumericValue(row.cashInVolume))),
        cashInValue: Math.max(0, toNumericValue(row.cashInValue)),
        cashOutVolume: Math.max(0, Math.trunc(toNumericValue(row.cashOutVolume))),
        cashOutValue: Math.max(0, toNumericValue(row.cashOutValue)),
      });
    }
  }

  return importedRows;
}
