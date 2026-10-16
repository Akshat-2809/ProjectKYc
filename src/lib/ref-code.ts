import "server-only";
import { randomInt } from "node:crypto";

// No 0/O/1/I/L so customers can read it out over the phone without confusion.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function newRefCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return `KYC-${code}`;
}
