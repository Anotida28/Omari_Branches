import type { NextFunction, Request, RequestHandler, Response } from "express";
import { z } from "zod";

import { validateRequest } from "./validate";

const apiKeyHeaderSchema = z
  .object({
    "x-api-key": z.union([z.string(), z.array(z.string())]).optional(),
  })
  .passthrough();

type HttpError = Error & {
  status?: number;
};

function toHttpError(message: string, status: number): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return null;
}

export const validateApiKeyHeader: RequestHandler = validateRequest({
  headers: apiKeyHeaderSchema,
});

export function requireApiKey(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const expectedApiKey = process.env.API_KEY?.trim();
  if (!expectedApiKey) {
    next(toHttpError("API key is not configured", 500));
    return;
  }

  const providedApiKey = normalizeHeaderValue(req.headers["x-api-key"]);
  if (!providedApiKey || providedApiKey.trim() !== expectedApiKey) {
    next(toHttpError("Unauthorized", 401));
    return;
  }

  next();
}
