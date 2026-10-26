// Caregiver permission rules. The database (RLS + get_caregiver_dashboard) enforces them;
// this pure copy mirrors that logic for tests and for the reminder job.
import { z } from "zod";

export const INVITE_DAYS = 3;
export const MISSED_AFTER_H = 2;
export const MISSED_LOOKBACK_H = 12;
export const CAREGIVER_ALERT_TITLE = "A dose may have been missed";

export const CATEGORIES = [
  { key: "adherence", label: "Dose adherence (last 7 days, counts only)" },
  { key: "missed", label: "\"Not marked\" dose alerts" },
  { key: "appointments", label: "Upcoming appointments (date, doctor, place)" },
] as const;
export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export type GrantLite = {
  status: string; caregiver_id: string | null;
  can_adherence: boolean; can_missed_alerts: boolean; can_appointments: boolean;
  alerts_enabled?: boolean; invite_expires_at?: string | null;
};

/** True only for the accepted caregiver of an ACTIVE grant with that category switched on. Anything else (diary, meals, numbers, plan) is never visible. */
export function caregiverCan(g: GrantLite, viewerId: string | null, category: string): boolean {
  if (!viewerId || g.caregiver_id !== viewerId || g.status !== "active") return false;
  if (category === "adherence") return g.can_adherence;
  if (category === "missed") return g.can_missed_alerts;
  if (category === "appointments") return g.can_appointments;
  return false;
}

export function inviteUsable(g: Pick<GrantLite, "status" | "invite_expires_at">, now: Date = new Date()) {
  return g.status === "invited" && !!g.invite_expires_at && new Date(g.invite_expires_at) > now;
}

/** Caregiver push: dose still pending more than 2 hours after its time (within the look-back), alerts on for both sides. */
export function shouldAlertCaregiver(g: GrantLite, dose: { status: string; scheduled_at: string }, now: Date = new Date()) {
  if (!g.caregiver_id || !caregiverCan(g, g.caregiver_id, "missed") || g.alerts_enabled === false) return false;
  if (dose.status !== "pending") return false;
  const ageH = (now.getTime() - new Date(dose.scheduled_at).getTime()) / 3600e3;
  return ageH > MISSED_AFTER_H && ageH <= MISSED_LOOKBACK_H;
}

export function firstName(full: string | null | undefined) {
  const f = (full ?? "").trim().split(/\s+/)[0];
  return f || "Someone";
}

export const inviteSchema = z.object({
  label: z.string().trim().min(1, "Add a name, like 'My son'").max(60),
  can_adherence: z.boolean(), can_missed_alerts: z.boolean(), can_appointments: z.boolean(),
}).refine((v) => v.can_adherence || v.can_missed_alerts || v.can_appointments, { message: "Choose at least one thing to share." });

export const grantUpdateSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["pause", "resume", "revoke", "cancel", "categories"]),
  can_adherence: z.boolean().optional(), can_missed_alerts: z.boolean().optional(), can_appointments: z.boolean().optional(),
});
