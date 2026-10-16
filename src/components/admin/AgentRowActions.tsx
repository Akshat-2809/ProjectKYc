"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { deleteAgent, resetAgentPassword, setAgentActive, type AgentFormState } from "@/app/admin/agents/actions";
import { AlertIcon, CheckIcon, Spinner } from "@/components/Icons";
import { ShareCredentials } from "./ShareCredentials";

export function AgentRowActions({
  id,
  name,
  phone,
  active,
}: {
  id: string;
  name: string;
  phone: string;
  active: boolean;
}) {
  const resetRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const [resetState, resetAction, resetting] = useActionState(
    async (prev: AgentFormState, formData: FormData): Promise<AgentFormState> => {
      const result = await resetAgentPassword(id, prev, formData);
      // Keep the new password in this browser only, for the "send to agent" buttons.
      return result?.ok ? { ...result, password: String(formData.get("password") ?? "") } : result;
    },
    undefined,
  );
  // Closing the dialog hides the last result, so reopening it shows an empty form.
  const [dismissedAt, setDismissedAt] = useState<number>();
  const changed = resetState?.ok && resetState.at !== dismissedAt ? resetState : undefined;
  const closeReset = () => resetRef.current?.close();
  const [msg, setMsg] = useState<AgentFormState>();
  const [busy, start] = useTransition();
  const [show, setShow] = useState(false);

  return (
    <div className="agent-actions">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetRef.current?.showModal()}>
        Reset password
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={busy}
        onClick={() => start(async () => setMsg(await setAgentActive(id, !active)))}
      >
        {busy && <Spinner size={14} />}
        {active ? "Turn off" : "Turn on"}
      </button>
      <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => deleteRef.current?.showModal()}>
        Delete
      </button>
      {msg?.error && (
        <p className="field-error" style={{ flexBasis: "100%" }}>
          {msg.error}
        </p>
      )}

      <dialog
        ref={resetRef}
        className="confirm"
        aria-labelledby={`reset-${id}`}
        onClose={() => {
          if (resetState?.ok) setDismissedAt(resetState.at);
          setShow(false);
        }}
      >
        {changed ? (
          <div className="confirm-body">
            <h2 id={`reset-${id}`}>New password for {name}</h2>
            <p className="flash" role="status" style={{ margin: 0, display: "flex", gap: "0.5rem" }}>
              <CheckIcon size={18} />
              <span>{changed.message}</span>
            </p>
            <ShareCredentials name={name} phone={phone} password={changed.password ?? ""} kind="reset" />
            <div className="confirm-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeReset}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form action={resetAction} className="confirm-body">
            <h2 id={`reset-${id}`}>New password for {name}</h2>
            <p className="hint" style={{ margin: 0 }}>
              They&apos;ll be signed out everywhere and must use the new password.
            </p>
            {resetState?.error && (
              <p className="alert" style={{ margin: 0 }} key={resetState.at}>
                <AlertIcon size={18} />
                <span>{resetState.error}</span>
              </p>
            )}
            <div style={{ position: "relative" }}>
              <input
                name="password"
                type={show ? "text" : "password"}
                className="input"
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="At least 8 characters"
                aria-label="New password"
                style={{ paddingRight: "4.5rem" }}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShow((s) => !s)}
                style={{ position: "absolute", right: "0.35rem", top: "50%", transform: "translateY(-50%)", border: 0 }}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <div className="confirm-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeReset}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={resetting}>
                {resetting && <Spinner size={14} />}
                Save password
              </button>
            </div>
          </form>
        )}
      </dialog>

      <dialog ref={deleteRef} className="confirm" aria-labelledby={`del-${id}`}>
        <div className="confirm-body">
          <h2 id={`del-${id}`}>Delete {name}?</h2>
          <p className="hint" style={{ margin: 0 }}>
            Only agents with no entries can be deleted. If they have entries, turn the account off instead.
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteRef.current?.close()} autoFocus>
              Keep
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={() => {
                deleteRef.current?.close();
                start(async () => setMsg(await deleteAgent(id)));
              }}
            >
              Delete agent
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
