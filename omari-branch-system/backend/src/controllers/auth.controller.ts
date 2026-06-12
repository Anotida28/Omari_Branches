import type { RequestHandler } from "express";
import { z } from "zod";

import { env } from "../config/env";
import { prisma } from "../db/prisma";
import { createAuthToken } from "../utils/token";
import { UserRole, isUserRole, type UserRole as UserRoleValue } from "../shared/prisma-enums";

const loginSchema = z
  .object({
    username: z.string().min(1, "Username is required").max(80),
    password: z.string().min(1, "Password is required").max(255),
  })
  .strict();

function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function isSuperAdminUsername(username: string): boolean {
  const usernames = parseCsv(env.SUPER_ADMIN_USERNAMES);
  return usernames.includes(normalizeUsername(username));
}

function pickRole(existingRole: string | null | undefined, username: string, isNewExternalUser: boolean): UserRoleValue {
  if (isSuperAdminUsername(username)) {
    return UserRole.SUPER_ADMIN;
  }

  if (isNewExternalUser) {
    return UserRole.VIEWER;
  }

  if (existingRole && isUserRole(existingRole)) {
    return existingRole;
  }

  return UserRole.VIEWER;
}

function isStatusSuccess(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const root = payload as Record<string, unknown>;
  const status = typeof root.status === "string" ? root.status.trim().toLowerCase() : null;
  return status === "success";
}

function payloadContainsUsername(payload: unknown, username: string): boolean {
  const target = normalizeUsername(username);

  function walk(node: unknown): boolean {
    if (node === null || node === undefined) {
      return false;
    }

    if (typeof node === "string") {
      return normalizeUsername(node) === target;
    }

    if (Array.isArray(node)) {
      return node.some((item) => walk(item));
    }

    if (typeof node === "object") {
      const record = node as Record<string, unknown>;
      const usernameValue = record.username;
      if (typeof usernameValue === "string" && normalizeUsername(usernameValue) === target) {
        return true;
      }

      return Object.values(record).some((value) => walk(value));
    }

    return false;
  }

  return walk(payload);
}

async function tryReadJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

type ExternalAuthResult =
  | { outcome: "authenticated" }
  | { outcome: "invalid"; message: string }
  | { outcome: "unavailable"; message: string };

type AccessGatewayResult =
  | { outcome: "authorized"; name?: string }
  | { outcome: "forbidden"; message: string }
  | { outcome: "unavailable"; message: string };

type AuthFlowError = Error & {
  status: number;
};

function readMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;
  return typeof root.message === "string" && root.message.trim().length > 0
    ? root.message.trim()
    : null;
}

async function callExternalAuth(username: string, password: string): Promise<ExternalAuthResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AUTH_EXTERNAL_TIMEOUT_MS);

  try {
    const response = await fetch(env.AUTH_EXTERNAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data: { username, password } }),
      signal: controller.signal,
    });

    const payload = await tryReadJson(response);
    if (response.ok && isStatusSuccess(payload)) {
      return { outcome: "authenticated" };
    }

    if (response.status >= 500) {
      return {
        outcome: "unavailable",
        message: readMessage(payload) ?? "Authentication service is currently unavailable",
      };
    }

    return {
      outcome: "invalid",
      message: readMessage(payload) ?? "Invalid username or password",
    };
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return {
        outcome: "unavailable",
        message: `Authentication service timed out after ${env.AUTH_EXTERNAL_TIMEOUT_MS}ms`,
      };
    }

    return {
      outcome: "unavailable",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractNameFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;

  function walk(node: unknown): string | undefined {
    if (!node || typeof node !== "object" || Array.isArray(node)) return undefined;
    const record = node as Record<string, unknown>;

    for (const key of ["fullName", "full_name", "displayName", "display_name", "name"]) {
      if (typeof record[key] === "string" && (record[key] as string).trim()) {
        return (record[key] as string).trim();
      }
    }

    if (typeof record.firstName === "string" && typeof record.lastName === "string") {
      const full = `${record.firstName.trim()} ${record.lastName.trim()}`.trim();
      if (full) return full;
    }
    if (typeof record.first_name === "string" && typeof record.last_name === "string") {
      const full = `${record.first_name.trim()} ${record.last_name.trim()}`.trim();
      if (full) return full;
    }

    for (const value of Object.values(record)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const found = walk(value);
        if (found) return found;
      }
    }

    return undefined;
  }

  return walk(payload);
}

async function verifyGatewayAccess(username: string): Promise<AccessGatewayResult> {
  if (!env.ACCESS_GATEWAY_ENABLED) {
    return { outcome: "authorized" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ACCESS_GATEWAY_TIMEOUT_MS);

  try {
    const url = `${env.ACCESS_GATEWAY_BASE_URL.replace(/\/$/, "")}/get/users/${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status >= 500) {
        return {
          outcome: "unavailable",
          message: "Access gateway is currently unavailable",
        };
      }

      return {
        outcome: "forbidden",
        message: "User not authorized by access gateway",
      };
    }

    const payload = await tryReadJson(response);
    return payloadContainsUsername(payload, username)
      ? { outcome: "authorized", name: extractNameFromPayload(payload) }
      : { outcome: "forbidden", message: "User not authorized by access gateway" };
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return {
        outcome: "unavailable",
        message: `Access gateway timed out after ${env.ACCESS_GATEWAY_TIMEOUT_MS}ms`,
      };
    }

    return {
      outcome: "unavailable",
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function upsertAuthenticatedUser(username: string): Promise<{ id: bigint; username: string; role: string }> {
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser && !existingUser.isActive) {
    const error = new Error("Your account has been disabled for this application.") as AuthFlowError;
    error.status = 403;
    throw error;
  }

  const role = pickRole(existingUser?.role, username, !existingUser);

  if (existingUser) {
    return prisma.user.update({
      where: { id: existingUser.id },
      data: {
        role,
      },
    });
  }

  return prisma.user.create({
    data: {
      username,
      role,
      isActive: true,
    },
  });
}

function issueLoginSuccess(
  res: Parameters<RequestHandler>[1],
  user: { id: bigint; username: string; role: string },
  name?: string,
) {
  const role = isUserRole(user.role) ? user.role : UserRole.VIEWER;
  const token = createAuthToken(
    {
      sub: user.id.toString(),
      username: user.username,
      role,
      ...(name ? { name } : {}),
    },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN,
  );

  res.json({
    status: "success",
    message: "Login successful",
    accessToken: token,
    tokenType: "Bearer",
    user: {
      username: user.username,
      role,
      ...(name ? { name } : {}),
      lastLogin: new Date().toISOString(),
    },
  });
}

export const loginHandler: RequestHandler = async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      status: "error",
      message: "Validation error",
      details: parsed.error.flatten(),
    });
    return;
  }

  const normalizedUsername = normalizeUsername(parsed.data.username);
  const password = parsed.data.password;

  try {
    const external = await callExternalAuth(normalizedUsername, password);

    if (external.outcome === "unavailable") {
      res.status(502).json({
        status: "error",
        message: external.message,
      });
      return;
    }

    if (external.outcome === "invalid") {
      res.status(401).json({
        status: "error",
        message: external.message,
      });
      return;
    }

    const access = await verifyGatewayAccess(normalizedUsername);
    if (access.outcome === "unavailable") {
      res.status(502).json({
        status: "error",
        message: access.message,
      });
      return;
    }

    if (access.outcome === "forbidden") {
      res.status(403).json({
        status: "error",
        message: access.message,
      });
      return;
    }

    const user = await upsertAuthenticatedUser(normalizedUsername);
    issueLoginSuccess(res, user, access.name);
  } catch (error) {
    if (typeof (error as Partial<AuthFlowError>).status === "number" && error instanceof Error) {
      res.status((error as AuthFlowError).status).json({
        status: "error",
        message: error.message,
      });
      return;
    }

    next(error);
  }
};

export const getCurrentUserHandler: RequestHandler = async (req, res) => {
  if (!req.authUser) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.json({
    data: {
      id: req.authUser.id.toString(),
      username: req.authUser.username,
      role: req.authUser.role,
      ...(req.authUser.name ? { name: req.authUser.name } : {}),
    },
  });
};

export const logoutHandler: RequestHandler = (_req, res) => {
  // Stateless bearer auth: client drops token, server returns no-op success.
  res.status(204).send();
};
