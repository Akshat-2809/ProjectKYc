"use server";

import { refresh } from "next/cache";
import { requireAgent, startAgentSession } from "@/lib/auth";
import * as steps from "@/lib/stage-ops";
import { UNDO_MINUTES } from "@/lib/stages";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { clearBucket, clientIp, isRateLimited, recordEvent } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";
import { UNIQUE_VIOLATION } from "@/lib/kyc";
import { fullNameSchema, mobileSchema, normalizeMobile } from "@/lib/validation";
import type { LoginState } from "@/components/shared/LoginForm";

export async function agentLogin(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const bucket = `agent-login:${await clientIp()}`;
  if (await isRateLimited(bucket, 8, 15)) {
    return { error: "Too many wrong attempts. Wait 15 minutes and try again.", at: Date.now() };
  }

  const phone = normalizeMobile(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");

  const supabase = db();
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, password_hash, active, session_version")
    .eq("phone", phone)
    .maybeSingle();

  // Always run the hash check so an unknown phone takes as long as a wrong password.
  const ok = await verifyPassword(password, agent?.password_hash ?? DUMMY_HASH);

  if (!agent || !ok) {
    await recordEvent(bucket);
    return { error: "Phone number or password is incorrect.", at: Date.now() };
  }
  if (!agent.active) {
    return { error: "This account has been turned off. Contact the admin.", at: Date.now() };
  }

  await clearBucket(bucket);
  await supabase.from("agents").update({ last_login_at: new Date().toISOString() }).eq("id", agent.id);
  await startAgentSession(agent.id, agent.session_version);
  return { ok: true, name: agent.name.split(" ")[0] };
}


// ─── Steps after approval ─────────────────────────────────────
// All rules live in lib/stage-ops.ts; each action is limited to the agent's own entries.

export async function agentBookSlot(id: string, _prev: steps.StepResult, formData: FormData): Promise<steps.StepResult> {
  const agent = await requireAgent();
  const r = await steps.bookSlot(
    id,
    { role: "agent", agentId: agent.id },
    String(formData.get("date") ?? ""),
    String(formData.get("time") ?? ""),
  );
  if (r?.ok) refresh();
  return r;
}

export async function agentRecordResult(id: string, result: "done" | "fail"): Promise<steps.StepResult> {
  const agent = await requireAgent();
  const r = await steps.recordResult(id, { role: "agent", agentId: agent.id }, result);
  if (r?.ok) refresh();
  return r;
}

export async function agentUndo(id: string): Promise<steps.StepResult> {
  const agent = await requireAgent();
  const r = await steps.undoLastAdvance(id, agent.id, UNDO_MINUTES);
  if (r?.ok) refresh();
  return r;
}

// ─── Fix a typo in the customer's name or mobile ──────────────
// Allowed only before approval (Pending or Rejected): once the admin approves, they've checked
// the Aadhaar against these details, so they're locked. Every change is written to History.

export type EditDetailsState = { ok?: boolean; error?: string; field?: "fullName" | "mobile"; at?: number } | undefined;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EDITABLE = ["pending", "rejected"];

export async function agentEditDetails(
  id: string,
  _prev: EditDetailsState,
  formData: FormData,
): Promise<EditDetailsState> {
  const agent = await requireAgent();
  const fail = (error: string, field?: "fullName" | "mobile"): EditDetailsState => ({ error, field, at: Date.now() });
  if (!UUID.test(id)) return fail("Entry not found.");

  const name = fullNameSchema.safeParse(String(formData.get("fullName") ?? ""));
  if (!name.success) return fail(name.error.issues[0].message, "fullName");
  const mobile = mobileSchema.safeParse(String(formData.get("mobile") ?? ""));
  if (!mobile.success) return fail(mobile.error.issues[0].message, "mobile");

  const supabase = db();
  const { data: current } = await supabase
    .from("kyc_submissions")
    .select("full_name, mobile, status")
    .eq("id", id)
    .eq("agent_id", agent.id) // only their own entries
    .maybeSingle();
  if (!current) return fail("Entry not found.");
  if (!EDITABLE.includes(current.status)) {
    return fail("This KYC is already approved, so the name and number are locked. Ask the admin if something is wrong.");
  }

  const changes: string[] = [];
  if (current.full_name !== name.data) changes.push(`name “${current.full_name}” → “${name.data}”`);
  if (current.mobile !== mobile.data) changes.push(`mobile ${current.mobile} → ${mobile.data}`);
  if (changes.length === 0) return fail("Nothing changed. Edit the name or number, then save.");

  const { data: updated, error } = await supabase
    .from("kyc_submissions")
    .update({ full_name: name.data, mobile: mobile.data })
    .eq("id", id)
    .eq("agent_id", agent.id)
    .in("status", EDITABLE) // in case the admin approved it a moment ago
    .select("id");
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("Another KYC already uses this mobile number.", "mobile");
    console.error("edit details failed", error);
    return fail("Couldn't save the changes. Try again.");
  }
  if (!updated?.length) {
    return fail("This KYC was just approved, so the name and number are locked. Ask the admin if something is wrong.");
  }

  await supabase.from("kyc_stage_events").insert({
    submission_id: id,
    from_stage: null,
    to_stage: null,
    by_role: "agent",
    by_agent_id: agent.id,
    is_undo: false,
    action: "edit",
    note: `Details corrected: ${changes.join(", ")}`,
  });

  refresh();
  return { ok: true, at: Date.now() };
}
