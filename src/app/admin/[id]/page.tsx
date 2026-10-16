import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/AdminBar";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { ArrowLeftIcon } from "@/components/Icons";
import { requireAdmin } from "@/lib/auth";
import { STORAGE_BUCKET } from "@/lib/env";
import { AdminStepControl } from "@/components/steps/AdminStepControl";
import { StepActions } from "@/components/steps/StepActions";
import { formatSlot, istInputs } from "@/lib/format";
import { StageHistory } from "@/components/steps/StageHistory";
import { StageTracker } from "@/components/steps/StageTracker";
import { StatusPill } from "@/components/steps/StatusPill";
import { db, type KycSubmission, type StageEvent } from "@/lib/supabase";

export const metadata = { title: "Review KYC" };

type Params = Promise<{ id: string }>;

export default function ReviewPage({ params }: { params: Params }) {
  return (
    <>
      <AdminBar />
      <main className="admin">
        <Suspense
          fallback={
            <div className="review" aria-busy="true" aria-label="Loading">
              <div className="review-side">
                <div className="skeleton" style={{ height: "18rem" }} />
                <div className="skeleton" style={{ height: "8rem" }} />
              </div>
              <div className="skeleton" style={{ height: "70vh" }} />
            </div>
          }
        >
          <Review params={params} />
        </Suspense>
      </main>
    </>
  );
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function Review({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = db();
  const { data } = await supabase.from("kyc_submissions").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const sub = data as KycSubmission;

  let submittedBy: { id: string; name: string; phone: string } | null = null;
  if (sub.agent_id) {
    const { data: agent } = await supabase.from("agents").select("id, name, phone").eq("id", sub.agent_id).maybeSingle();
    submittedBy = agent;
  }

  const { data: eventRows } = await supabase
    .from("kyc_stage_events")
    .select("*")
    .eq("submission_id", sub.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const events = (eventRows ?? []) as StageEvent[];
  const agentNames = new Map<string, string>(submittedBy ? [[submittedBy.id, submittedBy.name]] : []);
  const stage = sub.status === "approved" ? (sub.stage ?? "slot") : null;
  const slotIn = istInputs(sub.slot_at);

  // Short-lived link so the PDF can't be opened later from browser history.
  let pdfUrl: string | null = null;
  if (sub.file_path) {
    const { data: signed } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(sub.file_path, 60 * 10);
    pdfUrl = signed?.signedUrl ?? null;
  }

  return (
    <>
      <p style={{ margin: "0 0 1rem" }}>
        <Link href="/admin" className="back" style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <ArrowLeftIcon size={16} /> Back to submissions
        </Link>
      </p>

      <div className="review">
        <section className="panel review-facts">
            <dl className="facts">
              <div>
                <dt>Name entered</dt>
                <dd className="big">{sub.full_name}</dd>
              </div>
              <div>
                <dt>Aadhaar-linked mobile</dt>
                <dd className="big">+91 {sub.mobile}</dd>
              </div>
              <div>
                <dt>Submitted by</dt>
                <dd>
                  {submittedBy ? (
                    <Link href={`/admin?agent=${submittedBy.id}`} className="by-agent">
                      {submittedBy.name} (agent, {submittedBy.phone})
                    </Link>
                  ) : (
                    "The customer (individual)"
                  )}
                </dd>
              </div>
              <div>
                <dt>Reference ID</dt>
                <dd className="mono">{sub.ref_code}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <StatusPill status={sub.status} stage={stage} />
                </dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>
                  {when(sub.submitted_at)}
                  {sub.attempts > 1 && ` (upload ${sub.attempts})`}
                </dd>
              </div>
              {sub.reviewed_at && (
                <div>
                  <dt>Last reviewed</dt>
                  <dd>{when(sub.reviewed_at)}</dd>
                </div>
              )}
              {sub.status === "rejected" && sub.rejection_reason && (
                <div>
                  <dt>Rejection reason sent</dt>
                  <dd>{sub.rejection_reason}</dd>
                </div>
              )}
            </dl>
          </section>

        <div className="review-actions">
          {stage && (
            <section className="panel">
              <h2>Steps after approval</h2>
              <StageTracker stage={stage} />
              <StepActions
                key={`${stage}-${sub.slot_at ?? "none"}`}
                id={sub.id}
                role="admin"
                stage={stage}
                slotText={sub.slot_at ? formatSlot(sub.slot_at) : null}
                slotDate={slotIn.date}
                slotTime={sub.slot_at ? slotIn.time : ""}
                today={istInputs().date}
              />
              <details className="fix-step">
                <summary>Fix the step manually</summary>
                <AdminStepControl id={sub.id} stage={stage} />
              </details>
            </section>
          )}
          <StageHistory events={events} agentNames={agentNames} />
          <ReviewActions
            id={sub.id}
            status={sub.status}
            name={sub.full_name}
            reviewed={sub.reviewed_at ? when(sub.reviewed_at) : null}
          />
        </div>

        <section className="review-pdf">
          {pdfUrl ? (
            <>
              <div className="pdf-bar">
                <span className="label">Aadhaar PDF</span>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                  Open full screen
                </a>
              </div>
              <iframe className="pdf-frame" src={pdfUrl} title={`Aadhaar PDF for ${sub.full_name}`} />
              <p className="hint" style={{ marginTop: "0.5rem" }}>
                On a phone, use Open full screen to see every page. e-Aadhaar files ask for a password: the first 4 letters of the name in capitals plus the year of birth.
              </p>
            </>
          ) : (
            <div className="pdf-missing">
              <p>The PDF for this submission is missing or couldn&apos;t be loaded.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
