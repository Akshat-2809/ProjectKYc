import "server-only";
import { headers } from "next/headers";
import { db } from "./supabase";

/** Best-effort client IP. On Vercel, x-forwarded-for is set by the platform. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

/** True if this bucket already has `max` events within the last `windowMinutes`. */
export async function isRateLimited(
  bucket: string,
  max: number,
  windowMinutes: number,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await db()
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .gte("created_at", since);

  if (error) {
    console.error("rate limit check failed", error);
    return false; // fail open: a DB hiccup shouldn't lock everyone out
  }
  return (count ?? 0) >= max;
}

export async function recordEvent(bucket: string): Promise<void> {
  const supabase = db();
  await supabase.from("rate_limit_events").insert({ bucket });
  // Housekeeping: drop events older than a day so the table stays tiny.
  const dayAgo = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  await supabase.from("rate_limit_events").delete().lt("created_at", dayAgo);
}

export async function clearBucket(bucket: string): Promise<void> {
  await db().from("rate_limit_events").delete().eq("bucket", bucket);
}
