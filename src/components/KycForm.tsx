"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tenDigits } from "@/lib/phone";
import { AlertIcon, CheckIcon, Spinner } from "./Icons";
import { PdfDropzone, checkPdf } from "./PdfDropzone";

type Field = "fullName" | "mobile" | "file" | "consent";
type Errors = Partial<Record<Field, string>>;
type Result = { refCode: string; fullName: string; mobile: string; id?: string };

type Props =
  | { mode: "new"; onDone: (result: Result) => void }
  | {
      mode: "resubmit";
      refCode: string;
      currentMobile: string;
      initialName: string;
      onDone: (result: Result) => void;
    }
  | { mode: "agent-new"; onDone: (result: Result) => void }
  | {
      mode: "agent-resubmit";
      id: string;
      refCode: string;
      currentMobile: string;
      initialName: string;
      onDone: (result: Result) => void;
    };

const ENDPOINT: Record<Props["mode"], string> = {
  new: "/api/kyc/submit",
  resubmit: "/api/kyc/resubmit",
  "agent-new": "/api/agent/kyc/submit",
  "agent-resubmit": "/api/agent/kyc/resubmit",
};

function cleanMobile(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  if (d.length === 11 && d.startsWith("0")) return d.slice(1);
  return d;
}

function validate(fullName: string, mobile: string, file: File | null, consent: boolean): Errors {
  const errors: Errors = {};
  if (fullName.trim().length < 2) errors.fullName = "Enter your full name as printed on your Aadhaar card.";
  if (!/^[6-9]\d{9}$/.test(cleanMobile(mobile))) errors.mobile = "Enter a valid 10-digit Indian mobile number.";
  if (!file) errors.file = "Upload your Aadhaar card as a PDF.";
  else {
    const fileError = checkPdf(file);
    if (fileError) errors.file = fileError;
  }
  if (!consent) errors.consent = "Tick the box to continue.";
  return errors;
}

type UploadResponse = { status: number; data: { ok?: boolean; error?: string; field?: string; refCode?: string } | null };

/** XHR instead of fetch so we can show real upload progress. */
function upload(url: string, body: FormData, onProgress: (pct: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(body);
  });
}

function StepNum({ n, done }: { n: number; done: boolean }) {
  return (
    <span className="step-num" aria-hidden="true">
      {done ? <CheckIcon size={16} /> : n}
    </span>
  );
}

export function KycForm(props: Props) {
  const resubmit = props.mode === "resubmit" || props.mode === "agent-resubmit";
  const byAgent = props.mode === "agent-new" || props.mode === "agent-resubmit";
  const router = useRouter();
  const [fullName, setFullName] = useState(resubmit ? props.initialName : "");
  const [mobile, setMobile] = useState(resubmit ? props.currentMobile : "");
  const [file, setFile] = useState<File | null>(null);
  // Agents don't see the consent step, so it counts as given for them.
  const [consent, setConsent] = useState(props.mode === "agent-new" || props.mode === "agent-resubmit");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0); // re-triggers the shake on each failed submit

  const busy = progress !== null;
  const detailsDone = fullName.trim().length >= 2 && /^[6-9]\d{9}$/.test(cleanMobile(mobile));
  const fileDone = Boolean(file) && !errors.file;
  const totalSteps = byAgent ? 2 : 3;
  const doneCount = [detailsDone, fileDone, ...(byAgent ? [] : [consent])].filter(Boolean).length;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(fullName, mobile, file, consent);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setAttempt((a) => a + 1);
      const first = document.querySelector<HTMLElement>("[aria-invalid='true']");
      first?.focus({ preventScroll: true });
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const body = new FormData();
    body.set("fullName", fullName);
    body.set("mobile", mobile);
    body.set("consent", "yes");
    body.set("file", file as File);
    if (props.mode === "resubmit") {
      body.set("ref", props.refCode);
      body.set("currentMobile", props.currentMobile);
    }
    if (props.mode === "agent-resubmit") body.set("id", props.id);

    setProgress(0);
    try {
      const { status, data } = await upload(ENDPOINT[props.mode], body, setProgress);

      if (status === 401 && byAgent) {
        router.push("/agent/login");
        return;
      }
      if (status >= 400 || !data?.ok) {
        const message =
          data?.error ??
          (status === 413
            ? "The PDF is too large. Compress it under 4 MB and try again."
            : "Something went wrong. Check your connection and try again.");
        if (data?.field) setErrors({ [data.field as Field]: message });
        else setFormError(message);
        setAttempt((a) => a + 1);
        return;
      }

      props.onDone({
        refCode: resubmit ? props.refCode : (data.refCode as string),
        id: (data as { id?: string }).id,
        fullName: fullName.trim().replace(/\s+/g, " "),
        mobile: cleanMobile(mobile),
      });
    } catch {
      setFormError("Couldn't reach the server. Check your connection and try again.");
      setAttempt((a) => a + 1);
    } finally {
      setProgress(null);
    }
  }

  const label = busy
    ? progress! < 100
      ? `Uploading ${progress}%`
      : "Saving…"
    : resubmit
      ? "Upload again"
      : byAgent
        ? "Submit customer KYC"
        : "Submit for verification";

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="rail" role="progressbar" aria-label="Form progress" aria-valuemin={0} aria-valuemax={totalSteps} aria-valuenow={doneCount}>
        <span style={{ width: `${(doneCount / totalSteps) * 100}%` }} />
      </div>

      {formError && (
        <p key={`fe-${attempt}`} className="alert shake" role="alert">
          <AlertIcon size={18} />
          <span>{formError}</span>
        </p>
      )}

      <section className="step" data-done={detailsDone}>
        <StepNum n={1} done={detailsDone} />
        <div>
          <h2>{byAgent ? "Customer details" : "Your details"}</h2>
          <div className="step-body">
            <div className="field">
              <label className="label" htmlFor="fullName">Full name</label>
              <input
                id="fullName"
                className="input"
                autoComplete="name"
                placeholder="As printed on Aadhaar"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined }));
                }}
                aria-invalid={Boolean(errors.fullName)}
                aria-describedby="fullName-hint"
              />
              {errors.fullName ? (
                <p key={`n-${attempt}`} className="field-error">{errors.fullName}</p>
              ) : (
                <p id="fullName-hint" className="hint">Exactly as it appears on {byAgent ? "the customer’s" : "your"} Aadhaar card.</p>
              )}
            </div>

            <div className="field">
              <label className="label" htmlFor="mobile">Aadhaar-linked mobile number</label>
              <div className="input-prefix">
                <span>+91</span>
                <input
                  id="mobile"
                  className="input"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10-digit number"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(tenDigits(e.target.value));
                    if (errors.mobile) setErrors((p) => ({ ...p, mobile: undefined }));
                  }}
                  aria-invalid={Boolean(errors.mobile)}
                  aria-describedby="mobile-hint"
                />
              </div>
              {errors.mobile ? (
                <p key={`m-${attempt}`} className="field-error">{errors.mobile}</p>
              ) : (
                <p id="mobile-hint" className="hint">The number registered with {byAgent ? "the customer’s" : "your"} Aadhaar.</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="step" data-done={fileDone}>
        <StepNum n={2} done={fileDone} />
        <div>
          <h2>Aadhaar card</h2>
          <div className="step-body">
            <PdfDropzone
              file={file}
              error={errors.file}
              progress={progress}
              onChange={(f, err) => {
                setFile(f);
                setErrors((prev) => ({ ...prev, file: err ?? undefined }));
              }}
            />
            <p className="hint">
              Upload the full card, front and back. An e-Aadhaar downloaded from the UIDAI website works.
            </p>
          </div>
        </div>
      </section>

      {byAgent ? (
        // Agents: no consent step, just the submit button under the upload
        <div className="agent-submit">
            <button type="submit" className="btn btn-primary btn-block btn-progress" disabled={busy} aria-live="polite">
              {busy && <span className="fill" style={{ width: `${progress}%` }} />}
              {busy && <Spinner />}
              <span>{label}</span>
            </button>
        </div>
      ) : (
        <section className="step" data-done={consent}>
          <StepNum n={3} done={consent} />
          <div>
            <h2>Confirm and submit</h2>
            <div className="step-body">
              <label className="check checkbox-row">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    setConsent(e.target.checked);
                    if (errors.consent) setErrors((p) => ({ ...p, consent: undefined }));
                  }}
                  aria-invalid={Boolean(errors.consent)}
                />
                <span>
                  I agree to share my Aadhaar card for identity verification. It will be used only for KYC and
                  deleted once my account is set up.
                </span>
              </label>
              {errors.consent && <p key={`c-${attempt}`} className="field-error">{errors.consent}</p>}
            <button type="submit" className="btn btn-primary btn-block btn-progress" disabled={busy} aria-live="polite">
              {busy && <span className="fill" style={{ width: `${progress}%` }} />}
              {busy && <Spinner />}
              <span>{label}</span>
            </button>
            </div>
          </div>
        </section>
      )}
    </form>
  );
}
