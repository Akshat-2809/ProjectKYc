import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AGENT_COOKIE,
  AGENT_SESSION_HOURS,
  SESSION_COOKIE,
  SESSION_HOURS,
  createAgentToken,
  createSessionToken,
  isValidSessionToken,
  readAgentToken,
} from "./session";
import { db } from "./supabase";

const cookieOptions = (hours: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: hours * 60 * 60,
});

// ─── Admin ─────────────────────────────────────────────

/**
 * Call at the top of every admin page and admin server action.
 * proxy.ts already redirects logged-out visitors, but this is the real check:
 * server actions can be called directly, so each one verifies the session itself.
 */
export async function requireAdmin(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSessionToken(token))) {
    redirect("/admin/login");
  }
}

export async function startAdminSession(): Promise<void> {
  const token = await createSessionToken();
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(SESSION_HOURS));
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

// ─── Agents ────────────────────────────────────────────

export type Agent = { id: string; name: string; phone: string };

/**
 * The signed-in agent, or null. Besides the cookie signature it checks the database,
 * so a deactivated agent or one whose password was reset is signed out immediately.
 */
export async function currentAgent(): Promise<Agent | null> {
  const claims = await readAgentToken((await cookies()).get(AGENT_COOKIE)?.value);
  if (!claims) return null;
  const { data } = await db()
    .from("agents")
    .select("id, name, phone, active, session_version")
    .eq("id", claims.agentId)
    .maybeSingle();
  if (!data || !data.active || data.session_version !== claims.ver) return null;
  return { id: data.id, name: data.name, phone: data.phone };
}

/** For agent pages and server actions: returns the agent or sends them to the login page. */
export async function requireAgent(): Promise<Agent> {
  const agent = await currentAgent();
  // ?signedout tells proxy.ts not to bounce back here with the old (now invalid) cookie.
  if (!agent) redirect("/agent/login?signedout=1");
  return agent;
}

export async function startAgentSession(agentId: string, ver: number): Promise<void> {
  const token = await createAgentToken(agentId, ver);
  (await cookies()).set(AGENT_COOKIE, token, cookieOptions(AGENT_SESSION_HOURS));
}

export async function endAgentSession(): Promise<void> {
  (await cookies()).delete(AGENT_COOKIE);
}
