// Server-only: loads one user's rows for a date range. Every query is scoped to user_id explicitly,
// so it is safe with the RLS user client and with the admin client used for verified share links.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { rangeBounds, type SummaryRaw } from "./summary";

export async function loadSummaryRaw(sb: SupabaseClient<Database>, uid: string, from: string, to: string): Promise<SummaryRaw> {
  const { start, end } = rangeBounds(from, to);
  const [p, pv, m, d, u, s, ml, v, w, g, sl, a] = await Promise.all([
    sb.from("profiles").select("full_name, age_group, allergies").eq("user_id", uid).maybeSingle(),
    sb.from("doctor_plan_versions").select("version_no, created_at").eq("user_id", uid),
    sb.from("medicines").select("id, name, strength, dose_amount, archived_at").eq("user_id", uid).order("created_at"),
    sb.from("dose_logs").select("medicine_id, scheduled_at, status").eq("user_id", uid).gte("scheduled_at", start).lt("scheduled_at", end).limit(5000),
    sb.from("unwell_sessions").select("created_at, result, reasons").eq("user_id", uid).gte("created_at", start).lt("created_at", end),
    sb.from("symptom_entries").select("occurred_at, symptoms, severity, result, notes, source, deleted_at").eq("user_id", uid).gte("occurred_at", start).lt("occurred_at", end),
    sb.from("meals").select("eaten_at, meal_type, description, deleted_at").eq("user_id", uid).gte("eaten_at", start).lt("eaten_at", end),
    sb.from("vitals").select("kind, measured_at, value, value2, unit").eq("user_id", uid).gte("measured_at", start).lt("measured_at", end),
    sb.from("water_logs").select("logged_at").eq("user_id", uid).gte("logged_at", start).lt("logged_at", end).limit(5000),
    sb.from("hydration_logs").select("day, goal_glasses").eq("user_id", uid).lte("day", to),
    sb.from("sleep_logs").select("night, hours").eq("user_id", uid).gte("night", from).lte("night", to),
    sb.from("appointments").select("starts_at, doctor, location, purpose, questions").eq("user_id", uid),
  ]);
  const err = p.error ?? pv.error ?? m.error ?? d.error ?? u.error ?? s.error ?? ml.error ?? v.error ?? w.error ?? g.error ?? sl.error ?? a.error;
  if (err) { console.error("summary load failed", err); throw new Error("Could not load your summary. Please try again."); }
  return {
    profile: p.data, planVersions: pv.data ?? [], medicines: m.data ?? [], doses: d.data ?? [],
    unwell: u.data ?? [], diary: s.data ?? [], meals: ml.data ?? [],
    vitals: (v.data ?? []).map((x) => ({ ...x, value: Number(x.value), value2: x.value2 == null ? null : Number(x.value2) })),
    water: w.data ?? [], goals: g.data ?? [], sleep: (sl.data ?? []).map((x) => ({ ...x, hours: Number(x.hours) })),
    appointments: a.data ?? [],
  };
}
