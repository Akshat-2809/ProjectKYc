import "server-only";
import { NextResponse } from "next/server";
import { MAX_PDF_BYTES, STORAGE_BUCKET } from "./env";
import { db } from "./supabase";
import { looksLikePdf } from "./validation";

export function jsonError(message: string, status = 400, field?: string) {
  return NextResponse.json({ ok: false, error: message, field }, { status });
}

/** Validates the uploaded Aadhaar PDF and returns its bytes, or an error message. */
export async function readPdf(
  value: FormDataEntryValue | null,
): Promise<{ bytes: Uint8Array; size: number } | { error: string }> {
  if (!value || typeof value === "string" || value.size === 0) {
    return { error: "Upload your Aadhaar card as a PDF." };
  }
  if (value.size > MAX_PDF_BYTES) {
    return { error: "The PDF is larger than 4 MB. Compress it and upload again." };
  }
  const bytes = new Uint8Array(await value.arrayBuffer());
  if (!looksLikePdf(bytes)) {
    return { error: "That file isn't a PDF. Upload the Aadhaar PDF (e-Aadhaar or a scanned PDF)." };
  }
  return { bytes, size: value.size };
}

export async function storePdf(path: string, bytes: Uint8Array): Promise<string | null> {
  const { error } = await db()
    .storage.from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (error) {
    console.error("storage upload failed", error);
    return "We couldn't save your file. Try again in a minute.";
  }
  return null;
}

export async function removePdf(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await db().storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.error("storage remove failed", path, error);
}

/** Postgres unique-violation code. */
export const UNIQUE_VIOLATION = "23505";
