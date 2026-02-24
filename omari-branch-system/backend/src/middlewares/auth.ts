import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { UserRole } from "@prisma/client";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { verifyAuthToken } from "../utils/token";

type HttpError = Error & {
  status?: number;
};

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type AuthenticatedRequestUser = {
  id: bigint;
  username: string;
  role: UserRole;
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

function readBearerToken(req: Request): string | null {
  const authorization = normalizeHeaderValue(req.headers.authorization)?.trim();
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  const normalizedToken = token.trim();
  return normalizedToken || null;
}

export const requireAuthenticatedUser: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = readBearerToken(req);
    if (!token) {
      next(toHttpError("Unauthorized", 401));
      return;
    }

    const payload = verifyAuthToken(token, env.AUTH_TOKEN_SECRET);
    if (!payload || !/^\d+$/.test(payload.sub)) {
      next(toHttpError("Unauthorized", 401));
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: BigInt(payload.sub) },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      next(toHttpError("Unauthorized", 401));
      return;
    }

    req.authUser = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireWriteAccess: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (READ_ONLY_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  if (!req.authUser) {
    next(toHttpError("Unauthorized", 401));
    return;
  }

  if (req.authUser.role !== "FULL_ACCESS") {
    next(toHttpError("Forbidden", 403));
    return;
  }

  next();
};
