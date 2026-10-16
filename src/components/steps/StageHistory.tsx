import { when } from "@/lib/format";
import { stageLabel } from "@/lib/stages";
import type { StageEvent } from "@/lib/supabase";

/** Timeline of every step change, newest first. */
export function StageHistory({ events, agentNames }: { events: StageEvent[]; agentNames: Map<string, string> }) {
  if (events.length === 0) return null;

  const describe = (e: StageEvent) => {
    if (e.note) return e.note;
    // Entries recorded before notes existed
    if (e.from_stage === null) return `Approved. Started ${stageLabel(e.to_stage)}`;
    if (e.is_undo) return `Undid. Back to ${stageLabel(e.to_stage)}`;
    return `${stageLabel(e.from_stage)} done. Now on ${stageLabel(e.to_stage)}`;
  };

  return (
    <section className="panel">
      <h2>History</h2>
      <ol className="history">
        {events.map((e) => {
          const who = e.by_role === "admin" ? "Admin" : (e.by_agent_id && agentNames.get(e.by_agent_id)) || "Agent";
          return (
            <li key={e.id} data-kind={e.action ?? (e.is_undo ? "undo" : "advance")}>
              <span className="history-text">{describe(e)}</span>
              <span className="history-meta">
                {who}, {when(e.created_at)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
