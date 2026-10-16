import Link from "next/link";
import { BUSINESS_NAME } from "@/lib/brand";
import { AddAgentButton } from "./AddAgentButton";

export function AdminBar({ active = "submissions" }: { active?: "submissions" | "agents" }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/admin" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{BUSINESS_NAME}</span>
        </Link>
        <nav className="topnav">
          <Link href="/admin" className="navlink" aria-current={active === "submissions" ? "page" : undefined}>
            Submissions
          </Link>
          <Link href="/admin/agents" className="navlink" aria-current={active === "agents" ? "page" : undefined}>
            Agents
          </Link>
          <AddAgentButton />
          <form action="/api/admin/logout" method="post">
            <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
