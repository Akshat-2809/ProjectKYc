"use client";

import { useState, useTransition } from "react";
import { adminMarkPaid } from "@/app/admin/actions";
import { CheckIcon, Spinner } from "@/components/Icons";

/** "Mark as paid" right in the admin list, shown only on Completed (unpaid) rows. */
export function QuickPaidButton({ id, name }: { id: string; name: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="quick-paid">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={busy}
        aria-label={`Mark ${name} as paid`}
        onClick={() =>
          start(async () => {
            const r = await adminMarkPaid(id);
            setError(r?.error ?? null);
          })
        }
      >
        {busy ? <Spinner size={14} /> : <CheckIcon size={14} />}
        Mark as paid
      </button>
      {error && <span className="field-error">{error}</span>}
    </span>
  );
}
