import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { saveMedicineSchema, idSchema, markDoseSchema, snoozeSchema, reminderSettingsSchema, pushSubSchema } from "./validation";
import { UNDO_WINDOW_MS } from "./time";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}

export const saveMedicine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveMedicineSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    let id = data.id;
    if (id) {
      const { error } = await sb.from("medicines").update(data.medicine).eq("id", id);
      if (error) fail("Could not save the medicine.", error);
      // Times may have changed: clear future unmarked doses, then rebuild them.
      await sb.from("dose_logs").delete().eq("medicine_id", id).eq("status", "pending").gt("scheduled_at", new Date().toISOString());
    } else {
      const { data: row, error } = await sb.from("medicines").insert({ ...data.medicine, user_id: context.userId }).select("id").single();
      if (error) fail("Could not save the medicine.", error);
      id = row.id;
    }
    await sb.rpc("generate_my_doses");
    return { id };
  });

export const setMedicineArchived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.extend({ archived: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = await sb.from("medicines").update({ archived_at: data.archived ? new Date().toISOString() : null }).eq("id", data.id);
    if (error) fail("Could not update the medicine.", error);
    if (data.archived) {
      await sb.from("dose_logs").delete().eq("medicine_id", data.id).eq("status", "pending").gt("scheduled_at", new Date().toISOString());
    } else {
      await sb.rpc("generate_my_doses");
    }
    return { ok: true };
  });

export const refreshMyDoses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("generate_my_doses");
    if (error) fail("Could not load today's doses.", error);
    return { ok: true };
  });

export const markDose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => markDoseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("dose_logs")
      .update({ status: data.status, logged_at: new Date().toISOString(), snoozed_until: null })
      .eq("id", data.id);
    if (error) fail("Could not save. Please try again.", error);
    return { ok: true };
  });

export const undoDose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const cutoff = new Date(Date.now() - UNDO_WINDOW_MS).toISOString();
    const { data: rows, error } = await context.supabase
      .from("dose_logs")
      .update({ status: "pending", logged_at: null })
      .eq("id", data.id)
      .gte("logged_at", cutoff)
      .select("id");
    if (error) fail("Could not undo.", error);
    if (!rows?.length) fail("Undo is only possible for 5 minutes.");
    return { ok: true };
  });

export const snoozeDose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => snoozeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const until = new Date(Date.now() + data.minutes * 60e3).toISOString();
    const { error } = await context.supabase.from("dose_logs").update({ snoozed_until: until }).eq("id", data.id).eq("status", "pending");
    if (error) fail("Could not snooze.", error);
    return { until };
  });

export const addWater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("water_logs").insert({ user_id: context.userId }).select("id").single();
    if (error) fail("Could not save.", error);
    return { id: data.id };
  });

export const removeWater = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("water_logs").delete().eq("id", data.id);
    if (error) fail("Could not undo.", error);
    return { ok: true };
  });

// ---- Reminders ----
export const getPushPublicKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { vapidKeys } = await import("./push.server");
    return { publicKey: (await vapidKeys()).publicKey };
  });

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pushSubSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    // An endpoint belongs to one browser; drop any old row for it first.
    await sb.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    const { error } = await sb.from("push_subscriptions").insert({ ...data, user_id: context.userId });
    if (error) fail("Could not turn on reminders on this device.", error);
    await sb.from("reminder_settings").upsert({ user_id: context.userId, enabled: true });
    return { ok: true };
  });

export const saveReminderSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => reminderSettingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reminder_settings").upsert({ user_id: context.userId, ...data });
    if (error) fail("Could not save your settings.", error);
    return { ok: true };
  });

export const sendTestReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { signAction, REMINDER_TITLE } = await import("./push.server");
    const { deliverToUser } = await import("./reminders.server");
    const uid = context.userId;
    const nowIso = new Date().toISOString();
    await context.supabase.from("reminder_settings").upsert({ user_id: uid, last_test_sent_at: nowIso, last_test_received_at: null });
    const { data: log, error } = await supabaseAdmin
      .from("reminder_log")
      .insert({ user_id: uid, kind: "test", dedupe_key: `test:${crypto.randomUUID()}`, scheduled_for: nowIso })
      .select("id")
      .single();
    if (error) fail("Could not send the test.", error);
    const token = await signAction({ k: "test", id: log.id, u: uid }, 3600);
    const status = await deliverToUser(supabaseAdmin, uid, log.id, { type: "test", title: REMINDER_TITLE, tag: "test", token });
    return { status };
  });
