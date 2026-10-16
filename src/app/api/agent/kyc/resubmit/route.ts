import { NextResponse } from "next/server";
import { currentAgent } from "@/lib/auth";
import { jsonError } from "@/lib/kyc";
import { parseForm, readFields, replaceRejected } from "@/lib/kyc-submit";
import { isRateLimited, recordEvent } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An agent re-uploading one of their own rejected entries. */
export async function POST(request: Request) {
  const agent = await currentAgent();
  if (!agent) return jsonError("Your session has ended. Sign in again.", 401);

  const bucket = `agent-submit:${agent.id}`;
  if (await isRateLimited(bucket, 120, 60)) {
    return jsonError("Too many uploads in the last hour. Try again a little later.", 429);
  }

  const form = await parseForm(request);
  if (form instanceof NextResponse) return form;

  const id = String(form.get("id") ?? "");
  if (!UUID.test(id)) return jsonError("Open the entry again before re-uploading.", 400);

  const fields = await readFields(form);
  if ("error" in fields) return fields.error;

  await recordEvent(bucket);

  const { data: row } = await db()
    .from("kyc_submissions")
    .select("id, status, attempts, file_path")
    .eq("id", id)
    .eq("agent_id", agent.id) // agents can only touch their own entries
    .maybeSingle();

  if (!row) return jsonError("This entry doesn't exist or isn't yours.", 404);
  return replaceRejected(row, fields);
}
