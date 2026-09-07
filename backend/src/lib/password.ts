import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

/** scrypt hash as `salt:hex`. Enough to discuss, not a bank IdP. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

/** Constant-time compare so a mismatch does not leak hash length. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const separator = stored.indexOf(":");
  if (separator <= 0) return false;

  const salt = stored.slice(0, separator);
  const hash = stored.slice(separator + 1);
  const storedBuf = Buffer.from(hash, "hex");
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}
