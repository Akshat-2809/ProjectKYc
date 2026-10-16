"use client";

import type React from "react";
import { useEffect } from "react";
import { BUSINESS_NAME } from "@/lib/brand";

/**
 * Opening animation for customers. Pure CSS, so it plays on the very first paint
 * even before JavaScript loads, then lifts away to reveal the page.
 * A tiny script in the root layout skips it after the first view in a browser session.
 */
export function Splash() {
  // Once it has played, mark it seen so client-side visits back to the homepage skip it.
  useEffect(() => {
    const t = setTimeout(() => document.documentElement.classList.add("splash-seen"), 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="splash" aria-hidden="true">
      <div className="splash-inner">
        <span className="splash-mark">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle className="splash-ring" cx="12" cy="12" r="10" pathLength={1} />
            <path className="splash-check" d="M7.5 12.5l3 3 6-6.5" pathLength={1} />
          </svg>
        </span>
        <span className="splash-name">
          {BUSINESS_NAME.split("").map((ch, i) => (
            <span key={i} style={{ "--i": i } as React.CSSProperties}>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </span>
        <span className="splash-sub">Identity verification</span>
        <span className="splash-dots">
          <i />
          <i />
          <i />
        </span>
      </div>
    </div>
  );
}
