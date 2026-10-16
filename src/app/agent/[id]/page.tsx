import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AgentBar } from "@/components/agent/AgentBar";
import { AgentReupload } from "@/components/agent/AgentReupload";
import { EditDetails } from "@/components/agent/EditDetails";
import { AlertIcon, ArrowLeftIcon } from "@/components/Icons";
import { requireAgent } from "@/lib/auth";
import { STORAGE_BUCKET } from "@/lib/env";
import { formatSlot, istInputs, when } from "@/lib/format";
import { StepActions } from "@/components/steps/StepActions";
import { StageHistory } from "@/components/steps/StageHistory";
import { StageTracker } from "@/components/steps/StageTracker";
import { canAgentUndo, SLOT_MINUTES, STAGE_LABEL } from "@/lib/stages";
import { db, type KycSubmission, type StageEvent } from "@/lib/supabase";

export const metadata = { title: "KYC entry" };

type Params = Promise<{ id: string }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAMP = {
  pending: { word: "IN REVIEW", sub: "admin is checking it" },
  approved: { word: "APPROVED", sub: "KYC complete" },
  rejected: { word: "REJECTED", sub: "please re-upload" },
} as const;

export default function AgentEntryPage({ params }: { params: Params }) {
  return (
    <Suspense
      fallback={
        <main className="page" aria-busy="true">
          <div className="skeleton" style={{ height: "18rem" }} />
        </main>
      }
    >
      <Entry params={params} />
    </Suspense>
  );
}

async function Entry({ params }: { params: Params }) {
  const agent = await requireAgent();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = db();
  const { data } = await supabase
    .from("kyc_submissions")
    .select("*")
    .eq("id", id)
    .eq("agent_id", agent.id) // only their own entries
    .maybeSingle();
  if (!data) notFound();
  const sub = data as KycSubmission;

  let pdfUrl: string | null = null;
  if (sub.file_path) {
    const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(sub.file_path, 60 * 10);
    pdfUrl = signed?.signedUrl ?? null;
  }
  const { data: eventRows } = await supabase
    .from("kyc_stage_events")
    .select("*")
    .eq("submission_id", sub.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const events = (eventRows ?? []) as StageEvent[];
  const stage = sub.status === "approved" ? (sub.stage ?? "slot") : null;
  const slotIn = istInputs(sub.slot_at);
  const undoable = stage !== null && canAgentUndo(events[0] ?? null, sub.stage, agent.id);

  const stamp =
    sub.status === "approved" && stage
      ? stage === "paid"
        ? { word: "COMPLETED", sub: "everything done" }
        : stage === "completed_unpaid"
          ? { word: "COMPLETED", sub: "waiting for payment" }
        : { word: "APPROVED", sub: `now on ${STAGE_LABEL[stage]}` }
      : STAMP[sub.status];

  return (
    <>
      <AgentBar name={agent.name} />
      <main className="page">
        <Link href="/agent" className="back back-link enter">
          <ArrowLeftIcon size={16} /> Back to my list
        </Link>
        <div className="receipt" key={`${sub.status}-${sub.attempts}`}>
          <div className="receipt-head">
            <div>
              <p className="hint">Reference ID</p>
              <p className="refcode" style={{ margin: 0 }}>{sub.ref_code}</p>
            </div>
            <span className="stamp" data-status={sub.status === "approved" ? "approved" : sub.status}>
              {stamp.word}
              <small>{stamp.sub}</small>
            </span>
          </div>
          <dl>
            <dt>Customer</dt>
            <dd>{sub.full_name}</dd>
            <dt>Mobile</dt>
            <dd>+91 {sub.mobile}</dd>
            <dt>Submitted</dt>
            <dd>
              {when(sub.submitted_at, true)}
              {sub.attempts > 1 && ` (upload ${sub.attempts})`}
            </dd>
            {sub.reviewed_at && (
              <>
                <dt>Reviewed</dt>
                <dd>{when(sub.reviewed_at, true)}</dd>
              </>
            )}
          </dl>
          {(sub.status === "pending" || sub.status === "rejected") && (
            <EditDetails key={`${sub.full_name}|${sub.mobile}`} id={sub.id} name={sub.full_name} mobile={sub.mobile} />
          )}
          {pdfUrl && (
            <p style={{ margin: 0 }}>
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                View uploaded PDF
              </a>
            </p>
          )}
          {stage && (
            <div className="step-zone">
              <p className="label" style={{ margin: 0 }}>Steps after approval</p>
              <StageTracker stage={stage} />
              <StepActions
                key={`${stage}-${sub.slot_at ?? "none"}`}
                id={sub.id}
                role="agent"
                stage={stage}
                slotText={sub.slot_at ? formatSlot(sub.slot_at, SLOT_MINUTES) : null}
                slotDate={slotIn.date}
                slotTime={sub.slot_at ? slotIn.time : ""}
                today={istInputs().date}
                canUndo={undoable}
              />
            </div>
          )}
          {sub.status === "rejected" && (
            <>
              <div className="alert" style={{ margin: 0 }}>
                <AlertIcon size={18} />
                <div>
                  <strong>What needs fixing</strong>
                  <p style={{ margin: "0.25rem 0 0" }}>{sub.rejection_reason}</p>
                </div>
              </div>
              <AgentReupload id={sub.id} refCode={sub.ref_code} mobile={sub.mobile} name={sub.full_name} />
            </>
          )}
        </div>
        <div style={{ marginTop: "1rem" }}>
          <StageHistory events={events} agentNames={new Map([[agent.id, "You"]])} />
        </div>
      </main>
    </>
  );
}
