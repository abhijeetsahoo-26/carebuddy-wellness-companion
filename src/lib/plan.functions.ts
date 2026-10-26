import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planSchema, saveMealSchema, idSchema } from "./validation";
import { checkMealNote, AI_DAILY_CAP } from "./meal-note";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}

// ---- Doctor's Plan: every save creates a new dated, read-only version ----
export const saveDoctorPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => planSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.attachment_path && !data.attachment_path.startsWith(`${context.userId}/`)) fail("That file could not be attached.");
    const { data: id, error } = await context.supabase.rpc("save_doctor_plan", { p: { ...data, is_demo: false } });
    if (error) fail("Could not save your plan. Please try again.", error);
    return { id };
  });

// ---- Meals ----
async function writeNote(sb: SupabaseClient<Database>, id: string, text: string) {
  let note: string | null = null;
  const { data: allowed } = await sb.rpc("claim_ai_call", { _cap: AI_DAILY_CAP });
  if (allowed) {
    const { askMealNote } = await import("./meal-ai.server");
    const raw = await askMealNote(text);
    // Names the user entered also count as medicine names.
    const [meds, planMeds] = await Promise.all([
      sb.from("medicines").select("name, generic_name"),
      sb.from("doctor_plan_medicines").select("name"),
    ]);
    const names = [
      ...(meds.data ?? []).flatMap((m) => [m.name, m.generic_name ?? ""]),
      ...(planMeds.data ?? []).map((m) => m.name),
    ];
    note = checkMealNote(raw, names);
  }
  await sb.from("meals").update({ ai_note: note, ai_note_status: note ? "ok" : "unavailable" }).eq("id", id);
  return note;
}

export const saveMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saveMealSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    let id = data.id;
    let needsNote = true;
    if (id) {
      const { data: old } = await sb.from("meals").select("description").eq("id", id).maybeSingle();
      needsNote = old?.description !== data.meal.description;
      const { error } = await sb.from("meals").update({ ...data.meal, ...(needsNote ? { ai_note: null, ai_note_status: "pending" } : {}) }).eq("id", id);
      if (error) fail("Could not save the meal.", error);
    } else {
      const { data: row, error } = await sb.from("meals").insert({ ...data.meal, user_id: context.userId }).select("id").single();
      if (error) fail("Could not save the meal.", error);
      id = row.id;
    }
    // The meal is already saved; a failed note never loses it.
    if (needsNote) {
      try { await writeNote(sb, id, data.meal.description); }
      catch (e) { console.error("note failed", e); await sb.from("meals").update({ ai_note_status: "unavailable" }).eq("id", id); }
    }
    return { id };
  });

export const deleteMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meals").update({ deleted_at: new Date().toISOString() }).eq("id", data.id);
    if (error) fail("Could not delete the meal.", error);
    return { ok: true };
  });

export const restoreMeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("meals").update({ deleted_at: null }).eq("id", data.id);
    if (error) fail("Could not undo.", error);
    return { ok: true };
  });
