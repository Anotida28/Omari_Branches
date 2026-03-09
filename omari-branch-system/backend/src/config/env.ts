import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function normalizeOptionalString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

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
  AUTH_TOKEN_SECRET: z
    .string()
    .min(16, "AUTH_TOKEN_SECRET must be at least 16 characters")
    .default("omari-dev-auth-token-secret-change-me"),
  AUTH_TOKEN_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(24),
  EMAIL_PROVIDER: z.enum(["gmail"]).default("gmail"),
  EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address").default("noreply@example.com"),
  EMAIL_USER: z.string().email("EMAIL_USER must be a valid email address").default("noreply@example.com"),
  EMAIL_APP_PASSWORD: z.string().min(1).default("disabled"),
  SHARED_AUTH_URL: z.preprocess(
    normalizeOptionalString,
    z.string().url("SHARED_AUTH_URL must be a valid URL").optional(),
  ),
  SHARED_AUTH_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8000),
  SHARED_AUTH_ENABLED: z.preprocess(
    normalizeOptionalBoolean,
    z.boolean().default(true),
  ),
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
