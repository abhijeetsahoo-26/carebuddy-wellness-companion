import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSummary, prefillQuestions, summaryRequestSchema, shareRequestSchema, type SummaryDoc } from "./summary";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}

async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Builds the summary for the signed-in user. Set record=true when the user generates the PDF. */
export const getMySummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ request: summaryRequestSchema, record: z.boolean().default(false) }).parse(d))
  .handler(async ({ data, context }) => {
    const { loadSummaryRaw } = await import("./summary.server");
    const raw = await loadSummaryRaw(context.supabase, context.userId, data.request.from, data.request.to);
    if (data.record) {
      const r = data.request;
      const { error } = await context.supabase.from("doctor_summaries").insert({
        user_id: context.userId, range_from: r.from, range_to: r.to, sections: r.sections, questions: r.questions, kind: "pdf",
      });
      if (error) fail("Could not prepare your summary.", error);
    }
    return buildSummary(raw, data.request);
  });

export const getQuestionPrefill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("appointments").select("starts_at, questions").gte("starts_at", new Date().toISOString());
    if (error) fail("Could not load your questions.", error);
    return { questions: prefillQuestions(data ?? []) };
  });

/** Creates a read-only link. The token is returned once; only its hash is stored. */
export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => shareRequestSchema.parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const r = data.request;
    const expires = new Date(Date.now() + data.expiryDays * 86400e3).toISOString();
    const { error } = await context.supabase.from("share_links").insert({
      user_id: context.userId, token_hash: await sha256Hex(token), range_from: r.from, range_to: r.to,
      sections: r.sections, questions: r.questions, expires_at: expires,
    });
    if (error) fail("Could not create the link.", error);
    await context.supabase.from("doctor_summaries").insert({ user_id: context.userId, range_from: r.from, range_to: r.to, sections: r.sections, questions: r.questions, kind: "share" });
    return { token, expires_at: expires };
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("share_links").update({ revoked_at: new Date().toISOString() }).eq("id", data.id).is("revoked_at", null);
    if (error) fail("Could not turn off the link.", error);
    return { ok: true };
  });

/** Public (no sign-in). The SQL function checks token, expiry and revocation and records the view. */
export const getSharedSummary = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data }): Promise<{ doc: SummaryDoc | null }> => {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
      const pub = createClient(process.env["SUPABASE_URL"]!, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        } },
      });
      const { data: link, error } = await pub.rpc("open_share_link", { _token: data.token });
      if (error || !link) return { doc: null };
      const l = link as { user_id: string; range_from: string; range_to: string; sections: string[]; questions: string[] };
      const req = summaryRequestSchema.parse({ from: l.range_from, to: l.range_to, sections: l.sections, questions: l.questions });
      // The token was verified above; read only this owner's rows for the chosen range.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { loadSummaryRaw } = await import("./summary.server");
      return { doc: buildSummary(await loadSummaryRaw(supabaseAdmin, l.user_id, req.from, req.to), req) };
    } catch (e) {
      console.error("shared summary failed", e);
      return { doc: null };
    }
  });
