import { Prisma } from "@prisma/client";
import { MulterError } from "multer";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

type HttpError = Error & {
  status?: number;
  details?: unknown;
};

function getErrorStatus(error: HttpError): number {
  const status = error.status;
  if (!status || !Number.isInteger(status) || status < 400 || status > 599) {
    return 500;
  }
  return status;
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (res.headersSent) {
    return;
  }

  if (error instanceof MulterError) {
    const details =
      error.code === "LIMIT_FILE_SIZE"
        ? "File exceeds maximum size of 10MB"
        : error.message;
    res.status(400).json({
      error: "Upload error",
      details,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation error",
      details: error.flatten(),
    });
    return;
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    res.status(409).json({
      error: "Conflict",
      details: {
        code: error.code,
        target: error.meta?.target,
      },
    });
    return;
  }

  if (
    error instanceof SyntaxError &&
    typeof (error as unknown as { message?: unknown }).message === "string" &&
    "body" in (error as unknown as object)
  ) {
    res.status(400).json({
      error: "Validation error",
      details: "Invalid JSON payload",
    });
    return;
  }

  const httpError = error as HttpError;
  const status = getErrorStatus(httpError);
  const payload: { error: string; details?: unknown } = {
    error:
      status >= 500
        ? "Internal server error"
        : httpError.message || "Request failed",
  };

  if (httpError.details !== undefined) {
    payload.details = httpError.details;
  }

  if (status >= 500) {
    console.error(error);
  }

  res.status(status).json(payload);
};
