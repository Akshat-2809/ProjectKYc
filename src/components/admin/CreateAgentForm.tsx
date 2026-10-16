"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createAgent } from "@/app/admin/agents/actions";
import { AlertIcon, CheckIcon, PlusIcon, Spinner } from "@/components/Icons";
import { tenDigits } from "@/lib/phone";

/** The "Add an agent" form. Lives inside the dialog opened from the admin top bar. */
export function CreateAgentForm({ onClose }: { onClose?: () => void }) {
  const [state, action, pending] = useActionState(createAgent, undefined);
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the form after a successful create so the next agent can be added straight away.
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhone("");
    }
  }, [state]);

  return (
    <div className="agent-form">
      <div className="dialog-head">
        <h2 id="add-agent-title">Add an agent</h2>
        {onClose && (
          <button type="button" className="dialog-x" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      <form ref={formRef} action={action} className="step-body">
        {state?.error && (
          <p className="alert shake" role="alert" style={{ margin: 0 }} key={state.at}>
            <AlertIcon size={18} />
            <span>{state.error}</span>
          </p>
        )}
        {state?.ok && (
          <p className="flash" role="status" style={{ margin: 0, display: "flex", gap: "0.5rem" }} key={state.at}>
            <CheckIcon size={18} />
            <span>{state.message}</span>
          </p>
        )}
        <div className="field">
          <label className="label" htmlFor="agent-name">Name</label>
          <input id="agent-name" name="name" className="input" autoComplete="off" placeholder="Agent's full name" required />
        </div>
        <div className="field">
          <label className="label" htmlFor="agent-phone">Phone number</label>
          <div className="input-prefix">
            <span>+91</span>
            <input
              id="agent-phone"
              name="phone"
              className="input"
              type="tel"
              inputMode="numeric"
              autoComplete="off"
              placeholder="They sign in with this"
              required
              value={phone}
              onChange={(e) => setPhone(tenDigits(e.target.value))}
            />
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="agent-password">Password</label>
          <div style={{ position: "relative" }}>
            <input
              id="agent-password"
              name="password"
              type={show ? "text" : "password"}
              className="input"
              autoComplete="new-password"
              minLength={8}
              required
              style={{ paddingRight: "4.5rem" }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShow((s) => !s)}
              aria-pressed={show}
              style={{ position: "absolute", right: "0.35rem", top: "50%", transform: "translateY(-50%)", border: 0 }}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <p className="hint">At least 8 characters. You&apos;ll share it with the agent yourself.</p>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
          {pending ? <Spinner /> : <PlusIcon size={18} />}
          {pending ? "Creating" : "Create agent"}
        </button>
        {onClose && state?.ok && (
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            Done
          </button>
        )}
      </form>
    </div>
  );
}
