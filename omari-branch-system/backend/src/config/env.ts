import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  API_KEY: z.string().min(1, "API_KEY is required"),
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
