"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { deleteAgent, resetAgentPassword, setAgentActive, type AgentFormState } from "@/app/admin/agents/actions";
import { AlertIcon, CheckIcon, Spinner } from "@/components/Icons";

export function AgentRowActions({ id, name, active }: { id: string; name: string; active: boolean }) {
  const resetRef = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const [resetState, resetAction, resetting] = useActionState(resetAgentPassword.bind(null, id), undefined);
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
      {msg?.error && <p className="field-error" style={{ flexBasis: "100%" }}>{msg.error}</p>}

      <dialog ref={resetRef} className="confirm" aria-labelledby={`reset-${id}`}>
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
          {resetState?.ok && (
            <p className="flash" style={{ margin: 0, display: "flex", gap: "0.5rem" }} key={resetState.at}>
              <CheckIcon size={18} />
              <span>{resetState.message}</span>
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
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => resetRef.current?.close()}>
              {resetState?.ok ? "Done" : "Cancel"}
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={resetting}>
              {resetting && <Spinner size={14} />}
              Save password
            </button>
          </div>
        </form>
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
