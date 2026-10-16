"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CopyRef } from "@/components/CopyRef";
import { PlusIcon } from "@/components/Icons";
import { KycForm } from "@/components/KycForm";

type Done = { refCode: string; fullName: string; mobile: string; id?: string };

export function AgentSubmitFlow() {
  const [done, setDone] = useState<Done | null>(null);
  const [round, setRound] = useState(0); // remounts a fresh, empty form for the next customer
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      receiptRef.current?.focus({ preventScroll: true });
    }
  }, [done]);

  if (done) {
    return (
      <div className="receipt" aria-live="polite" ref={receiptRef} tabIndex={-1}>
        <div className="receipt-head">
          <div>
            <p className="hint">Reference ID for {done.fullName}</p>
            <p className="refcode" style={{ margin: 0 }}>{done.refCode}</p>
          </div>
          <span className="stamp" data-status="pending">
            SUBMITTED
            <small>awaiting review</small>
          </span>
        </div>
        <p style={{ margin: 0 }}>
          The admin will check the Aadhaar card against these details. You&apos;ll see the result in your list.
        </p>
        <div className="row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setDone(null);
              setRound((r) => r + 1);
            }}
          >
            <PlusIcon size={16} /> Next customer
          </button>
          <CopyRef refCode={done.refCode} />
          <Link href="/agent" className="btn btn-ghost btn-sm">Back to my list</Link>
        </div>
      </div>
    );
  }

  return <KycForm key={round} mode="agent-new" onDone={setDone} />;
}
