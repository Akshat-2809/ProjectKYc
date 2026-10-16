import Link from "next/link";
import { agentLogout } from "@/app/agent/actions";
import { BUSINESS_NAME } from "@/lib/brand";

export function AgentBar({ name }: { name: string }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/agent" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{BUSINESS_NAME}</span>
        </Link>
        <nav className="topnav">
          <span className="who" title="Signed in agent">{name}</span>
          <form action={agentLogout}>
            <button type="submit" className="btn btn-ghost btn-sm">Sign out</button>
          </form>
        </nav>
      </div>
    </header>
  );
}
