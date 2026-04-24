"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
function normalizeOptionalBoolean(value) {
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
function normalizeOptionalString(value) {
    if (typeof value !== "string") {
        return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).optional(),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    ACCESS_GATEWAY_ENABLED: zod_1.z.preprocess(normalizeOptionalBoolean, zod_1.z.boolean().default(true)),
    AUTH_EXTERNAL_URL: zod_1.z.string().url().default("http://180.10.1.222:3002/authenticate/login"),
    AUTH_EXTERNAL_TIMEOUT_MS: zod_1.z.coerce.number().int().min(500).max(60000).default(8000),
    ACCESS_GATEWAY_BASE_URL: zod_1.z.string().url().default("http://172.16.3.21:3003"),
    ACCESS_GATEWAY_TIMEOUT_MS: zod_1.z.coerce.number().int().min(500).max(60000).default(8000),
    JWT_SECRET: zod_1.z
        .string()
        .min(16, "JWT_SECRET must be at least 16 characters")
        .default("change-this-jwt-secret-in-production"),
    JWT_EXPIRES_IN: zod_1.z.string().min(2).default("8h"),
    SUPER_ADMIN_USERNAMES: zod_1.z.string().default(""),
    EMAIL_PROVIDER: zod_1.z.enum(["bulkmailer", "gmail"]).default("bulkmailer"),
    EMAIL_FROM: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().email("EMAIL_FROM must be a valid email address").optional()),
    EMAIL_USER: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().email("EMAIL_USER must be a valid email address").optional()),
    EMAIL_APP_PASSWORD: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    BULK_MAILER_BASE_URL: zod_1.z
        .string()
        .url("BULK_MAILER_BASE_URL must be a valid URL")
        .default("https://bulkmailer-nlb-8d1146c95f851bda.elb.eu-west-1.amazonaws.com"),
    BULK_MAILER_SEND_PATH: zod_1.z.string().min(1).default("/mail/send-email-single"),
    BULK_MAILER_FROM: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().email("BULK_MAILER_FROM must be a valid email address").optional()),
    BULK_MAILER_AUTH_TOKEN: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    BULK_MAILER_TIMEOUT_MS: zod_1.z.coerce.number().int().min(1000).max(120000).default(15000),
    BULK_MAILER_TRUST_SERVER_CERTIFICATE: zod_1.z.preprocess(normalizeOptionalBoolean, zod_1.z.boolean().default(true)),
    SOURCE_SQL_SERVER: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    SOURCE_SQL_PORT: zod_1.z.coerce.number().int().min(1).max(65535).default(1433),
    SOURCE_SQL_DATABASE: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    SOURCE_SQL_TLS_SERVER_NAME: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    SOURCE_SQL_USER: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    SOURCE_SQL_PASSWORD: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().min(1).optional()),
    SOURCE_SQL_ENCRYPT: zod_1.z.preprocess(normalizeOptionalBoolean, zod_1.z.boolean().default(true)),
    SOURCE_SQL_TRUST_SERVER_CERTIFICATE: zod_1.z.preprocess(normalizeOptionalBoolean, zod_1.z.boolean().default(true)),
    SOURCE_SQL_CONNECT_TIMEOUT_MS: zod_1.z.coerce.number().int().min(1000).max(120000).default(15000),
    SOURCE_SQL_REQUEST_TIMEOUT_MS: zod_1.z.coerce.number().int().min(1000).max(120000).default(30000),
    SOURCE_SQL_AGENT_SUMMARY_TABLE: zod_1.z
        .string()
        .regex(/^[A-Za-z0-9_]+\.[A-Za-z0-9_]+$/, "SOURCE_SQL_AGENT_SUMMARY_TABLE must be schema.table")
        .default("reporting.omari_agent_summary_since_launch_daily"),
    SOURCE_SQL_AGENT_LINE_MATCH_COLUMN: zod_1.z
        .enum(["agent_account", "customer_id"])
        .default("agent_account"),
    SOURCE_SQL_SYNC_ENABLED: zod_1.z.preprocess(normalizeOptionalBoolean, zod_1.z.boolean().default(false)),
    SOURCE_SQL_SYNC_CRON: zod_1.z.string().min(5).default("15 7 * * *"),
    SOURCE_SQL_SYNC_LOOKBACK_DAYS: zod_1.z.coerce.number().int().min(1).max(30).default(2),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}
const config = parsed.data;
if (config.EMAIL_PROVIDER === "gmail") {
    if (!config.EMAIL_FROM || !config.EMAIL_USER || !config.EMAIL_APP_PASSWORD) {
        throw new Error("Invalid environment configuration: EMAIL_FROM, EMAIL_USER, and EMAIL_APP_PASSWORD are required when EMAIL_PROVIDER=gmail");
    }
}
if (config.EMAIL_PROVIDER === "bulkmailer" && !config.BULK_MAILER_FROM) {
    throw new Error("Invalid environment configuration: BULK_MAILER_FROM is required when EMAIL_PROVIDER=bulkmailer");
}
exports.env = config;
