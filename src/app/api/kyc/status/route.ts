import { NextResponse } from "next/server";
import { jsonError } from "@/lib/kyc";
import { clientIp, isRateLimited, recordEvent } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";
import { mobileSchema, refCodeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const bucket = `status:${await clientIp()}`;
  if (await isRateLimited(bucket, 20, 15)) {
    return jsonError("Too many lookups. Wait 15 minutes and try again.", 429);
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ref = refCodeSchema.safeParse(String(body.ref ?? ""));
  if (!ref.success) return jsonError(ref.error.issues[0].message, 400, "ref");
  const mobile = mobileSchema.safeParse(String(body.mobile ?? ""));
  if (!mobile.success) return jsonError(mobile.error.issues[0].message, 400, "mobile");

  await recordEvent(bucket);

  const { data } = await db()
    .from("kyc_submissions")
    .select("ref_code, full_name, mobile, status, stage, slot_at, rejection_reason, attempts, submitted_at, reviewed_at")
    .eq("ref_code", ref.data)
    .eq("mobile", mobile.data)
    .maybeSingle();

  if (!data) {
    // Same message whether the ref or the mobile is wrong, so neither can be guessed separately.
    return jsonError("No KYC request matches that reference ID and mobile number.", 404);
  }

  return NextResponse.json({
    ok: true,
    submission: {
      refCode: data.ref_code,
      fullName: data.full_name,
      mobile: data.mobile,
      status: data.status,
      stage: data.stage,
      slotAt: data.slot_at,
      rejectionReason: data.rejection_reason,
      attempts: data.attempts,
      submittedAt: data.submitted_at,
      reviewedAt: data.reviewed_at,
    },
  });
}
