// Times are stored in UTC and shown in India time.
export const TZ = "Asia/Kolkata";
const IST_OFFSET_MIN = 330;

export function formatTimeIST(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}
export function formatDateTimeIST(iso: string | Date) {
  return new Date(iso).toLocaleString("en-IN", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}
/** YYYY-MM-DD in India time. */
export function istDate(d: Date = new Date()) {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}
/** UTC start of an India-time day. */
export function istDayStartUTC(date: string) {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - IST_OFFSET_MIN * 60000);
}
export function istMinutesOfDay(d: Date = new Date()) {
  const m = (d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MIN) % 1440;
  return m;
}
function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
/** True when now (India time) is inside quiet hours. Handles windows that cross midnight. */
export function inQuietHours(now: Date, start: string | null, end: string | null) {
  if (!start || !end) return false;
  const s = toMin(start), e = toMin(end), n = istMinutesOfDay(now);
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
}

export type DoseLite = { scheduled_at: string; status: string };
/** Share of past doses marked Taken or Late. Pending future doses are not counted. */
export function adherence(doses: DoseLite[], now: Date = new Date()) {
  const past = doses.filter((d) => new Date(d.scheduled_at) <= now);
  if (!past.length) return null;
  const ok = past.filter((d) => d.status === "taken" || d.status === "late").length;
  return Math.round((ok / past.length) * 100);
}

export const UNDO_WINDOW_MS = 5 * 60 * 1000;
export function canUndo(loggedAt: string | null, now: Date = new Date()) {
  return !!loggedAt && now.getTime() - new Date(loggedAt).getTime() <= UNDO_WINDOW_MS;
}

/** Second reminder goes out once the first is at least this old and the dose is still unmarked. */
export const SECOND_REMINDER_MIN = 15;
