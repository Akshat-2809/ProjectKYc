import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Verifies a password against a hash made by `npm run hash-password`.
 * Format: "scrypt:<salt hex>:<hash hex>". Only hex characters, so it is safe
 * to paste into .env files and Vercel without escaping.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split(":");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Hashes a password in the same format, for agent accounts created in the admin panel. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** A real hash of a random value, compared against when the phone number is unknown,
 *  so a wrong phone takes as long as a wrong password (no account probing by timing). */
export const DUMMY_HASH =
  "scrypt:00000000000000000000000000000000:" + "0".repeat(128);

/** Constant-time string comparison (used for the admin phone number). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
