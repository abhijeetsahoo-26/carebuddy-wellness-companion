import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { saveProfileSchema, emergencyContactSchema, idSchema } from "./validation";
import { CONSENT_VERSION, DEMO_EMERGENCY_CONTACTS, DEMO_MEDICINES, DEMO_PLAN, DEMO_MEALS } from "./demo";
import { istDate, istDayStartUTC } from "./time";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}

export const acceptConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { agreed: boolean }) => {
    if (d?.agreed !== true) throw new Error("Please tick the box to continue");
    return d;
  })
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("consents")
      .upsert({ user_id: context.userId, version: CONSENT_VERSION }, { onConflict: "user_id,version", ignoreDuplicates: true });
    if (error) fail("Could not save your choice. Please try again.", error);
    return { ok: true };
  });

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      user_id: context.userId,
      ...Object.fromEntries(Object.entries(data.fields).filter(([, v]) => v !== undefined)),
      onboarding_step: data.step,
      ...(data.done ? { onboarding_done: true } : {}),
    });
    if (error) fail("Could not save. Please try again.", error);
    return { ok: true };
  });

export const addEmergencyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => emergencyContactSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("emergency_contacts")
      .insert({ ...data, user_id: context.userId });
    if (error) fail("Could not save the contact. Please try again.", error);
    return { ok: true };
  });

export const deleteEmergencyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("emergency_contacts").delete().eq("id", data.id);
    if (error) fail("Could not remove the contact.", error);
    return { ok: true };
  });

export const loadDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const uid = context.userId;
    const { error } = await sb
      .from("emergency_contacts")
      .insert(DEMO_EMERGENCY_CONTACTS.map((c) => ({ ...c, user_id: uid, is_demo: true })));
    if (error) fail("Could not add sample data.", error);
    const today = istDate();
    const start = istDate(new Date(Date.now() - 6 * 86400e3));
    const { data: meds, error: mErr } = await sb
      .from("medicines")
      .insert(DEMO_MEDICINES.map((m) => ({ ...m, user_id: uid, is_demo: true, start_date: start })))
      .select("id, times");
    if (mErr) fail("Could not add sample data.", mErr);
    await sb.rpc("generate_my_doses");
    // Past week of sample doses so the weekly chart has something to show.
    const past: { user_id: string; medicine_id: string; scheduled_at: string; status: string; logged_at: string; is_demo: boolean }[] = [];
    let i = 0;
    for (let day = 6; day >= 1; day--) {
      const date = istDate(new Date(istDayStartUTC(today).getTime() - day * 86400e3 + 12 * 3600e3));
      for (const m of meds) for (const t of m.times) {
        const [h, mi] = t.split(":").map(Number);
        const at = new Date(istDayStartUTC(date).getTime() + ((h ?? 0) * 60 + (mi ?? 0)) * 60e3);
        const status = i++ % 5 === 3 ? "skipped" : "taken";
        past.push({ user_id: uid, medicine_id: m.id, scheduled_at: at.toISOString(), status, logged_at: at.toISOString(), is_demo: true });
      }
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: dErr } = await supabaseAdmin.from("dose_logs").upsert(past, { onConflict: "medicine_id,scheduled_at", ignoreDuplicates: true });
    if (dErr) fail("Could not add sample doses.", dErr);
    const { error: pErr } = await sb.rpc("save_doctor_plan", { p: { ...DEMO_PLAN, is_demo: true } });
    if (pErr) fail("Could not add the sample plan.", pErr);
    const { error: mlErr } = await sb.from("meals").insert(DEMO_MEALS.map((m) => ({
      user_id: uid, is_demo: true, meal_type: m.meal_type, description: m.description, ai_note: m.ai_note, ai_note_status: "ok",
      eaten_at: new Date(istDayStartUTC(istDate(new Date(Date.now() - m.daysAgo * 86400e3))).getTime() + m.minutes * 60e3).toISOString(),
    })));
    if (mlErr) fail("Could not add sample meals.", mlErr);
    return { ok: true };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const a = await context.supabase.from("emergency_contacts").delete().eq("is_demo", true);
    const b = await context.supabase.from("medicines").delete().eq("is_demo", true);
    const c = await context.supabase.from("doctor_plan_versions").delete().eq("is_demo", true);
    const d = await context.supabase.from("meals").delete().eq("is_demo", true);
    if (a.error || b.error || c.error || d.error) fail("Could not remove sample data.", a.error ?? b.error ?? c.error ?? d.error);
    return { ok: true };
  });

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [profile, consents, contacts, audit, medicines, doses, water, rsettings, rlog, pv, pm, pd, pl, meals, aiu] = await Promise.all([
      sb.from("profiles").select("*").maybeSingle(),
      sb.from("consents").select("*"),
      sb.from("emergency_contacts").select("*"),
      sb.from("audit_log").select("*").order("created_at"),
      sb.from("medicines").select("*"),
      sb.from("dose_logs").select("*").order("scheduled_at"),
      sb.from("water_logs").select("*"),
      sb.from("reminder_settings").select("enabled, quiet_start, quiet_end, last_test_sent_at, last_test_received_at"),
      sb.from("reminder_log").select("kind, status, scheduled_for, sent_at, created_at"),
      sb.from("doctor_plan_versions").select("*").order("version_no"),
      sb.from("doctor_plan_medicines").select("*"),
      sb.from("doctor_plan_diet").select("*"),
      sb.from("doctor_plan_limits").select("*"),
      sb.from("meals").select("*").order("eaten_at"),
      sb.from("ai_usage").select("day, calls"),
    ]);
    const err = profile.error ?? consents.error ?? contacts.error ?? audit.error ?? medicines.error ?? doses.error ?? water.error ?? rsettings.error ?? rlog.error ?? pv.error ?? pm.error ?? pd.error ?? pl.error ?? meals.error ?? aiu.error;
    if (err) fail("Could not prepare your data.", err);
    // Short-lived links so you can download your own uploaded prescriptions.
    const uploads: { version_no: number; file_name: string | null; link_valid_1h: string | null }[] = [];
    for (const v of pv.data ?? []) if (v.attachment_path) {
      const { data: sig } = await sb.storage.from("prescriptions").createSignedUrl(v.attachment_path, 3600);
      uploads.push({ version_no: v.version_no, file_name: v.attachment_name, link_valid_1h: sig?.signedUrl ?? null });
    }
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        user_id: context.userId,
        profile: profile.data,
        consents: consents.data,
        emergency_contacts: contacts.data,
        activity: audit.data,
        medicines: medicines.data,
        doses: doses.data,
        water: water.data,
        reminder_settings: rsettings.data,
        reminders_sent: rlog.data,
        doctor_plan: (pv.data ?? []).map((v) => ({
          ...v,
          medicines: (pm.data ?? []).filter((m) => m.version_id === v.id),
          diet: (pd.data ?? []).find((d) => d.version_id === v.id) ?? null,
          limits: (pl.data ?? []).filter((l) => l.version_id === v.id),
        })),
        prescription_uploads: uploads,
        meals: meals.data,
        ai_note_usage: aiu.data,
      },
      null,
      2,
    );
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { confirm: string }) => {
    if (d?.confirm !== "DELETE") throw new Error("Please type DELETE to confirm");
    return d;
  })
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;
    const { data: files } = await supabaseAdmin.storage.from("prescriptions").list(uid, { limit: 1000 });
    if (files?.length) {
      const { error: sErr } = await supabaseAdmin.storage.from("prescriptions").remove(files.map((f) => `${uid}/${f.name}`));
      if (sErr) fail("Could not delete your uploads. Please try again.", sErr);
    }
    for (const t of ["meals", "ai_usage", "doctor_plan_limits", "doctor_plan_diet", "doctor_plan_medicines", "doctor_plan_versions", "reminder_log", "push_subscriptions", "reminder_settings", "water_logs", "dose_logs", "medicines", "emergency_contacts", "audit_log", "consents", "profiles"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", uid);
      if (error) fail("Could not delete everything. Please try again.", error);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) fail("Your data was deleted but the account could not be closed. Please try again.", error);
    return { ok: true };
  });
