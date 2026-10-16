import { SignJWT, jwtVerify } from "jose";

/**
 * Sessions are signed JWTs in httpOnly cookies — one cookie for the admin,
 * a separate one for agents, so both can be signed in on the same browser.
 * This file has no server-only import because proxy.ts uses it too.
 */
export const SESSION_COOKIE = "kyc_admin";
export const AGENT_COOKIE = "kyc_agent";
export const SESSION_HOURS = 8;
export const AGENT_SESSION_HOURS = 12;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long.");
  }
  return new TextEncoder().encode(secret);
}

// ─── Admin ─────────────────────────────────────────────

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("admin")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function isValidSessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return payload.role === "admin" && payload.sub === "admin";
  } catch {
    return false;
  }
}

// ─── Agents ────────────────────────────────────────────

export type AgentClaims = { agentId: string; ver: number };

export async function createAgentToken(agentId: string, ver: number): Promise<string> {
  return new SignJWT({ role: "agent", ver })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(agentId)
    .setIssuedAt()
    .setExpirationTime(`${AGENT_SESSION_HOURS}h`)
    .sign(secretKey());
}

/** Checks the signature and expiry only. lib/auth.ts also checks the agent is still active. */
export async function readAgentToken(token: string | undefined): Promise<AgentClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.role !== "agent" || typeof payload.sub !== "string" || typeof payload.ver !== "number") {
      return null;
    }
    return { agentId: payload.sub, ver: payload.ver };
  } catch {
    return null;
  }
}
