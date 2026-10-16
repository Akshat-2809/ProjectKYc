import { CheckIcon } from "@/components/Icons";
import { STAGE_SHORT, STAGES, type Stage } from "@/lib/stages";

/** Six-step tracker: done steps get a check, the current one is highlighted. Paid = everything done. */
export function StageTracker({ stage }: { stage: Stage | null }) {
  const current = stage ?? "slot";
  const currentIndex = current === "paid" ? STAGES.length : STAGES.indexOf(current);

  return (
    <div className="tracker" data-completed={current === "paid"}>
      <ol className="tracker-steps" style={{ gridTemplateColumns: `repeat(${STAGES.length}, 1fr)` }}>
        {STAGES.map((s, i) => {
          const state = i < currentIndex ? "done" : i === currentIndex ? "current" : "todo";
          return (
            <li key={s} className="tracker-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="tracker-dot">{state === "done" ? <CheckIcon size={13} /> : i + 1}</span>
              <span className="tracker-label">{STAGE_SHORT[s]}</span>
            </li>
          );
        })}
      </ol>
      {current === "paid" && (
        <p className="tracker-done">
          <CheckIcon size={16} /> Completed. Everything is done
        </p>
      )}
    </div>
  );
}
