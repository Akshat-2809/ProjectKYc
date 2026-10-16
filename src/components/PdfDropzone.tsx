"use client";

import { useId, useState } from "react";
import { AlertIcon, CheckIcon, UploadIcon } from "./Icons";

const MAX_BYTES = 4 * 1024 * 1024;

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Checks type and size in the browser so customers get instant feedback. */
export function checkPdf(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "That file isn't a PDF. Upload the Aadhaar card as a PDF.";
  if (file.size > MAX_BYTES) return "The PDF is larger than 4 MB. Compress it and upload again.";
  return null;
}

export function PdfDropzone({
  file,
  onChange,
  error,
  progress,
}: {
  file: File | null;
  onChange: (file: File | null, error: string | null) => void;
  error?: string | null;
  /** 0–100 while uploading, otherwise null */
  progress?: number | null;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const filled = Boolean(file) && !error;

  function pick(f: File | undefined) {
    if (!f) return;
    onChange(f, checkPdf(f));
  }

  return (
    <div className="field">
      <label
        htmlFor={id}
        className="dropzone"
        data-drag={dragging}
        data-filled={filled}
        data-invalid={Boolean(error)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="dz-icon" key={filled ? "f" : error ? "e" : "u"}>
          {filled ? <CheckIcon size={22} /> : error ? <AlertIcon size={22} /> : <UploadIcon size={22} />}
        </span>
        {file ? (
          <>
            <span className="file-name">{file.name}</span>
            <span className="hint">{formatSize(file.size)} · tap to choose a different file</span>
          </>
        ) : (
          <>
            <strong>{dragging ? "Drop it here" : "Choose the Aadhaar PDF"}</strong>
            <span className="hint">Or drag it here. PDF only, up to 4 MB.</span>
          </>
        )}
        {progress != null && <span className="dz-progress" style={{ width: `${progress}%` }} />}
        <input
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </label>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
