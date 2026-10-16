"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tenDigits } from "@/lib/phone";
import { isStage, STAGE_LABEL } from "@/lib/stages";
import { AlertIcon, ArrowLeftIcon, Spinner } from "./Icons";
import { KycForm } from "./KycForm";

type Submission = {
  refCode: string;
  fullName: string;
  mobile: string;
  status: "pending" | "approved" | "rejected";
  stage: string | null;
  slotAt: string | null;
  rejectionReason: string | null;
  attempts: number;
  submittedAt: string;
  reviewedAt: string | null;
};

const STAMP = {
  pending: { word: "IN REVIEW", sub: "we're checking it" },
  approved: { word: "APPROVED", sub: "KYC complete" },
  rejected: { word: "REJECTED", sub: "please re-upload" },
} as const;

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function StatusFlow() {
  const params = useSearchParams();
  const [ref, setRef] = useState(params.get("ref") ?? "");
  const [mobile, setMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sub, setSub] = useState<Submission | null>(null);
  const [reuploading, setReuploading] = useState(false);

  async function lookup(refCode: string, mobileNo: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kyc/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref: refCode, mobile: mobileNo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "Something went wrong. Try again.");
        setSub(null);
        return;
      }
      setSub(data.submission);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    lookup(ref, mobile);
  }

  if (sub && reuploading) {
    return (
      <>
        <button type="button" className="back" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem", marginBottom: "1rem", font: "inherit" }} onClick={() => setReuploading(false)}>
          <ArrowLeftIcon size={16} /> Back to status
        </button>
        <p className="note reveal" style={{ marginBottom: "1.5rem" }}>
          Re-uploading for <span className="mono">{sub.refCode}</span>. Fix what the reviewer pointed out,
          then submit again.
        </p>
        <KycForm
          mode="resubmit"
          refCode={sub.refCode}
          currentMobile={sub.mobile}
          initialName={sub.fullName}
          onDone={(r) => {
            setReuploading(false);
            lookup(r.refCode, r.mobile);
          }}
        />
      </>
    );
  }

  if (sub) {
    const stamp = STAMP[sub.status];
    return (
      <div className="receipt" aria-live="polite" key={`${sub.status}-${sub.attempts}`}>
        <div className="receipt-head">
          <div>
            <p className="hint">Reference ID</p>
            <p className="refcode" style={{ margin: 0 }}>{sub.refCode}</p>
          </div>
          <span key={sub.status + sub.attempts} className="stamp" data-status={sub.status}>
            {stamp.word}
            <small>{stamp.sub}</small>
          </span>
        </div>

        <dl>
          <dt>Name</dt>
          <dd>{sub.fullName}</dd>
          <dt>Mobile</dt>
          <dd>+91 {sub.mobile}</dd>
          <dt>Submitted</dt>
          <dd>{when(sub.submittedAt)}</dd>
          {sub.reviewedAt && (
            <>
              <dt>Reviewed</dt>
              <dd>{when(sub.reviewedAt)}</dd>
            </>
          )}
        </dl>

        {sub.status === "pending" && (
          <p style={{ margin: 0 }}>Your documents are waiting to be checked. Come back here to see the result.</p>
        )}
        {sub.status === "approved" && (
          <p style={{ margin: 0 }}>
            Your identity is verified.{" "}
            {sub.stage === "paid"
              ? "Everything is done."
              : isStage(sub.stage)
                ? `Current step: ${STAGE_LABEL[sub.stage]}.`
                : null}
            {sub.stage === "scanner" && sub.slotAt && (
              <>
                {" "}Your slot: <strong>{when(sub.slotAt)}</strong>.
              </>
            )}
          </p>
        )}
        {sub.status === "rejected" && (
          <>
            <div className="alert" style={{ margin: 0 }}>
              <AlertIcon size={18} />
              <div>
                <strong>What needs fixing</strong>
                <p style={{ margin: "0.25rem 0 0" }}>{sub.rejectionReason}</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setReuploading(true)}>
              Re-upload documents
            </button>
          </>
        )}

        <div className="row">
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => lookup(sub.refCode, sub.mobile)}>
            {busy && <Spinner size={14} />}
            {busy ? "Refreshing" : "Refresh"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSub(null)}>
            Look up another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="step-body">
      {error && (
        <p className="alert shake" role="alert" style={{ margin: 0 }} key={error}>
          <AlertIcon size={18} />
          <span>{error}</span>
        </p>
      )}
      <div className="field">
        <label className="label" htmlFor="ref">Reference ID</label>
        <input
          id="ref"
          className="input refinput"
          placeholder="KYC-XXXXXXXX"
          autoComplete="off"
          spellCheck={false}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="mobile">Mobile number you submitted</label>
        <div className="input-prefix">
          <span>+91</span>
          <input
            id="mobile"
            className="input"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit number"
            value={mobile}
            onChange={(e) => setMobile(tenDigits(e.target.value))}
          />
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy || !ref || !mobile}>
        {busy && <Spinner />}
        {busy ? "Checking" : "Check status"}
      </button>
      <p className="hint">
        Haven&apos;t submitted yet? <Link href="/kyc">Start your KYC</Link>.
      </p>
    </form>
  );
}
