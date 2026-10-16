import Link from "next/link";
import type React from "react";
import { IdCardIcon, ShieldIcon, UsersIcon } from "@/components/Icons";
import { Splash } from "@/components/Splash";
import { TopBar } from "@/components/TopBar";

const OPTIONS = [
  {
    href: "/agent/login",
    title: "Agent login",
    body: "Sign in with the phone number and password you were given, then submit KYC for your customers.",
    Icon: UsersIcon,
  },
  {
    href: "/admin/login",
    title: "Admin",
    body: "Review submissions, approve or reject them, and manage agent accounts.",
    Icon: ShieldIcon,
  },
  {
    href: "/kyc",
    title: "Individual",
    body: "Completing your own KYC? Upload your Aadhaar card here. No account needed.",
    Icon: IdCardIcon,
  },
];

export default function Home() {
  return (
    <div className="with-splash">
      <Splash />
      <TopBar link={{ href: "/status", label: "Check status" }} showHome={false} />
      <main className="page page-wide">
        <h1 className="enter">How are you signing in?</h1>
        <p className="lede enter" style={{ "--i": 1 } as React.CSSProperties}>
          Choose one to continue.
        </p>
        <nav className="choices" aria-label="Choose how to continue">
          {OPTIONS.map(({ href, title, body, Icon }, i) => (
            <Link
              key={href}
              href={href}
              className="choice enter"
              style={{ "--i": 2 + i } as React.CSSProperties}
            >
              <span className="choice-icon">
                <Icon size={24} />
              </span>
              <span className="choice-text">
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
              <span className="choice-go" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          ))}
        </nav>
      </main>
    </div>
  );
}
