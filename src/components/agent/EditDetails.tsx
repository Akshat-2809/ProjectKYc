"use client";

import { useActionState, useState } from "react";
import { agentEditDetails, type EditDetailsState } from "@/app/agent/actions";
import { AlertIcon, Spinner } from "@/components/Icons";
import { tenDigits } from "@/lib/phone";

const PencilIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0 }}
  >
    <path d="M4 20h4L19 9l-4-4L4 16v4z" />
    <path d="M13.5 6.5l4 4" />
  </svg>
);

/**
 * "Edit name or number" on an agent's own entry, before approval.
 * The page passes a key built from the saved values, so after a save this remounts closed.
 */
export function EditDetails({ id, name, mobile }: { id: string; name: string; mobile: string }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(mobile);
  const [dismissedAt, setDismissedAt] = useState<number>(); // hides an old error after Cancel
  const [state, action, pending] = useActionState(
    (prev: EditDetailsState, formData: FormData) => agentEditDetails(id, prev, formData),
    undefined,
  );

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-sm edit-details-btn" onClick={() => setOpen(true)}>
        <PencilIcon />
        Edit name or number
      </button>
    );
  }

  const err = state?.error && state.at !== dismissedAt ? state : undefined;
  return (
    <form action={action} className="edit-details reveal" noValidate>
      <p className="label" style={{ margin: 0 }}>
        Fix the customer&apos;s details
      </p>
      {err && !err.field && (
        <p className="alert" role="alert" style={{ margin: 0 }} key={err.at}>
          <AlertIcon size={18} />
          <span>{err.error}</span>
        </p>
      )}
      <div className="field">
        <label className="label" htmlFor="edit-name">
          Full name (as on Aadhaar)
        </label>
        <input
          id="edit-name"
          name="fullName"
          className="input"
          defaultValue={name}
          autoComplete="off"
          aria-invalid={err?.field === "fullName" || undefined}
          required
        />
        {err?.field === "fullName" && <p className="field-error">{err.error}</p>}
      </div>
      <div className="field">
        <label className="label" htmlFor="edit-mobile">
          Aadhaar-linked mobile
        </label>
        <div className="input-prefix">
          <span>+91</span>
          <input
            id="edit-mobile"
            name="mobile"
            className="input"
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(tenDigits(e.target.value))}
            aria-invalid={err?.field === "mobile" || undefined}
            required
          />
        </div>
        {err?.field === "mobile" && <p className="field-error">{err.error}</p>}
      </div>
      <p className="hint" style={{ margin: 0 }}>
        The Aadhaar PDF stays the same. You can edit these until the admin approves the KYC.
      </p>
      <div className="confirm-actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setOpen(false);
            setPhone(mobile);
            setDismissedAt(state?.at);
          }}
          disabled={pending}
        >
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
          {pending && <Spinner size={14} />}
          {pending ? "Saving" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
