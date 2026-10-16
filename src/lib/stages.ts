import type { KycStatus } from "./supabase";

/**
 * Steps after approval, in order:
 * Slot booking → Scanner → OTP → Active KYC → Completed (unpaid) → Paid
 */
export const STAGES = ["slot", "scanner", "otp", "active_kyc", "completed_unpaid", "paid"] as const;
export type Stage = (typeof STAGES)[number];

/** Steps the agent is still working through. */
export const IN_PROGRESS_STAGES = ["slot", "scanner", "otp", "active_kyc"] as const;
/** Finished steps (paid or awaiting payment). */
export const DONE_STAGES = ["completed_unpaid", "paid"] as const;

export const STAGE_LABEL: Record<Stage, string> = {
  slot: "Slot booking",
  scanner: "Scanner",
  otp: "OTP",
  active_kyc: "Active KYC",
  completed_unpaid: "Completed (unpaid)",
  paid: "Completed",
};

/** Short names for the tracker and count boxes. */
export const STAGE_SHORT: Record<Stage, string> = {
  slot: "Slot",
  scanner: "Scanner",
  otp: "OTP",
  active_kyc: "Active KYC",
  completed_unpaid: "Completed (unpaid)",
  paid: "Completed",
};

/** Each slot lasts this long; one agent can't have two slots overlapping. */
export const SLOT_MINUTES = 20;
export const UNDO_MINUTES = 10;

/** Names of steps from the earlier version, so old history entries still read sensibly. */
const LEGACY_LABEL: Record<string, string> = {
  digilocker_otp: "DigiLocker OTP",
  auto_payment: "Payment mandate",
  final_otp: "Final OTP",
  completed: "Completed",
};

export function isStage(v: unknown): v is Stage {
  return typeof v === "string" && (STAGES as readonly string[]).includes(v);
}

export function stageLabel(v: string | null): string {
  if (isStage(v)) return STAGE_LABEL[v];
  return (v && LEGACY_LABEL[v]) || "Approval";
}

/** Pending / Rejected before approval, then the current step after it. */
export function displayStatus(status: KycStatus, stage: Stage | null): { key: string; label: string } {
  if (status === "pending") return { key: "pending", label: "Pending" };
  if (status === "rejected") return { key: "rejected", label: "Rejected" };
  const s = stage ?? "slot";
  return { key: s, label: STAGE_LABEL[s] };
}

export type EventLike = {
  from_stage: string | null;
  to_stage: string | null;
  by_role: string;
  by_agent_id: string | null;
  is_undo: boolean;
  action?: string | null;
  created_at: string;
};

/**
 * An agent may undo their own last "done" click within a few minutes.
 * Failures, slot bookings and anything the admin did can't be undone by agents.
 */
export function canAgentUndo(last: EventLike | null, currentStage: string | null, agentId: string, now = Date.now()) {
  return Boolean(
    last &&
      last.action === "advance" &&
      !last.is_undo &&
      last.by_role === "agent" &&
      last.by_agent_id === agentId &&
      last.to_stage === currentStage &&
      isStage(last.from_stage) &&
      now - new Date(last.created_at).getTime() <= UNDO_MINUTES * 60_000,
  );
}
