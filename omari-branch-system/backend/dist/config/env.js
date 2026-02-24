"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
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
    EMAIL_FROM: zod_1.z.string().min(1, "EMAIL_FROM is required"),
    EMAIL_USER: zod_1.z.string().email("EMAIL_USER must be a valid email address"),
    EMAIL_APP_PASSWORD: zod_1.z.string().min(1, "EMAIL_APP_PASSWORD is required"),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
}
exports.env = parsed.data;
