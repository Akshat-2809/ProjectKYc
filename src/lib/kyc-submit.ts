import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError, readPdf, removePdf, storePdf, UNIQUE_VIOLATION } from "./kyc";
import { newRefCode } from "./ref-code";
import { db } from "./supabase";
import { fullNameSchema, mobileSchema } from "./validation";

export async function parseForm(request: Request): Promise<FormData | NextResponse> {
  try {
    return await request.formData();
  } catch {
    return jsonError("The upload didn't come through. Check the file is under 4 MB and try again.");
  }
}

/** Validates name, mobile and PDF from the form. */
export async function readFields(form: FormData) {
  const name = fullNameSchema.safeParse(String(form.get("fullName") ?? ""));
  if (!name.success) return { error: jsonError(name.error.issues[0].message, 400, "fullName") };

  const mobile = mobileSchema.safeParse(String(form.get("mobile") ?? ""));
  if (!mobile.success) return { error: jsonError(mobile.error.issues[0].message, 400, "mobile") };

  const pdf = await readPdf(form.get("file"));
  if ("error" in pdf) return { error: jsonError(pdf.error, 400, "file") };

  return { fullName: name.data, mobile: mobile.data, pdf };
}

/**
 * Creates a new KYC submission for an agent's customer.
 * One KYC per mobile number across all agents.
 */
export async function createSubmission(
  fields: { fullName: string; mobile: string; pdf: { bytes: Uint8Array; size: number } },
  agentId: string,
): Promise<NextResponse> {
  const supabase = db();
  const duplicateMessage = "A KYC for this mobile number already exists. Search your list, or ask the admin.";

  const { data: existing } = await supabase
    .from("kyc_submissions")
    .select("id")
    .eq("mobile", fields.mobile)
    .maybeSingle();
  if (existing) return jsonError(duplicateMessage, 409, "mobile");

  const id = randomUUID();
  const filePath = `${id}/aadhaar-1.pdf`;
  const uploadError = await storePdf(filePath, fields.pdf.bytes);
  if (uploadError) return jsonError(uploadError, 500);

  // Retry once in the (very unlikely) case of a reference-code collision.
  for (let attempt = 0; attempt < 2; attempt++) {
    const refCode = newRefCode();
    const { error } = await supabase.from("kyc_submissions").insert({
      id,
      ref_code: refCode,
      full_name: fields.fullName,
      mobile: fields.mobile,
      file_path: filePath,
      file_size: fields.pdf.size,
      consent_at: new Date().toISOString(),
      agent_id: agentId,
    });

    if (!error) return NextResponse.json({ ok: true, refCode, id });

    if (error.code === UNIQUE_VIOLATION && error.message.includes("mobile")) {
      await removePdf(filePath);
      return jsonError(duplicateMessage, 409, "mobile");
    }
    if (error.code !== UNIQUE_VIOLATION) {
      console.error("insert failed", error);
      break;
    }
  }

  await removePdf(filePath);
  return jsonError("Something went wrong while saving the details. Try again.", 500);
}

/** Replaces the PDF (and name/mobile) on a rejected submission and moves it back to Pending. */
export async function replaceRejected(
  row: { id: string; status: string; attempts: number; file_path: string | null },
  fields: { fullName: string; mobile: string; pdf: { bytes: Uint8Array; size: number } },
): Promise<NextResponse> {
  if (row.status !== "rejected") {
    return jsonError(
      row.status === "pending" ? "These documents are already waiting for review." : "This KYC is already approved.",
      409,
    );
  }

  const supabase = db();
  const nextAttempt = row.attempts + 1;
  const filePath = `${row.id}/aadhaar-${nextAttempt}.pdf`;
  const uploadError = await storePdf(filePath, fields.pdf.bytes);
  if (uploadError) return jsonError(uploadError, 500);

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("kyc_submissions")
    .update({
      full_name: fields.fullName,
      mobile: fields.mobile,
      file_path: filePath,
      file_size: fields.pdf.size,
      status: "pending",
      rejection_reason: null,
      attempts: nextAttempt,
      consent_at: now,
      submitted_at: now,
      reviewed_at: null,
    })
    .eq("id", row.id)
    .eq("status", "rejected"); // guards against a double submit

  if (error) {
    await removePdf(filePath);
    if (error.code === UNIQUE_VIOLATION) {
      return jsonError("Another KYC already uses this mobile number.", 409, "mobile");
    }
    console.error("resubmit update failed", error);
    return jsonError("Something went wrong while saving the details. Try again.", 500);
  }

  await removePdf(row.file_path); // the rejected PDF is no longer needed
  return NextResponse.json({ ok: true, mobile: fields.mobile });
}
