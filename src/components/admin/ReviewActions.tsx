"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { approve, deleteSubmission, reject, type FormState } from "@/app/admin/actions";
import { CheckIcon, Spinner } from "@/components/Icons";
import type { KycStatus } from "@/lib/supabase";

const QUICK_REASONS = [
  "Name doesn't match the Aadhaar card",
  "Mobile number doesn't match Aadhaar records",
  "PDF is unreadable or blurry",
  "Only one side of the card was uploaded",
  "PDF is password-protected; upload an unlocked copy",
];

export function ReviewActions({
  id,
  status,
  name,
  reviewed,
}: {
  id: string;
  status: KycStatus;
  name: string;
  /** Already formatted on the server, so server and browser render identical text. */
  reviewed: string | null;
}) {
  const [approveState, setApproveState] = useState<FormState>();
  const [approving, startApprove] = useTransition();
  const [deleteState, setDeleteState] = useState<FormState>();
  const [deleting, startDelete] = useTransition();
  const [rejectState, rejectAction, rejecting] = useActionState(reject.bind(null, id), undefined);
  const [reason, setReason] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      {status === "approved" && (
        <section className="panel" key="approved">
          <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--accent)" }}>
            <CheckIcon size={18} /> KYC approved
          </h2>
          <p className="hint" style={{ margin: 0 }}>
            Approved{reviewed ? ` on ${reviewed}` : ""}. The agent sees this on their list.
          </p>
        </section>
      )}

      {status === "rejected" && (
        <section className="panel" key="rejected">
          <h2>Waiting for the agent to re-upload</h2>
          <p className="hint" style={{ margin: 0 }}>
            Rejected{reviewed ? ` on ${reviewed}` : ""}. This moves back to Pending when they upload again.
          </p>
        </section>
      )}

      {status === "pending" && (
        <section className="panel">
          <h2>Everything matches?</h2>
          {approveState?.error && <p className="field-error">{approveState.error}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={approving || rejecting}
            onClick={() => startApprove(async () => setApproveState(await approve(id)))}
          >
            {approving ? <Spinner /> : <CheckIcon size={18} />}
            {approving ? "Approving" : "Approve KYC"}
          </button>
        </section>
      )}

      {status === "pending" && (
        <section className="panel">
          <h2>Something doesn&apos;t match?</h2>
          <form action={rejectAction} className="step-body">
            <div className="chips" role="group" aria-label="Quick reasons">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="chip"
                  aria-pressed={reason === r}
                  onClick={() => setReason(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="field">
              <label className="label" htmlFor="reason">Reason the agent will see</label>
              <textarea
                id="reason"
                name="reason"
                className="input"
                placeholder="Pick a reason above or write your own"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={500}
                aria-invalid={Boolean(rejectState?.error)}
              />
              {rejectState?.error && <p className="field-error">{rejectState.error}</p>}
            </div>
            <button type="submit" className="btn btn-danger btn-block" disabled={rejecting || approving}>
              {rejecting && <Spinner />}
              {rejecting ? "Rejecting" : "Reject and ask to re-upload"}
            </button>
          </form>
        </section>
      )}

      <section className="panel">
        <h2>Delete customer data</h2>
        <p className="hint" style={{ marginBottom: "0.75rem" }}>
          Removes the Aadhaar PDF and this record permanently. Do this once the account is set up and paid
          for.
        </p>
        {deleteState?.error && <p className="field-error">{deleteState.error}</p>}
        <button
          type="button"
          className="btn btn-ghost btn-block"
          disabled={deleting}
          onClick={() => dialogRef.current?.showModal()}
        >
          {deleting && <Spinner />}
          {deleting ? "Deleting" : "Delete permanently"}
        </button>
      </section>

      <dialog ref={dialogRef} className="confirm" aria-labelledby="del-title">
        <form method="dialog" className="confirm-body">
          <h2 id="del-title">Delete {name}&apos;s KYC?</h2>
          <p className="hint" style={{ margin: 0 }}>
            The Aadhaar PDF and this record will be removed permanently. This can&apos;t be undone.
          </p>
          <div className="confirm-actions">
            <button value="cancel" className="btn btn-ghost btn-sm" autoFocus>
              Keep it
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                dialogRef.current?.close();
                startDelete(async () => setDeleteState(await deleteSubmission(id)));
              }}
            >
              Delete permanently
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
