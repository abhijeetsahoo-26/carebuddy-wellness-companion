// Server-only reminder job. Safe to run repeatedly: every send is claimed first
// through reminder_log.dedupe_key (unique), so a reminder is never sent twice.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { inQuietHours, SECOND_REMINDER_MIN } from "./time";
import { REMINDER_TITLE, PUSH_TITLES, sendPush, signAction } from "./push.server";
import { supplyStatus } from "./tracking";
import { dueSickPushes, SICK_TITLES } from "./sickday";
import { CAREGIVER_ALERT_TITLE, MISSED_AFTER_H, MISSED_LOOKBACK_H, firstName, shouldAlertCaregiver } from "./caregiver";

type Admin = SupabaseClient<Database>;
const LOOKBACK_H = 12;

export async function deliverToUser(admin: Admin, userId: string, logId: string, data: Record<string, unknown>) {
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  if (!subs?.length) {
    await admin.from("reminder_log").update({ status: "no_device", detail: "No phone or browser is set up for reminders" }).eq("id", logId);
    return "no_device";
  }
  let ok = 0;
  for (const s of subs) {
    const r = await sendPush(s, data);
    if (r === "sent") ok++;
    if (r === "gone") await admin.from("push_subscriptions").delete().eq("id", s.id);
  }
  const status = ok > 0 ? "sent" : "failed";
  await admin.from("reminder_log").update({ status, sent_at: new Date().toISOString(), detail: `${ok}/${subs.length} devices` }).eq("id", logId);
  return status;
}

async function claim(admin: Admin, row: Database["public"]["Tables"]["reminder_log"]["Insert"]) {
  const { data, error } = await admin.from("reminder_log").insert(row).select("id").single();
  if (error) {
    if (error.code === "23505") return null; // already sent by an earlier run
    throw error;
  }
  return data.id;
}

export async function runReminderJob(admin: Admin, now = new Date()) {
  await admin.rpc("generate_doses", { _user: null as unknown as string, _days: 2 });

  const side = (await runSickDay(admin, now)) + (await runCaregiverAlerts(admin, now));
  const { data: settings } = await admin.from("reminder_settings").select("user_id, quiet_start, quiet_end").eq("enabled", true);
  if (!settings?.length) return { sent: side };
  const byUser = new Map(settings.map((s) => [s.user_id, s]));
  const extra = await runSupplyAndAppointments(admin, byUser, now);
  const r = await runDoseReminders(admin, byUser, now);
  return { sent: r.sent + extra + side };
}

// Sick-day: water every 2 hours while awake, check-in every 6 hours. Fixed, generic titles.
async function runSickDay(admin: Admin, now: Date) {
  const { data: sessions } = await admin.from("sick_day_sessions").select("id, user_id, started_at").is("ended_at", null).eq("is_demo", false).limit(500);
  if (!sessions?.length) return 0;
  const { data: qs } = await admin.from("reminder_settings").select("user_id, quiet_start, quiet_end").in("user_id", sessions.map((s) => s.user_id));
  let sent = 0;
  for (const s of sessions) {
    const q = qs?.find((x) => x.user_id === s.user_id);
    for (const p of dueSickPushes(s, now, q?.quiet_start ?? null, q?.quiet_end ?? null)) {
      const logId = await claim(admin, { user_id: s.user_id, kind: p.kind, dedupe_key: p.key, scheduled_for: now.toISOString() });
      if (!logId) continue;
      const type = p.kind === "sick_water" ? "sick_water" : "sick_checkin";
      if ((await deliverToUser(admin, s.user_id, logId, { type, title: p.kind === "sick_water" ? SICK_TITLES.water : SICK_TITLES.checkin, tag: `${type}-${s.id}` })) === "sent") sent++;
    }
  }
  return sent;
}

// Caregiver alert: a dose still "Not marked" more than 2 hours after its time. Only the first name is sent.
async function runCaregiverAlerts(admin: Admin, now: Date) {
  const { data: grants } = await admin.from("caregiver_grants")
    .select("id, user_id, caregiver_id, status, can_adherence, can_missed_alerts, can_appointments, alerts_enabled")
    .eq("status", "active").eq("can_missed_alerts", true).eq("alerts_enabled", true).eq("is_demo", false).not("caregiver_id", "is", null);
  if (!grants?.length) return 0;
  const owners = [...new Set(grants.map((g) => g.user_id))];
  const [{ data: doses }, { data: profs }] = await Promise.all([
    admin.from("dose_logs").select("id, user_id, scheduled_at, status").in("user_id", owners).eq("status", "pending").eq("is_demo", false)
      .lte("scheduled_at", new Date(now.getTime() - MISSED_AFTER_H * 3600e3).toISOString())
      .gte("scheduled_at", new Date(now.getTime() - MISSED_LOOKBACK_H * 3600e3).toISOString()).limit(2000),
    admin.from("profiles").select("user_id, full_name").in("user_id", owners),
  ]);
  let sent = 0;
  for (const g of grants) {
    const name = firstName(profs?.find((p) => p.user_id === g.user_id)?.full_name);
    for (const d of (doses ?? []).filter((x) => x.user_id === g.user_id && shouldAlertCaregiver(g, x, now))) {
      const logId = await claim(admin, { user_id: g.caregiver_id!, kind: "caregiver_missed", dedupe_key: `cg_missed:${g.id}:${d.id}`, scheduled_for: d.scheduled_at });
      if (!logId) continue;
      if ((await deliverToUser(admin, g.caregiver_id!, logId, { type: "caregiver_missed", title: CAREGIVER_ALERT_TITLE, first_name: name, tag: `cg-${g.id}` })) === "sent") sent++;
    }
  }
  return sent;
}

type Settings = Map<string, { user_id: string; quiet_start: string | null; quiet_end: string | null }>;

// Refill (once per stock count the user entered) and appointment pushes (day before, 2 hours before).
async function runSupplyAndAppointments(admin: Admin, byUser: Settings, now: Date) {
  let sent = 0;
  const users = [...byUser.keys()];
  const { data: meds } = await admin.from("medicines")
    .select("id, user_id, tablets_remaining, tablets_per_dose, times, stock_set_at")
    .in("user_id", users).eq("is_demo", false).is("archived_at", null).not("tablets_remaining", "is", null);
  for (const m of meds ?? []) {
    const s = byUser.get(m.user_id)!;
    if (inQuietHours(now, s.quiet_start, s.quiet_end)) continue;
    const st = supplyStatus(Number(m.tablets_remaining), Number(m.tablets_per_dose), m.times.length);
    if (st !== "low" && st !== "out") continue;
    const logId = await claim(admin, { user_id: m.user_id, kind: "refill", dedupe_key: `refill:${m.id}:${m.stock_set_at ?? "initial"}`, scheduled_for: now.toISOString() });
    if (!logId) continue;
    if ((await deliverToUser(admin, m.user_id, logId, { type: "refill", title: PUSH_TITLES.refill, tag: `refill-${m.id}` })) === "sent") sent++;
  }
  const { data: appts } = await admin.from("appointments").select("id, user_id, starts_at")
    .in("user_id", users).eq("is_demo", false)
    .gt("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 24 * 3600e3).toISOString());
  for (const a of appts ?? []) {
    const s = byUser.get(a.user_id)!;
    const msLeft = new Date(a.starts_at).getTime() - now.getTime();
    const kind = msLeft <= 2 * 3600e3 ? "appt_2h" : "appt_day";
    // Appointment pushes are time-critical, but quiet hours still hold back the day-before one.
    if (kind === "appt_day" && inQuietHours(now, s.quiet_start, s.quiet_end)) continue;
    const logId = await claim(admin, { user_id: a.user_id, kind, dedupe_key: `${kind}:${a.id}:${a.starts_at}`, scheduled_for: a.starts_at });
    if (!logId) continue;
    if ((await deliverToUser(admin, a.user_id, logId, { type: "appointment", title: PUSH_TITLES.appointment, tag: `appt-${a.id}` })) === "sent") sent++;
  }
  return sent;
}

async function runDoseReminders(admin: Admin, byUser: Settings, now: Date) {

  const { data: doses, error } = await admin
    .from("dose_logs")
    .select("id, user_id, scheduled_at, snoozed_until")
    .eq("status", "pending")
    .eq("is_demo", false)
    .in("user_id", [...byUser.keys()])
    .lte("scheduled_at", now.toISOString())
    .gte("scheduled_at", new Date(now.getTime() - LOOKBACK_H * 3600e3).toISOString())
    .limit(1000);
  if (error) throw error;
  if (!doses?.length) return { sent: 0 };

  const { data: logs } = await admin.from("reminder_log").select("dose_id, kind, sent_at, created_at").in("dose_id", doses.map((d) => d.id));
  let sent = 0;

  for (const d of doses) {
    const s = byUser.get(d.user_id);
    if (!s) continue;
    // Quiet hours delay medicine reminders; they go out when quiet hours end.
    if (inQuietHours(now, s.quiet_start, s.quiet_end)) continue;

    const mine = (logs ?? []).filter((l) => l.dose_id === d.id);
    const first = mine.find((l) => l.kind === "first");
    let kind: "first" | "second" | "snooze" | null = null;
    let key = "";
    if (d.snoozed_until) {
      if (new Date(d.snoozed_until) > now) continue;
      kind = "snooze";
      key = `${d.id}:snooze:${d.snoozed_until}`;
    } else if (!first) {
      kind = "first";
      key = `${d.id}:first`;
    } else if (!mine.some((l) => l.kind === "second")) {
      const firstAt = new Date(first.sent_at ?? first.created_at);
      if (now.getTime() - firstAt.getTime() >= SECOND_REMINDER_MIN * 60e3) {
        kind = "second";
        key = `${d.id}:second`;
      }
    }
    if (!kind) continue;

    const logId = await claim(admin, { user_id: d.user_id, dose_id: d.id, kind, dedupe_key: key, scheduled_for: d.scheduled_at });
    if (!logId) continue;
    const token = await signAction({ k: "dose", id: d.id, u: d.user_id });
    const r = await deliverToUser(admin, d.user_id, logId, { type: "dose", title: REMINDER_TITLE, tag: `dose-${d.id}`, token });
    if (r === "sent") sent++;
  }
  return { sent };
}
