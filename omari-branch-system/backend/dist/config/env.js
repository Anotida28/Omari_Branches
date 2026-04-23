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
    EMAIL_PROVIDER: zod_1.z.enum(["gmail"]).default("gmail"),
    EMAIL_FROM: zod_1.z.string().email("EMAIL_FROM must be a valid email address").default("noreply@example.com"),
    EMAIL_USER: zod_1.z.string().email("EMAIL_USER must be a valid email address").default("noreply@example.com"),
    EMAIL_APP_PASSWORD: zod_1.z.string().min(1).default("disabled"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}
exports.env = parsed.data;
