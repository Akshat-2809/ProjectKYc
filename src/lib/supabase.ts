import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export type KycStatus = "pending" | "approved" | "rejected";

export type KycSubmission = {
  id: string;
  ref_code: string;
  full_name: string;
  mobile: string;
  file_path: string | null;
  file_size: number | null;
  status: KycStatus;
  rejection_reason: string | null;
  attempts: number;
  consent_at: string;
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  /** null = submitted by the customer themselves ("Individual") */
  agent_id: string | null;
  /** Step after approval; null until approved */
  stage: import("./stages").Stage | null;
  stage_updated_at: string | null;
  /** Start of the booked 20-minute slot */
  slot_at: string | null;
};

export type StageEvent = {
  id: number;
  submission_id: string;
  from_stage: string | null;
  to_stage: string | null;
  by_role: "admin" | "agent";
  by_agent_id: string | null;
  is_undo: boolean;
  action: string | null;
  note: string | null;
  created_at: string;
};

export type AgentRow = {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  session_version: number;
  last_login_at: string | null;
  created_at: string;
};

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the secret key.
 * It bypasses Row Level Security, so it must never reach the browser —
 * the "server-only" import above makes the build fail if it does.
 */
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
