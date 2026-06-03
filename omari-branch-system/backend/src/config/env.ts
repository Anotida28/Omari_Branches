import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function normalizeOptionalBoolean(value: unknown): unknown {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return value;
}

function normalizeOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.preprocess(
    normalizeOptionalString,
    z.string().url().optional(),
  ),
  ACCESS_GATEWAY_ENABLED: z.preprocess(
    normalizeOptionalBoolean,
    z.boolean().default(true),
  ),
  AUTH_EXTERNAL_URL: z.string().url().default("http://180.10.1.222:3002/authenticate/login"),
  AUTH_EXTERNAL_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8000),
  ACCESS_GATEWAY_BASE_URL: z.string().url().default("http://172.16.3.21:3003"),
  ACCESS_GATEWAY_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8000),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters")
    .default("change-this-jwt-secret-in-production"),
  JWT_EXPIRES_IN: z.string().min(2).default("8h"),
  SUPER_ADMIN_USERNAMES: z.string().default(""),
  EMAIL_PROVIDER: z.enum(["bulkmailer", "gmail"]).default("bulkmailer"),
  EMAIL_FROM: z.preprocess(
    normalizeOptionalString,
    z.string().email("EMAIL_FROM must be a valid email address").optional(),
  ),
  EMAIL_USER: z.preprocess(
    normalizeOptionalString,
    z.string().email("EMAIL_USER must be a valid email address").optional(),
  ),
  EMAIL_APP_PASSWORD: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  BULK_MAILER_BASE_URL: z
    .string()
    .url("BULK_MAILER_BASE_URL must be a valid URL")
    .default("https://bulkmailer-nlb-8d1146c95f851bda.elb.eu-west-1.amazonaws.com"),
  BULK_MAILER_SEND_PATH: z.string().min(1).default("/mail/send-email-single"),
  BULK_MAILER_FROM: z.preprocess(
    normalizeOptionalString,
    z.string().email("BULK_MAILER_FROM must be a valid email address").optional(),
  ),
  BULK_MAILER_AUTH_TOKEN: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  BULK_MAILER_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15000),
  BULK_MAILER_TRUST_SERVER_CERTIFICATE: z.preprocess(
    normalizeOptionalBoolean,
    z.boolean().default(true),
  ),
  SOURCE_SQL_SERVER: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  SOURCE_SQL_PORT: z.coerce.number().int().min(1).max(65535).default(1433),
  SOURCE_SQL_DATABASE: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  SOURCE_SQL_TLS_SERVER_NAME: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  SOURCE_SQL_USER: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  SOURCE_SQL_PASSWORD: z.preprocess(
    normalizeOptionalString,
    z.string().min(1).optional(),
  ),
  SOURCE_SQL_ENCRYPT: z.preprocess(
    normalizeOptionalBoolean,
    z.boolean().default(true),
  ),
  SOURCE_SQL_TRUST_SERVER_CERTIFICATE: z.preprocess(
    normalizeOptionalBoolean,
    z.boolean().default(true),
  ),
  SOURCE_SQL_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(15000),
  SOURCE_SQL_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30000),
  SOURCE_SQL_AGENT_SUMMARY_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_AGENT_SUMMARY_TABLE must be schema.table")
    .default("reporting.omari_agent_summary_since_launch_daily"),
  SOURCE_SQL_AGENT_BALANCE_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_AGENT_BALANCE_TABLE must be schema.table")
    .default("reporting.omari_account_balances_usd"),
  SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE: z
    .string()
    .regex(
      /^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/,
      "SOURCE_SQL_AGENT_BALANCE_CURRENT_TABLE must be schema.table",
    )
    .default("reporting.omari_account_balances_usd_current"),
  SOURCE_SQL_AGENT_LINE_MATCH_COLUMN: z
    .enum(["agent_account", "customer_id"])
    .default("agent_account"),
  SOURCE_SQL_TRANSACTIONS_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_TRANSACTIONS_TABLE must be schema.table")
    .default("reporting.transactions_aggregate"),
  SOURCE_SQL_CUSTOMER_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_CUSTOMER_TABLE must be schema.table")
    .default("reporting.dim_customer"),
  SOURCE_SQL_USD_ACCOUNTS_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_USD_ACCOUNTS_TABLE must be schema.table")
    .default("reporting.df_usd_accounts"),
  SOURCE_SQL_ZWL_ACCOUNTS_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_ZWL_ACCOUNTS_TABLE must be schema.table")
    .default("reporting.df_zwl_accounts"),
  SOURCE_SQL_USD_BALANCE_CURRENT_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_USD_BALANCE_CURRENT_TABLE must be schema.table")
    .default("reporting.omari_account_balances_usd_current"),
  SOURCE_SQL_ZWL_BALANCE_TABLE: z
    .string()
    .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_ZWL_BALANCE_TABLE must be schema.table")
    .default("reporting.omari_account_balances_zwl"),
  SOURCE_SQL_SYNC_ENABLED: z.preprocess(
    normalizeOptionalBoolean,
    z.boolean().default(false),
  ),
  SOURCE_SQL_SYNC_CRON: z.string().min(5).default("15 7 * * *"),
  SOURCE_SQL_SYNC_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(30).default(2),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(
      parsed.error.flatten().fieldErrors,
    )}`,
  );
}

const config = parsed.data;

if (config.EMAIL_PROVIDER === "gmail") {
  if (!config.EMAIL_FROM || !config.EMAIL_USER || !config.EMAIL_APP_PASSWORD) {
    throw new Error(
      "Invalid environment configuration: EMAIL_FROM, EMAIL_USER, and EMAIL_APP_PASSWORD are required when EMAIL_PROVIDER=gmail",
    );
  }
}

if (config.EMAIL_PROVIDER === "bulkmailer" && !config.BULK_MAILER_FROM) {
  throw new Error(
    "Invalid environment configuration: BULK_MAILER_FROM is required when EMAIL_PROVIDER=bulkmailer",
  );
}

export const env = config;
