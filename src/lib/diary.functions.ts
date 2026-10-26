import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { idSchema, diaryEntrySchema, diaryNotesSchema, directoryNumberSchema } from "./validation";
import { decide, symptomLabel, unwellAnswersSchema } from "./unwell";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}

// The result is decided again on the server from the answers, never trusted from the browser.
export const saveUnwellCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unwellAnswersSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { result, reasons } = decide(data);
    const { data: s, error } = await sb.from("unwell_sessions")
      .insert({ user_id: context.userId, answers: data, result, reasons }).select("id").single();
    if (error) fail("Could not save this check to your diary.", error);
    const symptoms = [...data.symptoms.map(symptomLabel), ...(data.other ? [data.other] : [])];
    const { error: e2 } = await sb.from("symptom_entries").insert({
      user_id: context.userId, session_id: s.id, symptoms, severity: data.pain, result, source: "check",
    });
    if (e2) fail("Could not save this check to your diary.", e2);
    return { result, reasons, sessionId: s.id as string };
  });

export const addDiaryEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => diaryEntrySchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("symptom_entries").insert({ ...data, user_id: context.userId, source: "manual" });
    if (error) fail("Could not save the entry.", error);
    return { ok: true };
  });

export const updateDiaryNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => diaryNotesSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("symptom_entries").update({ notes: data.notes }).eq("id", data.id);
    if (error) fail("Could not save the notes.", error);
    return { ok: true };
  });

export const setDiaryDeleted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => idSchema.extend({ deleted: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("symptom_entries")
      .update({ deleted_at: data.deleted ? new Date().toISOString() : null }).eq("id", data.id);
    if (error) fail(data.deleted ? "Could not delete the entry." : "Could not undo.", error);
    return { ok: true };
  });

export const saveDirectoryNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => directoryNumberSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: existing } = await sb.from("emergency_directory").select("id").eq("user_id", context.userId).eq("key", data.key).maybeSingle();
    const { error } = existing
      ? await sb.from("emergency_directory").update({ number: data.number, label: data.label }).eq("id", existing.id)
      : await sb.from("emergency_directory").insert({ ...data, user_id: context.userId });
    if (error) fail("Could not save the number.", error);
    return { ok: true };
  });

export const resetDirectoryNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ key: z.string().max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("emergency_directory").delete().eq("user_id", context.userId).eq("key", data.key);
    if (error) fail("Could not reset the number.", error);
    return { ok: true };
  });
