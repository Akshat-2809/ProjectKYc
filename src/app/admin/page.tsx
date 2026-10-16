import Link from "next/link";
import type React from "react";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/AdminBar";
import { AgentFilter } from "@/components/admin/AgentFilter";
import { requireAdmin } from "@/lib/auth";
import { QuickPaidButton } from "@/components/steps/QuickPaidButton";
import { StatusPill } from "@/components/steps/StatusPill";
import { cleanSearch, formatSlot, when } from "@/lib/format";
import { isStage, type Stage } from "@/lib/stages";
import { db, type KycStatus } from "@/lib/supabase";

export const metadata = { title: "KYC review" };

type Tab = "all" | "pending" | "rejected" | Stage;
const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
  { key: "slot", label: "Slot booking" },
  { key: "scanner", label: "Scanner" },
  { key: "otp", label: "OTP" },
  { key: "active_kyc", label: "Active KYC" },
  { key: "completed_unpaid", label: "Completed (unpaid)" },
  { key: "paid", label: "Completed" },
];

/** Before approval an entry is counted by status; after it, by its current step. */
function tabOf(status: KycStatus, stage: string | null): Exclude<Tab, "all"> {
  if (status === "pending") return "pending";
  if (status === "rejected") return "rejected";
  return isStage(stage) ? stage : "slot";
}
type Search = Promise<{ status?: string; q?: string; deleted?: string; agent?: string }>;

export default function AdminPage({ searchParams }: { searchParams: Search }) {
  return (
    <>
      <AdminBar />
      <main className="admin">
        <Suspense fallback={<ListSkeleton />}>
          <Submissions searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading submissions">
      <div className="admin-head">
        <div className="skeleton" style={{ width: "14rem", height: "2rem" }} />
        <div className="skeleton" style={{ width: "min(100%, 24rem)", height: "2.75rem" }} />
      </div>
      <div className="skeleton" style={{ height: "2.5rem", marginBottom: "1rem" }} />
      <div className="table-wrap" style={{ padding: "1rem", display: "grid", gap: "0.75rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: "1.6rem", opacity: 1 - i * 0.18 }} />
        ))}
      </div>
    </div>
  );
}

async function Submissions({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.status) ? (params.status as Tab) : "all";
  const q = cleanSearch(params.q);

  const supabase = db();
  const { data: agentRows } = await supabase.from("agents").select("id, name, phone, active").order("name");
  const agents = agentRows ?? [];
  const agentName = new Map(agents.map((a) => [a.id, a.name]));

  // "" = everyone, otherwise an agent id
  const agentFilter = agents.some((a) => a.id === params.agent) ? (params.agent as string) : "";

  let summary = supabase.from("kyc_submissions").select("status, stage");
  if (agentFilter) summary = summary.eq("agent_id", agentFilter);

  let query = supabase
    .from("kyc_submissions")
    .select("id, ref_code, full_name, mobile, status, stage, slot_at, attempts, submitted_at, agent_id")
    .limit(300);
  if (agentFilter) query = query.eq("agent_id", agentFilter);
  if (tab === "pending" || tab === "rejected") query = query.eq("status", tab);
  else if (tab !== "all") query = query.eq("status", "approved").eq("stage", tab);
  if (q) query = query.or(`full_name.ilike.%${q}%,mobile.ilike.%${q}%,ref_code.ilike.%${q}%`);
  // Oldest first for the queue, newest first everywhere else.
  query = query.order("submitted_at", { ascending: tab === "pending" });

  const [list, all] = await Promise.all([query, summary]);

  const counts = Object.fromEntries(TABS.map((t) => [t.key, 0])) as Record<Tab, number>;
  for (const r of all.data ?? []) {
    counts.all += 1;
    counts[tabOf(r.status as KycStatus, r.stage)] += 1;
  }
  const rows = list.data ?? [];
  const href = (t: Tab) => {
    const p = new URLSearchParams({ status: t });
    if (q) p.set("q", q);
    if (agentFilter) p.set("agent", agentFilter);
    return `/admin?${p}`;
  };
  const filterLabel = agentFilter ? agentName.get(agentFilter) : null;

  return (
    <>
      <div className="admin-head">
        <div>
          <h1>KYC submissions</h1>
          {filterLabel && (
            <p className="hint" style={{ margin: "0.3rem 0 0" }}>
              Showing entries from <strong>{filterLabel}</strong>.{" "}
              <Link href={`/admin?status=${tab}`}>Show everyone</Link>
            </p>
          )}
        </div>
        <form className="filters" action="/admin">
          <input type="hidden" name="status" value={tab} />
          <AgentFilter agents={agents.map((a) => ({ id: a.id, name: a.name }))} value={agentFilter} />
          <div className="search">
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="Name, mobile or reference ID"
              aria-label="Search submissions"
            />
            <button type="submit" className="btn btn-ghost">
              Search
            </button>
          </div>
        </form>
      </div>

      {params.deleted && (
        <p className="flash" role="status">
          Customer data deleted permanently.
        </p>
      )}

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

      {list.error ? (
        <p className="alert">Couldn&apos;t load submissions. Refresh the page.</p>
      ) : rows.length === 0 ? (
        <div className="table-wrap">
          <p className="empty">
            {q
              ? `Nothing matches “${q}”.`
              : tab === "pending"
                ? "No KYC requests waiting for review."
                : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Submitted by</th>
                <th>Reference ID</th>
                <th>Submitted</th>
                <th>Status / step</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                  <td data-label="Name">
                    <Link className="row-link" href={`/admin/${r.id}`}>
                      {r.full_name}
                    </Link>
                  </td>
                  <td data-label="Mobile">{r.mobile}</td>
                  <td data-label="By">
                    {r.agent_id ? (
                      <Link className="by by-agent" href={`/admin?agent=${r.agent_id}&status=${tab}`}>
                        {agentName.get(r.agent_id) ?? "Agent"}
                      </Link>
                    ) : (
                      <span className="by">No agent</span>
                    )}
                  </td>
                  <td data-label="Reference" className="mono">
                    {r.ref_code}
                  </td>
                  <td data-label="Submitted">
                    {when(r.submitted_at)}
                    {r.attempts > 1 && <span className="by"> (upload {r.attempts})</span>}
                  </td>
                  <td data-label="Status">
                    <StatusPill status={r.status as KycStatus} stage={isStage(r.stage) ? r.stage : null} />
                    {r.stage === "scanner" && r.slot_at && <span className="slot-mini">{formatSlot(r.slot_at)}</span>}
                    {r.status === "approved" && r.stage === "completed_unpaid" && (
                      <QuickPaidButton id={r.id} name={r.full_name} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
