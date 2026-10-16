import { NextResponse } from "next/server";
import { currentAgent } from "@/lib/auth";
import { jsonError } from "@/lib/kyc";
import { createSubmission, parseForm, readFields } from "@/lib/kyc-submit";
import { isRateLimited, recordEvent } from "@/lib/rate-limit";

/** An agent submitting KYC for one of their customers. */
export async function POST(request: Request) {
  const agent = await currentAgent();
  if (!agent) return jsonError("Your session has ended. Sign in again.", 401);

  // Generous, but stops a stolen session from flooding storage.
  const bucket = `agent-submit:${agent.id}`;
  if (await isRateLimited(bucket, 120, 60)) {
    return jsonError("Too many uploads in the last hour. Try again a little later.", 429);
  }

  const form = await parseForm(request);
  if (form instanceof NextResponse) return form;

  const fields = await readFields(form);
  if ("error" in fields) return fields.error;

  await recordEvent(bucket);
  return createSubmission(fields, agent.id);
}
