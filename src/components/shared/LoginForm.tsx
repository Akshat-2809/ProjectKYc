"use client";

import { useActionState, useState } from "react";
import { AlertIcon, Spinner } from "@/components/Icons";
import { tenDigits } from "@/lib/phone";
import { WelcomeOverlay } from "./WelcomeOverlay";

export type LoginState = { error?: string; at?: number; ok?: boolean; name?: string } | undefined;
type LoginAction = (prev: LoginState, formData: FormData) => Promise<LoginState>;

/** Phone + password sign-in used by both the admin and agents. */
export function LoginForm({ login, to, sub }: { login: LoginAction; to: string; sub: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  const [phone, setPhone] = useState("");
  const [show, setShow] = useState(false);

  if (state?.ok) return <WelcomeOverlay name={state.name ?? ""} to={to} sub={sub} />;

  return (
    <form action={action} className="step-body">
      {state?.error && (
        <p className="alert shake" role="alert" style={{ margin: 0 }} key={state.at}>
          <AlertIcon size={18} />
          <span>{state.error}</span>
        </p>
      )}
      <div className="field">
        <label className="label" htmlFor="phone">Phone number</label>
        <div className="input-prefix">
          <span>+91</span>
          <input
            id="phone"
            name="phone"
            className="input"
            type="tel"
            inputMode="numeric"
            autoComplete="username"
            placeholder="10-digit number"
            required
            value={phone}
            onChange={(e) => setPhone(tenDigits(e.target.value))}
          />
        </div>
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <div style={{ position: "relative" }}>
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            className="input"
            autoComplete="current-password"
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
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending && <Spinner />}
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
