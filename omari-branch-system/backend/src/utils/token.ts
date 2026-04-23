import { createHmac, timingSafeEqual } from "node:crypto";

import { UserRole, isUserRole, type UserRole as UserRoleValue } from "../shared/prisma-enums";

const TOKEN_HEADER = {
  alg: "HS256",
  typ: "JWT",
} as const;

export type AuthTokenPayload = {
  sub: string;
  username: string;
  role: UserRoleValue;
  iat: number;
  exp: number;
};

type BasePayload = {
  sub: string;
  username: string;
  role: string;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(value: string): string {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  return Buffer.from(padded, "base64").toString("utf8");
}

function sign(input: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(input)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseExpiresInToSeconds(expiresIn: string): number {
  const normalized = expiresIn.trim().toLowerCase();
  const match = /^(\d+)([smhd])$/.exec(normalized);
  if (!match) {
    return 8 * 60 * 60;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  if (!Number.isFinite(amount) || amount <= 0) {
    return 8 * 60 * 60;
  }

  if (unit === "s") {
    return amount;
  }
  if (unit === "m") {
    return amount * 60;
  }
  if (unit === "h") {
    return amount * 60 * 60;
  }
  if (unit === "d") {
    return amount * 24 * 60 * 60;
  }

  return 8 * 60 * 60;
}

function isValidPayload(value: unknown): value is AuthTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<AuthTokenPayload>;

  return (
    typeof payload.sub === "string" &&
    payload.sub.length > 0 &&
    typeof payload.username === "string" &&
    payload.username.length > 0 &&
    typeof payload.role === "string" &&
    isUserRole(payload.role) &&
    typeof payload.iat === "number" &&
    Number.isFinite(payload.iat) &&
    typeof payload.exp === "number" &&
    Number.isFinite(payload.exp)
  );
}

export function createAuthToken(payload: BasePayload, secret: string, expiresIn: string): string {
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const exp = issuedAtSeconds + parseExpiresInToSeconds(expiresIn);

  const normalizedRole = isUserRole(payload.role) ? payload.role : UserRole.VIEWER;
  const normalizedPayload: AuthTokenPayload = {
    sub: payload.sub,
    username: payload.username,
    role: normalizedRole,
    iat: issuedAtSeconds,
    exp,
  };

  const encodedHeader = toBase64Url(JSON.stringify(TOKEN_HEADER));
  const encodedPayload = toBase64Url(JSON.stringify(normalizedPayload));
  const input = `${encodedHeader}.${encodedPayload}`;
  const signature = sign(input, secret);

  return `${input}.${signature}`;
}

export function verifyAuthToken(token: string, secret: string): AuthTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return null;
  }

  const input = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = sign(input, secret);

  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(encodedSignature, "utf8");

  if (
    expectedBuffer.length !== receivedBuffer.length ||
    !timingSafeEqual(expectedBuffer, receivedBuffer)
  ) {
    return null;
  }

  try {
    const header = JSON.parse(fromBase64Url(encodedHeader)) as {
      alg?: string;
      typ?: string;
    };

    if (header.alg !== TOKEN_HEADER.alg || header.typ !== TOKEN_HEADER.typ) {
      return null;
    }

    const parsedPayload = JSON.parse(fromBase64Url(encodedPayload));
    if (!isValidPayload(parsedPayload)) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (parsedPayload.exp <= nowSeconds) {
      return null;
    }

    return parsedPayload;
  } catch {
    return null;
  }
}
