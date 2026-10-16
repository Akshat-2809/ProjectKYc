"use client";

import { useActionState, useState } from "react";
import { createAgent, type AgentFormState } from "@/app/admin/agents/actions";
import { AlertIcon, CheckIcon, PlusIcon, Spinner } from "@/components/Icons";
import { tenDigits } from "@/lib/phone";
import { ShareCredentials } from "./ShareCredentials";

/** Runs the server action, then keeps the typed password in this browser so it can be sent to the agent. */
async function create(prev: AgentFormState, formData: FormData): Promise<AgentFormState> {
  const result = await createAgent(prev, formData);
  return result?.ok ? { ...result, password: String(formData.get("password") ?? "") } : result;
}

/** The "Add an agent" form. Lives inside the dialog opened from the admin top bar. */
export function CreateAgentForm({ onClose }: { onClose?: () => void }) {
  const [state, action, pending] = useActionState(create, undefined);
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);
  // After "Add another agent", hide the last result and show an empty form again.
  const [dismissedAt, setDismissedAt] = useState<number>();
  const created = state?.ok && state.at !== dismissedAt ? state : undefined;

  return (
    <div className="agent-form">
      <div className="dialog-head">
        <h2 id="add-agent-title">Add an agent</h2>
        {onClose && (
          <button type="button" className="dialog-x" onClick={onClose} aria-label="Close">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
      {created ? (
        <div className="step-body">
          <p className="flash" role="status" style={{ margin: 0, display: "flex", gap: "0.5rem" }}>
            <CheckIcon size={18} />
            <span>{created.message}</span>
          </p>
          <ShareCredentials
            name={created.name ?? ""}
            phone={created.phone ?? ""}
            password={created.password ?? ""}
            kind="new"
          />
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              setDismissedAt(created.at);
              setPhone("");
              setShow(false);
            }}
          >
            <PlusIcon size={18} />
            Add another agent
          </button>
          {onClose && (
            <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      ) : (
        <form action={action} className="step-body">
          {state?.error && (
            <p className="alert shake" role="alert" style={{ margin: 0 }} key={state.at}>
              <AlertIcon size={18} />
              <span>{state.error}</span>
            </p>
          )}
          <div className="field">
            <label className="label" htmlFor="agent-name">
              Name
            </label>
            <input
              id="agent-name"
              name="name"
              className="input"
              autoComplete="off"
              placeholder="Agent's full name"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="agent-phone">
              Phone number
            </label>
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
            <label className="label" htmlFor="agent-password">
              Password
            </label>
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
                style={{
                  position: "absolute",
                  right: "0.35rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: 0,
                }}
              >
                {show ? "Hide" : "Show"}
              </button>
            </div>
            <p className="hint">At least 8 characters. Agents can&apos;t change it; only you can, from the Agents page.</p>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? <Spinner /> : <PlusIcon size={18} />}
            {pending ? "Creating" : "Create agent"}
          </button>
        </form>
      )}
    </div>
  );
}
