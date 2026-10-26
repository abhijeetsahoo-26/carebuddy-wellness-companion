import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { saveProfileSchema, emergencyContactSchema, idSchema } from "./validation";
import { CONSENT_VERSION, DEMO_EMERGENCY_CONTACTS } from "./demo";

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
      ...data.fields,
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
    const { error } = await context.supabase
      .from("emergency_contacts")
      .insert(DEMO_EMERGENCY_CONTACTS.map((c) => ({ ...c, user_id: context.userId, is_demo: true })));
    if (error) fail("Could not add sample data.", error);
    return { ok: true };
  });

export const clearDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("emergency_contacts").delete().eq("is_demo", true);
    if (error) fail("Could not remove sample data.", error);
    return { ok: true };
  });

export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [profile, consents, contacts, audit] = await Promise.all([
      sb.from("profiles").select("*").maybeSingle(),
      sb.from("consents").select("*"),
      sb.from("emergency_contacts").select("*"),
      sb.from("audit_log").select("*").order("created_at"),
    ]);
    const err = profile.error ?? consents.error ?? contacts.error ?? audit.error;
    if (err) fail("Could not prepare your data.", err);
    return JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        user_id: context.userId,
        profile: profile.data,
        consents: consents.data,
        emergency_contacts: contacts.data,
        activity: audit.data,
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
    for (const t of ["emergency_contacts", "audit_log", "consents", "profiles"] as const) {
      const { error } = await supabaseAdmin.from(t).delete().eq("user_id", uid);
      if (error) fail("Could not delete everything. Please try again.", error);
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) fail("Your data was deleted but the account could not be closed. Please try again.", error);
    return { ok: true };
  });
