import { displayStatus, type Stage } from "@/lib/stages";
import type { KycStatus } from "@/lib/supabase";

/** Pending / Rejected before approval; the current step after it. */
export function StatusPill({ status, stage }: { status: KycStatus; stage: Stage | null }) {
  const d = displayStatus(status, stage);
  return (
    <span className="pill" data-status={d.key}>
      {d.label}
    </span>
  );
}
