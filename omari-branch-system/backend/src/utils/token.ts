import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@prisma/client";

const TOKEN_HEADER = {
  alg: "HS256",
  typ: "JWT",
} as const;

export type AuthTokenPayload = {
  sub: string;
  username: string;
  role: UserRole;
  iat: number;
  exp: number;
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
    (payload.role === "VIEWER" || payload.role === "FULL_ACCESS") &&
    typeof payload.iat === "number" &&
    Number.isFinite(payload.iat) &&
    typeof payload.exp === "number" &&
    Number.isFinite(payload.exp)
  );
}

export function createAuthToken(payload: AuthTokenPayload, secret: string): string {
  const encodedHeader = toBase64Url(JSON.stringify(TOKEN_HEADER));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
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
