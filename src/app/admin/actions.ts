"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { endAdminSession, requireAdmin, startAdminSession } from "@/lib/auth";
import { env, STORAGE_BUCKET } from "@/lib/env";
import { safeEqual, verifyPassword } from "@/lib/password";
import { clearBucket, clientIp, isRateLimited, recordEvent } from "@/lib/rate-limit";
import { db } from "@/lib/supabase";
import { normalizeMobile, rejectionReasonSchema } from "@/lib/validation";
import * as steps from "@/lib/stage-ops";
import { isStage } from "@/lib/stages";

export type FormState = { error?: string; at?: number; ok?: boolean; name?: string } | undefined;

// ─── Login / logout ────────────────────────────────────────────

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const bucket = `admin-login:${await clientIp()}`;
  if (await isRateLimited(bucket, 5, 15)) {
    return { error: "Too many wrong attempts. Wait 15 minutes and try again.", at: Date.now() };
  }

  const phone = normalizeMobile(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");

  const phoneOk = safeEqual(phone, env.adminPhone);
  const passwordOk = await verifyPassword(password, env.adminPasswordHash);

  if (!phoneOk || !passwordOk) {
    await recordEvent(bucket);
    return { error: "Phone number or password is incorrect.", at: Date.now() };
  }

  await clearBucket(bucket);
  await startAdminSession();
  // The login form shows a short welcome screen, then moves to /admin itself.
  return { ok: true, name: process.env.ADMIN_NAME?.trim() || "Viral" };
}

export async function logout(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}

// ─── Review actions (each one re-checks the session) ───────────

export async function approve(id: string): Promise<FormState> {
  await requireAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db()
    .from("kyc_submissions")
    .update({
      status: "approved",
      rejection_reason: null,
      reviewed_at: now,
      // Approval starts the steps: the agent books a slot first
      stage: "slot",
      slot_at: null,
      stage_updated_at: now,
    })
    .eq("id", id)
    .eq("status", "pending") // only a pending request can be approved
    .select("id");
  if (error) return { error: "Couldn't approve. Try again." };
  if (data && data.length > 0) await steps.logApproval(id);
  refresh();
}

// ─── Steps after approval (admin can do everything an agent can, plus Paid) ───

export async function adminBookSlot(id: string, _prev: steps.StepResult, formData: FormData): Promise<steps.StepResult> {
  await requireAdmin();
  const r = await steps.bookSlot(id, { role: "admin" }, String(formData.get("date") ?? ""), String(formData.get("time") ?? ""));
  if (r?.ok) refresh();
  return r;
}

export async function adminRecordResult(id: string, result: "done" | "fail"): Promise<steps.StepResult> {
  await requireAdmin();
  const r = await steps.recordResult(id, { role: "admin" }, result);
  if (r?.ok) refresh();
  return r;
}

export async function adminMarkPaid(id: string): Promise<steps.StepResult> {
  await requireAdmin();
  const r = await steps.markPaid(id);
  if (r?.ok) refresh();
  return r;
}

/** The admin can put an approved entry on any step (to fix a mistake). */
export async function adminSetStage(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const to = String(formData.get("stage") ?? "");
  if (!isStage(to)) return { error: "Choose a step." };
  const r = await steps.adminSetStage(id, to);
  if (r?.error) return { error: r.error };
  refresh();
}

export async function reject(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const reason = rejectionReasonSchema.safeParse(String(formData.get("reason") ?? ""));
  if (!reason.success) return { error: reason.error.issues[0].message };

  const { error } = await db()
    .from("kyc_submissions")
    .update({ status: "rejected", rejection_reason: reason.data, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending"); // an approved request can't be rejected
  if (error) return { error: "Couldn't reject. Try again." };
  refresh();
}

/** Permanently removes the customer's record and every file in their folder. */
export async function deleteSubmission(id: string): Promise<FormState> {
  await requireAdmin();
  const supabase = db();

  const { data: files } = await supabase.storage.from(STORAGE_BUCKET).list(id);
  if (files && files.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(files.map((f) => `${id}/${f.name}`));
    if (storageError) return { error: "Couldn't delete the PDF. Nothing was removed; try again." };
  }

  const { error } = await supabase.from("kyc_submissions").delete().eq("id", id);
  if (error) return { error: "The PDF was deleted but the record wasn't. Try again." };

  redirect("/admin?deleted=1");
}
