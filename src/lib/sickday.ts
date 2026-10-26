// Sick-day mode rules (no AI). Pure, so they are unit-tested in src/test/sickday-caregiver.test.tsx.
import { z } from "zod";
import { inQuietHours, istMinutesOfDay } from "./time";

export const WATER_EVERY_H = 2;
export const CHECKIN_AFTER_H = 6;
/** Repeating check-ins stop after this many hours (3 days) of sick-day mode. */
export const CHECKIN_LIMIT_H = 72;

/** True once sick-day mode has been on for 3 days or more. */
export function pastCheckinLimit(startedAt: string, now: Date = new Date()) {
  return now.getTime() - new Date(startedAt).getTime() >= CHECKIN_LIMIT_H * 3600e3;
}
/** Waking hours (India time) when no quiet hours are set; quiet hours also always hold reminders back. */
export const WAKING_START_MIN = 7 * 60;
export const WAKING_END_MIN = 22 * 60;

export const SICK_TITLES = { water: "Time for some water", checkin: "How are you feeling now?" } as const;
export const NOT_A_DOCTOR = "I'm not a doctor. Please follow your doctor's advice.";
export const SAME_TEXT = "If symptoms last more than 3 days, please contact your doctor";

/** Any of these, at any time, shows EMERGENCY. Same red flags as the "I feel unwell" check. */
export const SICK_RED_FLAGS = [
  { key: "breathing", label: "Trouble breathing" },
  { key: "chest_pain", label: "Chest pain or pressure" },
  { key: "confusion", label: "Confusion, fainting or seizure" },
  { key: "worsening", label: "Getting worse quickly" },
  { key: "allergic", label: "Allergic reaction signs (swelling of face or lips, hives)" },
  { key: "bleeding", label: "Severe bleeding" },
  { key: "dehydration", label: "Very dry mouth, no urine, or fainting from lack of water" },
  { key: "self_harm", label: "Thoughts of harming yourself" },
] as const;
export type RedFlagKey = (typeof SICK_RED_FLAGS)[number]["key"];
const RED_KEYS = SICK_RED_FLAGS.map((f) => f.key) as [RedFlagKey, ...RedFlagKey[]];

export type CheckinAnswer = "better" | "same" | "worse";
export type CheckinOutcome = "emergency" | "offer_end" | "contact_if_3_days" | "doctor_soon";

export const checkinSchema = z.object({
  answer: z.enum(["better", "same", "worse"]).nullable(),
  red_flags: z.array(z.enum(RED_KEYS)).max(RED_KEYS.length).default([]),
}).refine((c) => c.answer !== null || c.red_flags.length > 0, { message: "Choose how you feel." });

/** Red flags always win. Better → offer to end; Same → 3-day message; Worse → see a doctor soon. */
export function checkinOutcome(answer: CheckinAnswer | null, redFlags: readonly string[] = []): CheckinOutcome {
  if (redFlags.length) return "emergency";
  if (answer === "better") return "offer_end";
  if (answer === "worse") return "doctor_soon";
  return "contact_if_3_days";
}

export function isWakingTime(now: Date, quietStart: string | null, quietEnd: string | null) {
  if (inQuietHours(now, quietStart, quietEnd)) return false;
  const m = istMinutesOfDay(now);
  return m >= WAKING_START_MIN && m < WAKING_END_MIN;
}

/** Which sick-day pushes are due now. Keys are unique per 2-hour / 6-hour window, so each goes once. */
export function dueSickPushes(s: { id: string; started_at: string }, now: Date, quietStart: string | null, quietEnd: string | null) {
  const out: { kind: "sick_water" | "sick_checkin"; key: string }[] = [];
  if (!isWakingTime(now, quietStart, quietEnd)) return out;
  const elapsedH = (now.getTime() - new Date(s.started_at).getTime()) / 3600e3;
  const w = Math.floor(elapsedH / WATER_EVERY_H);
  if (w >= 1) out.push({ kind: "sick_water", key: `sick_water:${s.id}:${w}` });
  const c = Math.floor(elapsedH / CHECKIN_AFTER_H);
  if (c >= 1 && elapsedH < CHECKIN_LIMIT_H) out.push({ kind: "sick_checkin", key: `sick_checkin:${s.id}:${c}` });
  return out;
}

export function nextCheckinAt(startedAt: string, now: Date = new Date()) {
  const start = new Date(startedAt).getTime();
  const n = Math.floor((now.getTime() - start) / (CHECKIN_AFTER_H * 3600e3)) + 1;
  return new Date(start + n * CHECKIN_AFTER_H * 3600e3);
}
