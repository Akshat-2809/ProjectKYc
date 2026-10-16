import type { KycStatus } from "./supabase";

export const STATUS_LABEL: Record<KycStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

/** Server-side date formatting in Indian time, so server and browser show identical text. */
export function when(iso: string, withYear = false) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" as const } : {}),
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Removes characters that have meaning in PostgREST filter strings. */
export function cleanSearch(q: string | undefined) {
  return (q ?? "").replace(/[^\p{L}\p{N} -]/gu, "").trim().slice(0, 50);
}

const IST = "Asia/Kolkata";

/** "Fri 16 Oct, 11:30 am – 11:50 am" for a slot that starts at `iso`. Format on the server only. */
export function formatSlot(iso: string, minutes = 20) {
  const start = new Date(iso);
  const end = new Date(start.getTime() + minutes * 60_000);
  const day = start.toLocaleDateString("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" });
  const t = (d: Date) => d.toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  return `${day}, ${t(start)} – ${t(end)}`;
}

/** Just the time, e.g. "11:30 am". */
export function slotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
}

/** Date and time in IST as values for <input type="date"> / <input type="time">. */
export function istInputs(iso?: string | null): { date: string; time: string } {
  const d = iso ? new Date(iso) : new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: IST,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** ISO timestamp `minutes` ago (kept out of components so render stays pure). */
export function minutesAgoIso(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
