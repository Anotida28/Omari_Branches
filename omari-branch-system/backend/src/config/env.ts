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

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
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
  EMAIL_PROVIDER: z.enum(["gmail"]).default("gmail"),
  EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address").default("noreply@example.com"),
  EMAIL_USER: z.string().email("EMAIL_USER must be a valid email address").default("noreply@example.com"),
  EMAIL_APP_PASSWORD: z.string().min(1).default("disabled"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${JSON.stringify(
      parsed.error.flatten().fieldErrors,
    )}`,
  );
}

export const env = parsed.data;
