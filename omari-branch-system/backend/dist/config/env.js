"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
function normalizeOptionalString(value) {
    if (typeof value !== "string") {
        return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
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
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(["development", "test", "production"]).optional(),
    PORT: zod_1.z.coerce.number().int().positive().default(4000),
    DATABASE_URL: zod_1.z.string().min(1, "DATABASE_URL is required"),
    AUTH_TOKEN_SECRET: zod_1.z
        .string()
        .min(16, "AUTH_TOKEN_SECRET must be at least 16 characters")
        .default("omari-dev-auth-token-secret-change-me"),
    AUTH_TOKEN_TTL_HOURS: zod_1.z.coerce.number().int().min(1).max(24 * 30).default(24),
    EMAIL_PROVIDER: zod_1.z.enum(["gmail"]).default("gmail"),
    EMAIL_FROM: zod_1.z.string().email("EMAIL_FROM must be a valid email address").default("noreply@example.com"),
    EMAIL_USER: zod_1.z.string().email("EMAIL_USER must be a valid email address").default("noreply@example.com"),
    EMAIL_APP_PASSWORD: zod_1.z.string().min(1).default("disabled"),
    SHARED_AUTH_URL: zod_1.z.preprocess(normalizeOptionalString, zod_1.z.string().url("SHARED_AUTH_URL must be a valid URL").optional()),
    SHARED_AUTH_TIMEOUT_MS: zod_1.z.coerce.number().int().min(500).max(60000).default(8000),
    SHARED_AUTH_ENABLED: zod_1.z.preprocess(normalizeOptionalBoolean, zod_1.z.boolean().default(true)),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}
exports.env = parsed.data;
