import type React from "react";
import { SubmitFlow } from "@/components/SubmitFlow";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Complete your KYC" };

/** Individual customers submitting their own KYC (no login needed). */
export default function IndividualKycPage() {
  return (
    <>
      <TopBar link={{ href: "/status", label: "Check status" }} />
      <main className="page">
        <h1 className="enter">Complete your KYC</h1>
        <p className="lede enter" style={{ "--i": 1 } as React.CSSProperties}>
          Enter your details and upload your Aadhaar card. Each card is checked by hand, and you can see
          the result any time with your reference ID.
        </p>
        <div className="enter" style={{ "--i": 2 } as React.CSSProperties}>
          <SubmitFlow />
        </div>
      </main>
    </>
  );
}
