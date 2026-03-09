import { env } from "../config/env";

type SharedAuthBody = {
  data: {
    username: string;
    password: string;
  };
};

type SharedAuthResult =
  | { outcome: "authenticated"; source: string | null }
  | { outcome: "rejected" }
  | { outcome: "unavailable"; reason: string }
  | { outcome: "disabled" };

const SUCCESS_STATUS_VALUES = new Set([
  "ok",
  "success",
  "authenticated",
  "authorized",
]);

const FAILURE_STATUS_VALUES = new Set([
  "error",
  "failed",
  "failure",
  "unauthorized",
  "forbidden",
  "invalid_credentials",
]);

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readNestedObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  return value as Record<string, unknown>;
}

function inferAuthSuccess(payload: unknown): boolean | null {
  const root = readNestedObject(payload);
  if (!root) {
    return null;
  }

  const data = readNestedObject(root.data);
  const candidateBooleans: unknown[] = [
    root.authenticated,
    root.isAuthenticated,
    root.success,
    root.ok,
    data?.authenticated,
    data?.isAuthenticated,
    data?.success,
    data?.ok,
  ];

  for (const candidate of candidateBooleans) {
    if (typeof candidate === "boolean") {
      return candidate;
    }
  }

  const candidateStatusValues: unknown[] = [
    root.status,
    root.result,
    data?.status,
    data?.result,
  ];

  for (const candidate of candidateStatusValues) {
    const statusValue = readString(candidate)?.toLowerCase();
    if (!statusValue) {
      continue;
    }
    if (SUCCESS_STATUS_VALUES.has(statusValue)) {
      return true;
    }
    if (FAILURE_STATUS_VALUES.has(statusValue)) {
      return false;
    }
  }

  return null;
}

function extractAuthSource(payload: unknown): string | null {
  const root = readNestedObject(payload);
  if (!root) {
    return null;
  }

  const data = readNestedObject(root.data);
  return readString(data?.source) ?? readString(root.source);
}

async function tryReadJson(response: Response): Promise<unknown> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/**
 * Shared auth = identity provider.
 * This function does not grant app access by itself. Authorization stays in local DB.
 */
export async function authenticateWithSharedAuth(
  username: string,
  password: string,
): Promise<SharedAuthResult> {
  if (!env.SHARED_AUTH_ENABLED || !env.SHARED_AUTH_URL) {
    return { outcome: "disabled" };
  }

  const requestBody: SharedAuthBody = {
    data: {
      username,
      password,
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.SHARED_AUTH_TIMEOUT_MS);

  try {
    const response = await fetch(env.SHARED_AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) {
      return { outcome: "rejected" };
    }

    if (response.status >= 400 && response.status < 500) {
      return { outcome: "rejected" };
    }

    if (response.status >= 500) {
      return {
        outcome: "unavailable",
        reason: `Shared auth API responded with status ${response.status}`,
      };
    }

    const payload = await tryReadJson(response);
    const inferredSuccess = inferAuthSuccess(payload);

    if (inferredSuccess === false) {
      return { outcome: "rejected" };
    }

    if (inferredSuccess === true || response.ok) {
      return {
        outcome: "authenticated",
        source: extractAuthSource(payload),
      };
    }

    return { outcome: "rejected" };
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return {
        outcome: "unavailable",
        reason: `Shared auth request timed out after ${env.SHARED_AUTH_TIMEOUT_MS}ms`,
      };
    }

    const reason = error instanceof Error ? error.message : String(error);
    return {
      outcome: "unavailable",
      reason,
    };
  } finally {
    clearTimeout(timeout);
  }
}

