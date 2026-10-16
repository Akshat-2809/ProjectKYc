import type React from "react";
import { Suspense } from "react";
import { StatusFlow } from "@/components/StatusFlow";
import { TopBar } from "@/components/TopBar";

export default function StatusPage() {
  return (
    <>
      <TopBar link={{ href: "/kyc", label: "New KYC" }} />
      <main className="page">
        <h1 className="enter">Check your KYC status</h1>
        <p className="lede enter" style={{ "--i": 1 } as React.CSSProperties}>Enter the reference ID you got after submitting, and the mobile number you used.</p>
        {/* StatusFlow reads ?ref= from the URL, which needs a Suspense boundary */}
        <div className="enter" style={{ "--i": 2 } as React.CSSProperties}>
          <Suspense fallback={<div className="skeleton" style={{ height: "12rem" }} />}>
            <StatusFlow />
          </Suspense>
        </div>
      </main>
    </>
  );
}
