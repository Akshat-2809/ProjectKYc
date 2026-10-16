import { NextResponse } from "next/server";
import { jsonError } from "@/lib/kyc";
import { createSubmission, parseForm, readFields } from "@/lib/kyc-submit";
import { clientIp, isRateLimited, recordEvent } from "@/lib/rate-limit";

/** Individual customers submitting their own KYC (no login). */
export async function POST(request: Request) {
  const bucket = `submit:${await clientIp()}`;
  if (await isRateLimited(bucket, 10, 60)) {
    return jsonError("Too many attempts from this network. Try again in an hour.", 429);
  }

  const form = await parseForm(request);
  if (form instanceof NextResponse) return form;

  const fields = await readFields(form);
  if ("error" in fields) return fields.error;

  await recordEvent(bucket);
  return createSubmission(fields, null);
}
