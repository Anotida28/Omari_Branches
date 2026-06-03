import type { NextFunction, Request, RequestHandler, Response } from "express";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { verifyAuthToken } from "../utils/token";
import { UserRole, isUserRole, type UserRole as UserRoleValue } from "../shared/prisma-enums";

type HttpError = Error & {
  status?: number;
};

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export type AuthenticatedRequestUser = {
  id: bigint;
  username: string;
  role: UserRoleValue;
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

    const payload = verifyAuthToken(token, env.JWT_SECRET);
    if (!payload || !/^[0-9]+$/.test(payload.sub)) {
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
      role: isUserRole(user.role) ? user.role : UserRole.VIEWER,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireSuperAdmin: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  if (!req.authUser) {
    next(toHttpError("Unauthorized", 401));
    return;
  }

  if (req.authUser.role !== UserRole.SUPER_ADMIN) {
    next(toHttpError("Forbidden: Super Admin access required", 403));
    return;
  }

  next();
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

  if (req.authUser.role !== UserRole.FULL_ACCESS && req.authUser.role !== UserRole.SUPER_ADMIN) {
    next(toHttpError("Forbidden", 403));
    return;
  }

  next();
};
