import Link from "next/link";
import type React from "react";
import { Suspense } from "react";
import { AgentBar } from "@/components/agent/AgentBar";
import { PlusIcon } from "@/components/Icons";
import { requireAgent } from "@/lib/auth";
import { StatusPill } from "@/components/steps/StatusPill";
import { cleanSearch, formatSlot, minutesAgoIso, slotTime, when } from "@/lib/format";
import { DONE_STAGES, IN_PROGRESS_STAGES, isStage, SLOT_MINUTES, type Stage } from "@/lib/stages";
import { db, type KycStatus } from "@/lib/supabase";

export const metadata = { title: "Your KYC entries" };

type Tab = "all" | "pending" | "rejected" | "progress" | "completed";
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
  { key: "progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];

/** Which tab an entry belongs to: before approval by status, after it by step. */
function tabOf(status: KycStatus, stage: string | null): Exclude<Tab, "all"> {
  if (status === "pending") return "pending";
  if (status === "rejected") return "rejected";
  return stage === "completed_unpaid" || stage === "paid" ? "completed" : "progress";
}
type Search = Promise<{ status?: string; q?: string; done?: string }>;

export default function AgentHomePage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AgentHome searchParams={searchParams} />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <main className="admin" aria-busy="true">
      <div className="skeleton" style={{ height: "2.2rem", width: "16rem", marginBottom: "1.5rem" }} />
      <div className="skeleton" style={{ height: "2.5rem", marginBottom: "1rem" }} />
      <div className="skeleton" style={{ height: "12rem" }} />
    </main>
  );
}

async function AgentHome({ searchParams }: { searchParams: Search }) {
  const agent = await requireAgent();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.status) ? (params.status as Tab) : "all";
  const q = cleanSearch(params.q);

  const supabase = db();
  // Every query is scoped to this agent: they never see anyone else's entries.
  const mine = () => supabase.from("kyc_submissions").select("status, stage").eq("agent_id", agent.id);
  let query = supabase
    .from("kyc_submissions")
    .select("id, ref_code, full_name, mobile, status, stage, slot_at, attempts, submitted_at, rejection_reason")
    .eq("agent_id", agent.id)
    .order("submitted_at", { ascending: false })
    .limit(300);
  if (tab === "pending" || tab === "rejected") query = query.eq("status", tab);
  if (tab === "completed") query = query.eq("status", "approved").in("stage", [...DONE_STAGES]);
  if (tab === "progress") query = query.eq("status", "approved").in("stage", [...IN_PROGRESS_STAGES]);
  if (q) query = query.or(`full_name.ilike.%${q}%,mobile.ilike.%${q}%,ref_code.ilike.%${q}%`);

  // Booked slots still waiting for the scanner, soonest first (including ones that just started)
  const upcomingQuery = supabase
    .from("kyc_submissions")
    .select("id, full_name, slot_at")
    .eq("agent_id", agent.id)
    .eq("status", "approved")
    .eq("stage", "scanner")
    .gte("slot_at", minutesAgoIso(60))
    .order("slot_at", { ascending: true })
    .limit(8);
  const toBook = supabase
    .from("kyc_submissions")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .eq("status", "approved")
    .eq("stage", "slot");

  const [list, all, upcoming, needSlot] = await Promise.all([query, mine(), upcomingQuery, toBook]);
  const counts: Record<Tab, number> = { all: 0, pending: 0, rejected: 0, progress: 0, completed: 0 };
  for (const r of all.data ?? []) {
    counts.all += 1;
    counts[tabOf(r.status as KycStatus, r.stage)] += 1;
  }
  const rows = list.data ?? [];
  const href = (t: Tab) => `/agent?status=${t}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <AgentBar name={agent.name} />
      <main className="admin">
        <div className="admin-head">
          <div>
            <h1>Your customers</h1>
            {(counts.rejected > 0 || counts.progress > 0) && (
              <p className="hint" style={{ margin: "0.3rem 0 0" }}>
                {[
                  counts.progress > 0 && `${counts.progress} in progress`,
                  (needSlot.count ?? 0) > 0 && `${needSlot.count} need a slot`,
                  counts.rejected > 0 && `${counts.rejected} to re-upload`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </div>
          <Link href="/agent/new" className="btn btn-primary">
            <PlusIcon size={18} /> New customer KYC
          </Link>
        </div>

        {(upcoming.data ?? []).length > 0 && (
          <section className="upcoming">
            <h2>Upcoming slots</h2>
            <ul>
              {(upcoming.data ?? []).map((u) => (
                <li key={u.id}>
                  <Link href={`/agent/${u.id}`}>
                    <span className="upcoming-time">{slotTime(u.slot_at)}</span>
                    <span className="upcoming-name">{u.full_name}</span>
                    <span className="upcoming-day">{formatSlot(u.slot_at, SLOT_MINUTES).split(",")[0]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="toolbar">
          <nav className="tabs" aria-label="Filter by status">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={href(t.key)}
                className="tab"
                data-tab={t.key}
                aria-current={tab === t.key ? "page" : undefined}
              >
                {t.label}
                <span className="count">{counts[t.key]}</span>
              </Link>
            ))}
          </nav>
          <form className="search" action="/agent">
            <input type="hidden" name="status" value={tab} />
            <input className="input" name="q" defaultValue={q} placeholder="Name, mobile or reference ID" aria-label="Search your entries" />
            <button type="submit" className="btn btn-ghost">Search</button>
          </form>
        </div>

        {list.error ? (
          <p className="alert">Couldn&apos;t load your entries. Refresh the page.</p>
        ) : rows.length === 0 ? (
          <div className="table-wrap">
            <div className="empty">
              {q ? (
                <p>Nothing matches “{q}”.</p>
              ) : counts.all === 0 ? (
                <>
                  <p style={{ margin: "0 0 1rem" }}>You haven&apos;t submitted any KYC yet.</p>
                  <Link href="/agent/new" className="btn btn-primary btn-sm">
                    <PlusIcon size={16} /> Submit your first one
                  </Link>
                </>
              ) : (
                <p>Nothing in {TABS.find((t) => t.key === tab)?.label} yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="list">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Mobile</th>
                  <th>Reference ID</th>
                  <th>Submitted</th>
                  <th>Status / step</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                    <td data-label="Name">
                      <Link className="row-link" href={`/agent/${r.id}`}>{r.full_name}</Link>
                      {r.status === "rejected" && r.rejection_reason && (
                        <span className="row-note">{r.rejection_reason}</span>
                      )}
                    </td>
                    <td data-label="Mobile">{r.mobile}</td>
                    <td data-label="Reference" className="mono">{r.ref_code}</td>
                    <td data-label="Submitted">{when(r.submitted_at)}</td>
                    <td data-label="Status">
                      <StatusPill status={r.status as KycStatus} stage={isStage(r.stage) ? (r.stage as Stage) : null} />
                      {r.stage === "scanner" && r.slot_at && <span className="slot-mini">{formatSlot(r.slot_at, SLOT_MINUTES)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
