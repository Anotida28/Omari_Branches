import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
