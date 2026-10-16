"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KycForm } from "@/components/KycForm";

export function AgentReupload(props: { id: string; refCode: string; mobile: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Re-upload documents
      </button>
    );
  }
  return (
    <div className="reveal" style={{ marginTop: "0.5rem" }}>
      <KycForm
        mode="agent-resubmit"
        id={props.id}
        refCode={props.refCode}
        currentMobile={props.mobile}
        initialName={props.name}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}
