import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { idSchema, saveAppointmentSchema, vitalSchema, waterGoalSchema, sleepSchema, cardPrefsSchema } from "./validation";
import { istDate } from "./time";
import { CARD_LINK_EXPIRY, DEFAULT_CARD_LINK_EXPIRY, cardLinkExpiresAt } from "./tracking";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}

export const saveAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveAppointmentSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { error } = data.id
      ? await sb.from("appointments").update(data.appointment).eq("id", data.id)
      : await sb.from("appointments").insert({ ...data.appointment, user_id: context.userId });
    if (error) fail("Could not save the appointment.", error);
    return { ok: true };
  });

export const deleteAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("appointments").delete().eq("id", data.id);
    if (error) fail("Could not delete the appointment.", error);
    return { ok: true };
  });

export const addVital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => vitalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vitals").insert({ ...data, user_id: context.userId, source: "entered_by_you" });
    if (error) fail("Could not save.", error);
    return { ok: true };
  });

export const deleteVital = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("vitals").delete().eq("id", data.id);
    if (error) fail("Could not delete.", error);
    return { ok: true };
  });

export const setWaterGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => waterGoalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hydration_logs")
      .upsert({ user_id: context.userId, day: istDate(), goal_glasses: data.goal_glasses }, { onConflict: "user_id,day" });
    if (error) fail("Could not save your goal.", error);
    return { ok: true };
  });

export const saveSleep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sleepSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.night > istDate()) fail("The date can't be in the future.");
    const { error } = await context.supabase.from("sleep_logs").upsert({ ...data, user_id: context.userId }, { onConflict: "user_id,night" });
    if (error) fail("Could not save your sleep.", error);
    return { ok: true };
  });

export const deleteSleep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("sleep_logs").delete().eq("id", data.id);
    if (error) fail("Could not delete.", error);
    return { ok: true };
  });

export const saveCardPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cardPrefsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("profiles").update({ card_prefs: data }).eq("user_id", context.userId);
    if (error) fail("Could not save your choices.", error);
    return { ok: true };
  });

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Creates a fresh link and revokes any older ones. Only a hash is stored, so the link is shown once.
export const createCardLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ expiry: z.enum(CARD_LINK_EXPIRY).default(DEFAULT_CARD_LINK_EXPIRY) }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const nowIso = new Date().toISOString();
    await sb.from("emergency_card_tokens").update({ revoked_at: nowIso }).is("revoked_at", null);
    const { error } = await sb.from("emergency_card_tokens").insert({ user_id: context.userId, token_hash: await sha256Hex(token), expires_at: cardLinkExpiresAt(data.expiry) });
    if (error) fail("Could not create the link.", error);
    return { token };
  });

export const revokeCardLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("emergency_card_tokens").update({ revoked_at: new Date().toISOString() }).is("revoked_at", null);
    if (error) fail("Could not turn off the link.", error);
    return { ok: true };
  });

export type PublicCard = {
  name?: string | null; allergies?: string | null; conditions?: string | null;
  doctor?: { name: string | null; phone: string | null };
  medicines?: { name: string; strength: string | null; dose: string | null }[];
  contacts?: { name: string; phone: string; relationship: string | null }[];
};

// Public (no sign-in): the SQL function returns only switched-on items for a live token.
export const getPublicCard = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      } },
    });
    const { data: card, error } = await sb.rpc("get_emergency_card", { _token: data.token });
    if (error) { console.error("card lookup failed", error); return { card: null as PublicCard | null }; }
    return { card: (card as PublicCard | null) ?? null };
  });
