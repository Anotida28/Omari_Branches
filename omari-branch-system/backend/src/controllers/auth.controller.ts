import type { RequestHandler } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
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
    const normalizedUsername = normalizeUsername(parsedBody.data.username);

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

    if (!user || !user.isActive) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    const isPasswordValid = verifyPassword(parsedBody.data.password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

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
