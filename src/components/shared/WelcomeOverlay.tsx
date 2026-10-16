"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type React from "react";

/** Full-screen "Hello <name>" moment shown after a successful sign-in, then opens `to`. */
export function WelcomeOverlay({ name, to, sub }: { name: string; to: string; sub: string }) {
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Full page load (not client-side navigation) so the login page isn't kept alive in the
    // background with its "signed in" state — otherwise this screen could replay after sign-out.
    const target = new URL(to, window.location.origin).href;
    const t = setTimeout(() => window.location.replace(target), reduce ? 700 : 2000);
    return () => clearTimeout(t);
  }, [to]);

  const word = (text: string, offset: number) =>
    text.split("").map((ch, i) => (
      <span key={i} className="welcome-char" style={{ "--i": offset + i } as React.CSSProperties}>
        {ch === " " ? " " : ch}
      </span>
    ));

  // Only ever rendered in the browser (after the sign-in response), so document exists.
  if (typeof document === "undefined") return null;

  // Portal to <body> so the overlay covers the whole screen, not just the login card.
  return createPortal(
    <div className="welcome" role="status" aria-live="polite">
      <div className="welcome-inner">
        <span className="welcome-badge" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path className="draw" d="M5 12.5l4.2 4.2L19 7" pathLength={1} />
          </svg>
        </span>
        <h1 className="welcome-title" aria-label={`Hello ${name}`}>
          <span aria-hidden="true">{word("Hello", 0)}</span>{" "}
          <span aria-hidden="true" className="welcome-name">{word(name, 6)}</span>
        </h1>
        <p className="welcome-sub">{sub}</p>
        <div className="welcome-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>,
    document.body,
  );
}
