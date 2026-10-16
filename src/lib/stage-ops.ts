import "server-only";
import { formatSlot } from "./format";
import { isStage, SLOT_MINUTES, STAGE_LABEL, type Stage } from "./stages";
import { db } from "./supabase";

export type Actor = { role: "admin" } | { role: "agent"; agentId: string };
export type StepResult = { error?: string; ok?: boolean; at?: number } | undefined;

const fail = (error: string): StepResult => ({ error, at: Date.now() });
const ok = (): StepResult => ({ ok: true, at: Date.now() });

type Row = {
  id: string;
  status: string;
  stage: string | null;
  slot_at: string | null;
  agent_id: string | null;
};

/** Loads an entry the actor is allowed to touch (agents only see their own). */
async function load(id: string, actor: Actor): Promise<Row | null> {
  let q = db().from("kyc_submissions").select("id, status, stage, slot_at, agent_id").eq("id", id);
  if (actor.role === "agent") q = q.eq("agent_id", actor.agentId);
  const { data } = await q.maybeSingle();
  return (data as Row) ?? null;
}

/**
 * Updates the entry only if it is still approved and on `from`, so two people
 * clicking at once can't skip or double-apply a step. Returns false if nothing changed.
 */
async function guarded(id: string, from: string | null, patch: Record<string, unknown>, actor: Actor) {
  let q = db()
    .from("kyc_submissions")
    .update({ ...patch, stage_updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "approved");
  q = from === null ? q.is("stage", null) : q.eq("stage", from);
  if (actor.role === "agent") q = q.eq("agent_id", actor.agentId);
  const { data, error } = await q.select("id");
  return !error && Boolean(data && data.length > 0);
}

async function log(
  id: string,
  from: string | null,
  to: string | null,
  actor: Actor,
  action: "approve" | "advance" | "fail" | "slot" | "undo" | "paid" | "admin_set",
  note?: string,
) {
  await db()
    .from("kyc_stage_events")
    .insert({
      submission_id: id,
      from_stage: from,
      to_stage: to,
      by_role: actor.role,
      by_agent_id: actor.role === "agent" ? actor.agentId : null,
      is_undo: action === "undo",
      action,
      note: note ?? null,
    });
}

const RACE = "This entry was just changed by someone else. Refresh the page.";

// ─── Approval ──────────────────────────────────────────────────

export async function logApproval(id: string) {
  await log(id, null, "slot", { role: "admin" }, "approve", "Approved. Waiting for a slot");
}

// ─── Slot booking ──────────────────────────────────────────────

/**
 * Books (or reschedules) the 20-minute slot agreed with the customer, in Indian time.
 * Allowed while on Slot booking or Scanner. The same agent can't have two overlapping
 * slots; different agents can use the same time.
 */
export async function bookSlot(id: string, actor: Actor, date: string, time: string): Promise<StepResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return fail("Pick a date and a time.");
  }
  const start = new Date(`${date}T${time}:00+05:30`);
  if (Number.isNaN(start.getTime())) return fail("That date or time isn't valid.");
  if (start.getTime() < Date.now() - 30 * 60_000) return fail("That time has already passed. Pick a later slot.");
  if (start.getTime() > Date.now() + 90 * 24 * 60 * 60_000) return fail("Pick a slot within the next 90 days.");

  const row = await load(id, actor);
  if (!row) return fail("This entry doesn't exist or isn't yours.");
  if (row.status !== "approved") return fail("Slots can be booked once the KYC is approved.");
  if (row.stage !== "slot" && row.stage !== "scanner") return fail("The slot can only be changed before the scanner is done.");

  // One agent can't be in two places at once.
  if (row.agent_id) {
    const windowMs = SLOT_MINUTES * 60_000;
    const { data: clashes } = await db()
      .from("kyc_submissions")
      .select("id, full_name, slot_at")
      .eq("agent_id", row.agent_id)
      .eq("status", "approved")
      .eq("stage", "scanner")
      .neq("id", id)
      .gt("slot_at", new Date(start.getTime() - windowMs).toISOString())
      .lt("slot_at", new Date(start.getTime() + windowMs).toISOString())
      .limit(1);
    if (clashes && clashes.length > 0) {
      const c = clashes[0];
      return fail(`Clashes with ${c.full_name}'s slot (${formatSlot(c.slot_at)}). Pick a time at least ${SLOT_MINUTES} minutes apart.`);
    }
  }

  const iso = start.toISOString();
  const changed = await guarded(id, row.stage, { slot_at: iso, stage: "scanner" }, actor);
  if (!changed) return fail(RACE);
  const verb = row.stage === "scanner" && row.slot_at ? "Slot moved to" : "Slot booked:";
  await log(id, row.stage, "scanner", actor, "slot", `${verb} ${formatSlot(iso)}`);
  return ok();
}

// ─── Done / fail ───────────────────────────────────────────────

/**
 * Records the outcome of the current step.
 *   Scanner: done → OTP, fail → back to Slot booking (book a new slot and retry)
 *   OTP: done → Active KYC, fail → application rejected (re-upload the Aadhaar)
 *   Active KYC: done → Completed (unpaid)
 */
export async function recordResult(id: string, actor: Actor, result: "done" | "fail"): Promise<StepResult> {
  const row = await load(id, actor);
  if (!row) return fail("This entry doesn't exist or isn't yours.");
  if (row.status !== "approved") return fail("Steps start after the KYC is approved.");

  switch (row.stage) {
    case "scanner": {
      if (result === "done") {
        if (!(await guarded(id, "scanner", { stage: "otp" }, actor))) return fail(RACE);
        await log(id, "scanner", "otp", actor, "advance", "Scanner done. Now on OTP");
      } else {
        if (!(await guarded(id, "scanner", { stage: "slot", slot_at: null }, actor))) return fail(RACE);
        await log(id, "scanner", "slot", actor, "fail", "Scanner failed. Book a new slot to retry");
      }
      return ok();
    }
    case "otp": {
      if (result === "done") {
        if (!(await guarded(id, "otp", { stage: "active_kyc" }, actor))) return fail(RACE);
        await log(id, "otp", "active_kyc", actor, "advance", "OTP done. Now on Active KYC");
        return ok();
      }
      // OTP failed: the application is rejected and starts over with a fresh Aadhaar upload.
      const reason = "OTP failed. Re-upload the Aadhaar card to start again.";
      const changed = await guarded(
        id,
        "otp",
        { status: "rejected", rejection_reason: reason, reviewed_at: new Date().toISOString(), stage: null, slot_at: null },
        actor,
      );
      if (!changed) return fail(RACE);
      await log(id, "otp", null, actor, "fail", "OTP failed. Application rejected");
      return ok();
    }
    case "active_kyc": {
      if (result === "fail") return fail("Active KYC can only be marked done.");
      if (!(await guarded(id, "active_kyc", { stage: "completed_unpaid" }, actor))) return fail(RACE);
      await log(id, "active_kyc", "completed_unpaid", actor, "advance", "Active KYC done. Completed, waiting for payment");
      return ok();
    }
    case "slot":
      return fail("Book a slot first.");
    case "completed_unpaid":
      return fail("Waiting for the admin to confirm payment.");
    default:
      return fail("This entry is already finished.");
  }
}

/** Admin only: payment received, everything done. */
export async function markPaid(id: string): Promise<StepResult> {
  const actor: Actor = { role: "admin" };
  const row = await load(id, actor);
  if (!row || row.status !== "approved" || row.stage !== "completed_unpaid") {
    return fail("Only entries that are Completed (unpaid) can be marked as paid.");
  }
  if (!(await guarded(id, "completed_unpaid", { stage: "paid" }, actor))) return fail(RACE);
  await log(id, "completed_unpaid", "paid", actor, "paid", "Payment received. All done");
  return ok();
}

// ─── Corrections ───────────────────────────────────────────────

/** The agent's own last "done" click, within a few minutes (see canAgentUndo). */
export async function undoLastAdvance(id: string, agentId: string, undoMinutes: number): Promise<StepResult> {
  const actor: Actor = { role: "agent", agentId };
  const row = await load(id, actor);
  if (!row || row.status !== "approved" || !isStage(row.stage)) return fail("Nothing to undo.");

  const { data: last } = await db()
    .from("kyc_stage_events")
    .select("from_stage, to_stage, by_role, by_agent_id, is_undo, action, created_at")
    .eq("submission_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const fresh = last && Date.now() - new Date(last.created_at).getTime() <= undoMinutes * 60_000;
  if (
    !last ||
    last.action !== "advance" ||
    last.by_role !== "agent" ||
    last.by_agent_id !== agentId ||
    last.to_stage !== row.stage ||
    !isStage(last.from_stage) ||
    !fresh
  ) {
    return fail(`You can only undo your own last "done" within ${undoMinutes} minutes. Ask the admin to fix it.`);
  }
  if (!(await guarded(id, row.stage, { stage: last.from_stage }, actor))) return fail(RACE);
  await log(id, row.stage, last.from_stage, actor, "undo", `Undid. Back to ${STAGE_LABEL[last.from_stage]}`);
  return ok();
}

/** Admin can put an approved entry on any step to fix a mistake. */
export async function adminSetStage(id: string, to: Stage): Promise<StepResult> {
  const actor: Actor = { role: "admin" };
  const row = await load(id, actor);
  if (!row || row.status !== "approved") return fail("Only approved entries have steps.");
  if (row.stage === to) return fail("It's already on that step.");
  const patch: Record<string, unknown> = { stage: to };
  if (to === "slot") patch.slot_at = null; // back to booking means no slot yet
  if (!(await guarded(id, row.stage, patch, actor))) return fail(RACE);
  await log(id, row.stage, to, actor, "admin_set", `Step changed to ${STAGE_LABEL[to]}`);
  return ok();
}
