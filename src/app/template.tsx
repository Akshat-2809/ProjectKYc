import type { ReactNode } from "react";

/**
 * A template re-mounts on every navigation, so the entrance animations
 * replay each time someone moves between pages.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-transition">{children}</div>;
}
