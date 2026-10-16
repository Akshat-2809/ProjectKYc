"use client";

import { useState } from "react";
import { CheckIcon } from "./Icons";

export function CopyRef({ refCode }: { refCode: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(refCode);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard blocked; the code is still visible to write down */
        }
      }}
    >
      {copied && <CheckIcon size={16} />}
      {copied ? "Copied" : "Copy ID"}
    </button>
  );
}
