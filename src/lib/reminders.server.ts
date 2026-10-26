// Server-only reminder job. Safe to run repeatedly: every send is claimed first
// through reminder_log.dedupe_key (unique), so a reminder is never sent twice.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { inQuietHours, SECOND_REMINDER_MIN } from "./time";
import { REMINDER_TITLE, sendPush, signAction } from "./push.server";

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

  const { data: settings } = await admin.from("reminder_settings").select("user_id, quiet_start, quiet_end").eq("enabled", true);
  if (!settings?.length) return { sent: 0 };
  const byUser = new Map(settings.map((s) => [s.user_id, s]));

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
