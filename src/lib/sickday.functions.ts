import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkinOutcome, checkinSchema, SICK_RED_FLAGS } from "./sickday";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}
const LABEL = { better: "Better", same: "Same", worse: "Worse" } as const;
const RESULT = { emergency: "emergency", doctor_soon: "doctor_soon", offer_end: "self_care", contact_if_3_days: "self_care" } as const;

// Only ever started by the user, after a self-care result.
export const startSickDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ unwell_session_id: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: active } = await sb.from("sick_day_sessions").select("id").is("ended_at", null).maybeSingle();
    if (active) return { id: active.id };
    if (data.unwell_session_id) {
      const { data: u } = await sb.from("unwell_sessions").select("result").eq("id", data.unwell_session_id).maybeSingle();
      if (u?.result !== "self_care") fail("Sick-day mode is offered only after a self-care result.");
    }
    const { data: row, error } = await sb.from("sick_day_sessions")
      .insert({ user_id: context.userId, unwell_session_id: data.unwell_session_id }).select("id").single();
    if (error) fail("Could not start sick-day mode.", error);
    await sb.from("symptom_entries").insert({ user_id: context.userId, symptoms: ["Started sick-day mode"], source: "sick_day", session_id: data.unwell_session_id });
    return { id: row.id };
  });

// The outcome is decided again on the server; red flags always mean EMERGENCY.
export const recordSickCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => checkinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const outcome = checkinOutcome(data.answer, data.red_flags);
    const { data: s } = await sb.from("sick_day_sessions").select("id, checkins").is("ended_at", null).maybeSingle();
    const at = new Date().toISOString();
    if (s) {
      const list = Array.isArray(s.checkins) ? s.checkins : [];
      const { error } = await sb.from("sick_day_sessions").update({ checkins: [...list, { at, answer: data.answer, red_flags: data.red_flags, outcome }] }).eq("id", s.id);
      if (error) console.error("check-in save failed", error);
    }
    const flags = data.red_flags.map((k) => SICK_RED_FLAGS.find((f) => f.key === k)!.label);
    await sb.from("symptom_entries").insert({
      user_id: context.userId, source: "sick_day", result: RESULT[outcome],
      symptoms: [...(data.answer ? [`Sick-day check-in: ${LABEL[data.answer]}`] : ["Sick-day warning signs"]), ...flags],
    });
    return { outcome };
  });

export const endSickDay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: s } = await sb.from("sick_day_sessions").update({ ended_at: new Date().toISOString() }).is("ended_at", null).select("id");
    if (s?.length) await sb.from("symptom_entries").insert({ user_id: context.userId, symptoms: ["Ended sick-day mode"], source: "sick_day" });
    return { ok: true };
  });
