import { NextResponse } from "next/server";
import { jsonError } from "@/lib/kyc";
import { parseForm, readFields, replaceRejected } from "@/lib/kyc-submit";
import { clientIp, isRateLimited, recordEvent } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";
import { mobileSchema, refCodeSchema } from "@/lib/validation";

/**
 * Re-upload after a rejection, for individual customers. They prove it's their request
 * with reference ID + the mobile number on file, and may correct their name or number.
 * (Entries made by agents are re-uploaded by the agent from their own dashboard.)
 */
export async function POST(request: Request) {
  const bucket = `submit:${await clientIp()}`;
  if (await isRateLimited(bucket, 10, 60)) {
    return jsonError("Too many attempts from this network. Try again in an hour.", 429);
  }

  const form = await parseForm(request);
  if (form instanceof NextResponse) return form;

  const ref = refCodeSchema.safeParse(String(form.get("ref") ?? ""));
  const currentMobile = mobileSchema.safeParse(String(form.get("currentMobile") ?? ""));
  if (!ref.success || !currentMobile.success) {
    return jsonError("Look up your request again before re-uploading.", 400);
  }

  const fields = await readFields(form);
  if ("error" in fields) return fields.error;

  await recordEvent(bucket);

  const { data: row } = await db()
    .from("kyc_submissions")
    .select("id, status, attempts, file_path, agent_id")
    .eq("ref_code", ref.data)
    .eq("mobile", currentMobile.data)
    .maybeSingle();

  if (!row) return jsonError("No KYC request matches that reference ID and mobile number.", 404);
  if (row.agent_id) {
    return jsonError("This KYC was submitted by an agent. Ask your agent to re-upload it.", 409);
  }
  return replaceRejected(row, fields);
}
