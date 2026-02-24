import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const HASH_PREFIX = "scrypt";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

export function hashPassword(password: string): string {
  if (!password) {
    throw new Error("Password is required");
  }

  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELIZATION,
  });

  return `${HASH_PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }

  const parts = storedHash.split("$");
  if (parts.length !== 3) {
    return false;
  }

  const [prefix, saltHex, hashHex] = parts;
  if (prefix !== HASH_PREFIX || !saltHex || !hashHex) {
    return false;
  }

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expectedHash = Buffer.from(hashHex, "hex");
    const candidateHash = scryptSync(password, salt, expectedHash.length, {
      N: COST,
      r: BLOCK_SIZE,
      p: PARALLELIZATION,
    });

    if (candidateHash.length !== expectedHash.length) {
      return false;
    }

    return timingSafeEqual(candidateHash, expectedHash);
  } catch {
    return false;
  }
}
