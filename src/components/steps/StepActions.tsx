"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { adminBookSlot, adminMarkPaid, adminRecordResult } from "@/app/admin/actions";
import { agentBookSlot, agentRecordResult, agentUndo } from "@/app/agent/actions";
import { AlertIcon, CheckIcon, Spinner } from "@/components/Icons";
import { SLOT_MINUTES, UNDO_MINUTES, type Stage } from "@/lib/stages";
import type { StepResult } from "@/lib/stage-ops";

type Props = {
  id: string;
  role: "agent" | "admin";
  stage: Stage;
  /** Already formatted on the server, e.g. "Fri, 16 Oct, 11:30 am – 11:50 am" */
  slotText: string | null;
  /** Prefill values for the date/time inputs (IST) */
  slotDate: string;
  slotTime: string;
  /** Today's date in IST, as the earliest selectable date */
  today: string;
  canUndo?: boolean;
};

/** Everything an agent (or the admin) does after approval: book a slot, then done / fail per step. */
export function StepActions({ id, role, stage, slotText, slotDate, slotTime, today, canUndo }: Props) {
  const [result, setResult] = useState<StepResult>();
  const [busy, start] = useTransition();
  const [which, setWhich] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const otpFailRef = useRef<HTMLDialogElement>(null);

  const book = role === "admin" ? adminBookSlot.bind(null, id) : agentBookSlot.bind(null, id);
  const [slotState, slotAction, booking] = useActionState(book, undefined);

  const run = (key: string, fn: () => Promise<StepResult>) => {
    setWhich(key);
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r?.ok) setRescheduling(false);
    });
  };
  const outcome = (r: "done" | "fail") =>
    run(r, () => (role === "admin" ? adminRecordResult(id, r) : agentRecordResult(id, r)));
  const spin = (key: string) => busy && which === key;

  const slotForm = (label: string) => (
    <form action={slotAction} className="slot-form">
      <div className="slot-fields">
        <div className="field">
          <label className="label" htmlFor={`slot-date-${id}`}>Date</label>
          <input id={`slot-date-${id}`} name="date" type="date" className="input" min={today} defaultValue={slotDate} required />
        </div>
        <div className="field">
          <label className="label" htmlFor={`slot-time-${id}`}>Start time</label>
          <input id={`slot-time-${id}`} name="time" type="time" className="input" step={300} defaultValue={slotTime} required />
        </div>
      </div>
      {slotState?.error && (
        <p className="field-error" key={slotState.at}>
          {slotState.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary btn-block" disabled={booking}>
        {booking && <Spinner />}
        {label}
      </button>
      <p className="hint" style={{ margin: 0 }}>
        Agree the time with the customer first. Each slot is {SLOT_MINUTES} minutes.
      </p>
    </form>
  );

  return (
    <div className="step-controls">
      {result?.error && (
        <p className="alert" role="alert" style={{ margin: 0 }} key={result.at}>
          <AlertIcon size={18} />
          <span>{result.error}</span>
        </p>
      )}

      {stage === "slot" && slotForm("Book slot")}

      {stage === "scanner" && (
        <>
          <div className="slot-card">
            <span className="hint">Slot</span>
            <strong>{slotText ?? "Not set"}</strong>
            {!rescheduling && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRescheduling(true)}>
                Reschedule
              </button>
            )}
          </div>
          {rescheduling ? (
            <>
              {slotForm("Save new slot")}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRescheduling(false)}>
                Cancel
              </button>
            </>
          ) : (
            <div className="outcome">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => outcome("done")}>
                {spin("done") ? <Spinner /> : <CheckIcon size={18} />} Scanner done
              </button>
              <button type="button" className="btn btn-fail" disabled={busy} onClick={() => outcome("fail")}>
                {spin("fail") && <Spinner />} Scanner failed
              </button>
            </div>
          )}
          {!rescheduling && <p className="hint" style={{ margin: 0 }}>If it fails, you&apos;ll book a new slot and try again.</p>}
        </>
      )}

      {stage === "otp" && (
        <>
          <div className="outcome">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => outcome("done")}>
              {spin("done") ? <Spinner /> : <CheckIcon size={18} />} OTP done
            </button>
            <button type="button" className="btn btn-fail" disabled={busy} onClick={() => otpFailRef.current?.showModal()}>
              {spin("fail") && <Spinner />} OTP failed
            </button>
          </div>
          <p className="hint" style={{ margin: 0 }}>A failed OTP rejects the application.</p>
          <dialog ref={otpFailRef} className="confirm" aria-labelledby={`otp-fail-${id}`}>
            <div className="confirm-body">
              <h2 id={`otp-fail-${id}`}>Mark OTP as failed?</h2>
              <p className="hint" style={{ margin: 0 }}>
                The application will be <strong>rejected</strong>. To try again, the Aadhaar card has to be uploaded again and approved.
              </p>
              <div className="confirm-actions">
                <button type="button" className="btn btn-ghost btn-sm" autoFocus onClick={() => otpFailRef.current?.close()}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    otpFailRef.current?.close();
                    outcome("fail");
                  }}
                >
                  Yes, reject it
                </button>
              </div>
            </div>
          </dialog>
        </>
      )}

      {stage === "active_kyc" && (
        <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => outcome("done")}>
          {spin("done") ? <Spinner /> : <CheckIcon size={18} />} Active KYC done
        </button>
      )}

      {stage === "completed_unpaid" &&
        (role === "admin" ? (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={busy}
            onClick={() => run("paid", () => adminMarkPaid(id))}
          >
            {spin("paid") ? <Spinner /> : <CheckIcon size={18} />} Mark as paid
          </button>
        ) : (
          <p className="note" style={{ margin: 0 }}>Completed. Waiting for the admin to confirm payment.</p>
        ))}

      {canUndo && role === "agent" && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() => run("undo", () => agentUndo(id))}
          title={`Available for ${UNDO_MINUTES} minutes after you mark a step done`}
        >
          {spin("undo") && <Spinner size={14} />} Undo last step
        </button>
      )}
    </div>
  );
}
