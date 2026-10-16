import { z } from "zod";

/** Accepts "98765 43210", "+91 98765-43210", "09876543210" → "9876543210". */
export function normalizeMobile(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export const mobileSchema = z
  .string()
  .transform(normalizeMobile)
  .refine((v) => /^[6-9]\d{9}$/.test(v), {
    message: "Enter a valid 10-digit Indian mobile number.",
  });

export const fullNameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .refine((v) => v.length >= 2 && v.length <= 100, {
    message: "Enter the customer's full name as printed on their Aadhaar card.",
  })
  .refine((v) => /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(v), {
    message: "Name can only contain letters, spaces, dots, hyphens and apostrophes.",
  });

export const refCodeSchema = z
  .string()
  .transform((v) => v.trim().toUpperCase().replace(/\s/g, ""))
  .transform((v) => (v.startsWith("KYC-") ? v : `KYC-${v}`))
  .refine((v) => /^KYC-[A-Z0-9]{8}$/.test(v), {
    message: "Reference ID looks like KYC-7F3K9QX2.",
  });

export const rejectionReasonSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length >= 5 && v.length <= 500, {
    message: "Write a reason of at least 5 characters so the agent knows what to fix.",
  });

/** Checks the file really is a PDF by its first bytes, not just its name. */
export function looksLikePdf(bytes: Uint8Array): boolean {
  // "%PDF-"
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** Shows only the last 4 digits: 98765 43210 → ••••••3210 */
export function maskMobile(mobile: string): string {
  return `••••••${mobile.slice(-4)}`;
}
