"use client";

import { useActionState } from "react";
import { adminSetStage } from "@/app/admin/actions";
import { Spinner } from "@/components/Icons";
import { STAGE_LABEL, STAGES, type Stage } from "@/lib/stages";

/** Lets the admin put an approved entry on any step, e.g. to fix an agent's mistake. */
export function AdminStepControl({ id, stage }: { id: string; stage: Stage | null }) {
  const [state, action, pending] = useActionState(adminSetStage.bind(null, id), undefined);
  return (
    <form action={action} className="step-body">
      <div className="field">
        <label className="label" htmlFor="stage">Change step</label>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <select id="stage" name="stage" className="input" defaultValue={stage ?? "slot"} key={stage}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="submit" className="btn btn-ghost" disabled={pending}>
            {pending && <Spinner size={14} />}
            Save
          </button>
        </div>
        {state?.error && <p className="field-error">{state.error}</p>}
        <p className="hint">Agents update steps themselves; use this only to correct one.</p>
      </div>
    </form>
  );
}
