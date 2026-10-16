"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { env } from "@/lib/env";
import { UNIQUE_VIOLATION } from "@/lib/kyc";
import { hashPassword } from "@/lib/password";
import { db } from "@/lib/supabase";
import { mobileSchema } from "@/lib/validation";

export type AgentFormState =
  | {
      error?: string;
      ok?: boolean;
      message?: string;
      at?: number;
      /** Saved agent's details, for the "send sign-in details" buttons. */
      name?: string;
      phone?: string;
      /** Added in the admin's browser only (never sent back by the server). */
      password?: string;
    }
  | undefined;

const nameSchema = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .refine((v) => v.length >= 2 && v.length <= 60, { message: "Enter the agent's name (2 to 60 characters)." });

const passwordSchema = z
  .string()
  .refine((v) => v.length >= 8, { message: "Password must be at least 8 characters." })
  .refine((v) => v.length <= 72, { message: "Password is too long." });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (error: string): AgentFormState => ({ error, at: Date.now() });

export async function createAgent(_prev: AgentFormState, formData: FormData): Promise<AgentFormState> {
  await requireAdmin();
  const name = nameSchema.safeParse(String(formData.get("name") ?? ""));
  if (!name.success) return fail(name.error.issues[0].message);
  const phone = mobileSchema.safeParse(String(formData.get("phone") ?? ""));
  if (!phone.success) return fail(phone.error.issues[0].message);
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return fail(password.error.issues[0].message);

  if (phone.data === env.adminPhone) return fail("That's the admin's own number. Use the agent's phone number.");

  const { error } = await db()
    .from("agents")
    .insert({ name: name.data, phone: phone.data, password_hash: await hashPassword(password.data) });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return fail("An agent with this phone number already exists.");
    console.error("create agent failed", error);
    return fail("Couldn't create the agent. Try again.");
  }

  refresh();
  return {
    ok: true,
    at: Date.now(),
    message: `${name.data} can now sign in with ${phone.data} and the password you set.`,
    name: name.data,
    phone: phone.data,
  };
}

export async function resetAgentPassword(
  id: string,
  _prev: AgentFormState,
  formData: FormData,
): Promise<AgentFormState> {
  await requireAdmin();
  if (!UUID.test(id)) return fail("Unknown agent.");
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) return fail(password.error.issues[0].message);

  const supabase = db();
  const { data: agent } = await supabase.from("agents").select("session_version").eq("id", id).maybeSingle();
  if (!agent) return fail("Unknown agent.");

  const { error } = await supabase
    .from("agents")
    .update({
      password_hash: await hashPassword(password.data),
      session_version: agent.session_version + 1, // signs them out on every device
    })
    .eq("id", id);
  if (error) return fail("Couldn't change the password. Try again.");

  refresh();
  return { ok: true, at: Date.now(), message: "Password changed. They've been signed out everywhere." };
}

export async function setAgentActive(id: string, active: boolean): Promise<AgentFormState> {
  await requireAdmin();
  if (!UUID.test(id)) return fail("Unknown agent.");
  const supabase = db();
  const { data: agent } = await supabase.from("agents").select("session_version").eq("id", id).maybeSingle();
  if (!agent) return fail("Unknown agent.");

  const { error } = await supabase
    .from("agents")
    .update({ active, ...(active ? {} : { session_version: agent.session_version + 1 }) })
    .eq("id", id);
  if (error) return fail("Couldn't update the agent. Try again.");
  refresh();
  return { ok: true, at: Date.now() };
}

/** Only agents with no entries can be deleted; otherwise turn them off to keep the history. */
export async function deleteAgent(id: string): Promise<AgentFormState> {
  await requireAdmin();
  if (!UUID.test(id)) return fail("Unknown agent.");
  const supabase = db();
  const { count } = await supabase
    .from("kyc_submissions")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", id);
  if ((count ?? 0) > 0) {
    return fail(`This agent has ${count} ${count === 1 ? "entry" : "entries"}. Turn the account off instead, so their history stays.`);
  }
  const { error } = await supabase.from("agents").delete().eq("id", id);
  if (error) return fail("Couldn't delete the agent. Try again.");
  refresh();
  return { ok: true, at: Date.now() };
}
