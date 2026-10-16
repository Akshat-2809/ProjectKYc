import Link from "next/link";
import type React from "react";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/AdminBar";
import { AgentRowActions } from "@/components/admin/AgentRowActions";
import { requireAdmin } from "@/lib/auth";
import { when } from "@/lib/format";
import { isStage, STAGE_SHORT, type Stage } from "@/lib/stages";
import { db, type AgentRow } from "@/lib/supabase";

type Key = "pending" | "rejected" | Stage;
const KEYS: { key: Key; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
  { key: "slot", label: STAGE_SHORT.slot },
  { key: "scanner", label: STAGE_SHORT.scanner },
  { key: "otp", label: STAGE_SHORT.otp },
  { key: "active_kyc", label: STAGE_SHORT.active_kyc },
  { key: "completed_unpaid", label: STAGE_SHORT.completed_unpaid },
  { key: "paid", label: STAGE_SHORT.paid },
];

export const metadata = { title: "Agents" };

export default function AgentsPage() {
  return (
    <>
      <AdminBar active="agents" />
      <main className="admin">
        <div className="admin-head">
          <h1>Agents</h1>
        </div>
        <Suspense fallback={<div className="skeleton" style={{ height: "20rem" }} />}>
          <AgentList />
        </Suspense>
      </main>
    </>
  );
}

async function AgentList() {
  await requireAdmin();
  const supabase = db();
  const [{ data: agents, error }, { data: subs }] = await Promise.all([
    supabase
      .from("agents")
      .select("id, name, phone, active, session_version, last_login_at, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("kyc_submissions").select("agent_id, status, stage").not("agent_id", "is", null),
  ]);

  if (error) return <p className="alert">Couldn&apos;t load agents. Refresh the page.</p>;

  const empty = (): Record<Key | "total", number> => ({
    total: 0, pending: 0, rejected: 0, slot: 0, scanner: 0, otp: 0, active_kyc: 0, completed_unpaid: 0, paid: 0,
  });
  const stats = new Map<string, Record<Key | "total", number>>();
  for (const s of subs ?? []) {
    const row = stats.get(s.agent_id) ?? empty();
    row.total += 1;
    const key: Key =
      s.status === "pending" ? "pending" : s.status === "rejected" ? "rejected" : isStage(s.stage) ? s.stage : "slot";
    row[key] += 1;
    stats.set(s.agent_id, row);
  }
  const list = (agents ?? []) as AgentRow[];

  if (list.length === 0) {
    return (
      <div className="panel empty">
        No agents yet. Use <strong>Add agent</strong> at the top to create the first one; they can sign in as soon as it&apos;s created.
      </div>
    );
  }

  return (
    <ul className="agent-list">
      {list.map((a, i) => {
        const st = stats.get(a.id) ?? empty();
        return (
          <li key={a.id} className="panel agent-card" data-active={a.active} style={{ "--i": i } as React.CSSProperties}>
            <div className="agent-top">
              <div>
                <strong className="agent-name">{a.name}</strong>
                <span className="agent-phone">+91 {a.phone}</span>
              </div>
              <span className="pill" data-status={a.active ? "approved" : "rejected"}>
                {a.active ? "Active" : "Off"}
              </span>
            </div>
            <Link className="agent-total" href={`/admin?agent=${a.id}&status=all`}>
              <b>{st.total}</b> {st.total === 1 ? "entry" : "entries"} in total
            </Link>
            <div className="agent-stats">
              {KEYS.map((k) => (
                <Link key={k.key} href={`/admin?agent=${a.id}&status=${k.key}`} data-key={k.key} data-zero={st[k.key] === 0}>
                  <b>{st[k.key]}</b> {k.label}
                </Link>
              ))}
            </div>
            <p className="hint" style={{ margin: 0 }}>
              {a.last_login_at ? `Last signed in ${when(a.last_login_at)}` : "Hasn't signed in yet"}
            </p>
            <AgentRowActions id={a.id} name={a.name} phone={a.phone} active={a.active} />
          </li>
        );
      })}
    </ul>
  );
}
