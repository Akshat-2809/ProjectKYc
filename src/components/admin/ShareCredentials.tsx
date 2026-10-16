"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/Icons";
import { credentialsMessage } from "@/lib/credentials";

const CopyIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);

/**
 * The agent's sign-in details as a ready-to-send message, with a Copy button.
 * The password only exists here, in the admin's browser — the server keeps just its hash.
 */
export function ShareCredentials({
  name,
  phone,
  password,
  kind,
}: {
  name: string;
  phone: string;
  password: string;
  kind: "new" | "reset";
}) {
  const [copied, setCopied] = useState(false);
  const loginUrl = `${window.location.origin}/agent/login`;
  const text = credentialsMessage({ name, phone, password, loginUrl, kind });

  return (
    <div className="share-creds reveal">
      <p className="share-title">Send {name.split(" ")[0]} their sign-in details</p>
      <pre className="share-preview" aria-label="Message preview">{text}</pre>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked; the message is visible above to copy by hand */
          }
        }}
      >
        {copied ? <CheckIcon size={18} /> : <CopyIcon />}
        {copied ? "Copied" : "Copy message"}
      </button>
      <p className="hint" style={{ margin: 0 }}>
        Paste it into WhatsApp or SMS to the agent. This password stays the same until you change it from the Agents
        page.
      </p>
    </div>
  );
}
