import type { RequestHandler, Response } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { authenticateWithSharedAuth } from "../services/shared-auth.service";
import { createAuthToken } from "../utils/token";
import { verifyPassword } from "../utils/password";

const loginSchema = z
  .object({
    username: z.string().min(1, "Username is required").max(80),
    password: z.string().min(1, "Password is required").max(255),
  })
  .strict();

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function mapUser(user: { id: bigint; username: string; role: "VIEWER" | "FULL_ACCESS" }) {
  return {
    id: user.id.toString(),
    username: user.username,
    role: user.role,
  };
}

type AppUserForLogin = {
  id: bigint;
  username: string;
  role: "VIEWER" | "FULL_ACCESS";
  isActive: boolean;
  passwordHash: string;
};

function issueLoginResponse(res: Response, user: AppUserForLogin): void {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = issuedAtSeconds + env.AUTH_TOKEN_TTL_HOURS * 60 * 60;

  const token = createAuthToken(
    {
      sub: user.id.toString(),
      username: user.username,
      role: user.role,
      iat: issuedAtSeconds,
      exp: expiresAtSeconds,
    },
    env.AUTH_TOKEN_SECRET,
  );

  res.json({
    data: {
      token,
      expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
      user: mapUser(user),
    },
  });
}

export const loginHandler: RequestHandler = async (req, res, next) => {
  const parsedBody = loginSchema.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsedBody.error.flatten(),
    });
    return;
  }

  try {
    /**
     * Login flow:
     * 1. Shared auth API validates identity (local BA_Users / AD in shared system)
     * 2. Local Prisma User record determines authorization for THIS app
     * 3. If shared auth fails/unavailable, fallback to local password verification
     */
    const normalizedUsername = normalizeUsername(parsedBody.data.username);
    const sharedAuthResult = await authenticateWithSharedAuth(
      normalizedUsername,
      parsedBody.data.password,
    );

    const user = await prisma.user.findUnique({
      where: { username: normalizedUsername },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        passwordHash: true,
      },
    });

    if (sharedAuthResult.outcome === "authenticated") {
      // Shared auth proved identity, but local DB role decides app access.
      if (!user || !user.isActive) {
        res.status(403).json({
          error:
            "Authenticated identity is not authorized for this application. Contact an administrator to grant access.",
        });
        return;
      }

      issueLoginResponse(res, user);
      return;
    }

    if (sharedAuthResult.outcome === "unavailable") {
      console.warn(
        `[Auth] Shared authentication unavailable for "${normalizedUsername}". Falling back to local auth. Reason: ${sharedAuthResult.reason}`,
      );
    }

    // Shared auth rejected/disabled/unavailable -> local fallback users.
    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const isPasswordValid = verifyPassword(parsedBody.data.password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    issueLoginResponse(res, user);
  } catch (error) {
    next(error);
  }
};

export const getCurrentUserHandler: RequestHandler = async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({ data: mapUser(req.authUser) });
};

export const logoutHandler: RequestHandler = (_req, res) => {
  // Stateless bearer auth: client drops token, server returns no-op success.
  res.status(204).send();
};
