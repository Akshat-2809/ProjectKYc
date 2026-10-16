import Link from "next/link";
import type React from "react";
import { Suspense } from "react";
import { AgentBar } from "@/components/agent/AgentBar";
import { AgentSubmitFlow } from "@/components/agent/AgentSubmitFlow";
import { ArrowLeftIcon } from "@/components/Icons";
import { requireAgent } from "@/lib/auth";

export const metadata = { title: "New customer KYC" };

async function Bar() {
  const agent = await requireAgent();
  return <AgentBar name={agent.name} />;
}

export default function AgentNewPage() {
  return (
    <>
      <Suspense fallback={<div className="topbar" style={{ height: "3.6rem" }} />}>
        <Bar />
      </Suspense>
      <main className="page">
        <Link href="/agent" className="back back-link enter">
          <ArrowLeftIcon size={16} /> Back to my list
        </Link>
        <h1 className="enter" style={{ "--i": 1 } as React.CSSProperties}>New customer KYC</h1>
        <p className="lede enter" style={{ "--i": 2 } as React.CSSProperties}>
          Enter the customer&apos;s details exactly as on their Aadhaar card, then upload the card as a PDF.
        </p>
        <div className="enter" style={{ "--i": 3 } as React.CSSProperties}>
          <AgentSubmitFlow />
        </div>
      </main>
    </>
  );
}
