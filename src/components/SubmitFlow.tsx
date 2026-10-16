"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CopyRef } from "./CopyRef";
import { KycForm } from "./KycForm";

type Done = { refCode: string; fullName: string; mobile: string };

export function SubmitFlow() {
  const [done, setDone] = useState<Done | null>(null);
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
            <p className="hint">Your reference ID</p>
            <p className="refcode" style={{ margin: 0 }}>{done.refCode}</p>
          </div>
          <span className="stamp" data-status="pending">
            RECEIVED
            <small>awaiting review</small>
          </span>
        </div>
        <p style={{ margin: 0 }}>
          Thanks, {done.fullName.split(" ")[0]}. We&apos;ll check your Aadhaar card against the details you
          entered. Save this reference ID: you&apos;ll need it with your mobile number to check your status.
        </p>
        <div className="row">
          <CopyRef refCode={done.refCode} />
          <Link href={`/status?ref=${done.refCode}`} className="btn btn-primary btn-sm">
            Check status
          </Link>
        </div>
      </div>
    );
  }

  return <KycForm mode="new" onDone={setDone} />;
}
