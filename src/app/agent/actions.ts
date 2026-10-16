"use server";

import { refresh } from "next/cache";
import { requireAgent, startAgentSession } from "@/lib/auth";
import * as steps from "@/lib/stage-ops";
import { UNDO_MINUTES } from "@/lib/stages";
import { DUMMY_HASH, verifyPassword } from "@/lib/password";
import { clearBucket, clientIp, isRateLimited, recordEvent } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";
import { normalizeMobile } from "@/lib/validation";
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
