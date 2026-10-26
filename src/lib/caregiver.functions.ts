import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { INVITE_DAYS, grantUpdateSchema, inviteSchema } from "./caregiver";

function fail(msg: string, e?: unknown): never {
  if (e) console.error(msg, e);
  throw new Error(msg);
}
async function sha256Hex(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const tokenSchema = z.object({ token: z.string().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/) });

/** Single-use invite, valid 3 days. Only the hash is stored, so the link is shown once. */
export const createCaregiverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const expires = new Date(Date.now() + INVITE_DAYS * 86400e3).toISOString();
    const { error } = await context.supabase.from("caregiver_grants").insert({
      ...data, user_id: context.userId, invite_hash: await sha256Hex(token), invite_expires_at: expires, status: "invited",
    });
    if (error) fail("Could not create the invite.", error);
    return { token, expires_at: expires };
  });

export const updateCaregiverGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => grantUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: g } = await sb.from("caregiver_grants").select("status").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (!g) fail("That caregiver was not found.");
    let patch: Record<string, unknown>;
    switch (data.action) {
      case "pause": if (g.status !== "active") fail("Only active access can be paused."); patch = { status: "paused" }; break;
      case "resume": if (g.status !== "paused") fail("Only paused access can be resumed."); patch = { status: "active" }; break;
      case "revoke": if (g.status !== "active" && g.status !== "paused") fail("Access has already ended."); patch = { status: "revoked" }; break;
      case "cancel": if (g.status !== "invited") fail("This invite can no longer be cancelled."); patch = { status: "cancelled" }; break;
      default: {
        const c = { can_adherence: !!data.can_adherence, can_missed_alerts: !!data.can_missed_alerts, can_appointments: !!data.can_appointments };
        if (!c.can_adherence && !c.can_missed_alerts && !c.can_appointments) fail("Choose at least one thing to share, or revoke access.");
        patch = c;
      }
    }
    const { error } = await sb.from("caregiver_grants").update(patch).eq("id", data.id);
    if (error) fail("Could not update access.", error);
    return { ok: true };
  });

export const acceptCaregiverInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => tokenSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("accept_caregiver_invite", { _token: data.token });
    if (error) fail("Could not accept the invite.", error);
    if (!id) fail("This invite is not available. It may have been used, cancelled or expired.");
    return { id: id as string };
  });

export type CaregiverDashboard = {
  first_name: string;
  adherence?: { due: number; taken: number; skipped: number; not_marked: number };
  not_marked?: string[];
  appointments?: { starts_at: string; doctor: string; location: string | null }[];
};

/** Runs as the caregiver under RLS; the SQL function checks the grant, returns only allowed categories and logs the view. */
export const getCaregiverDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: d, error } = await context.supabase.rpc("get_caregiver_dashboard", { _grant: data.id });
    if (error) fail("Could not load this view.", error);
    return { dashboard: (d as CaregiverDashboard | null) ?? null };
  });

export const setCaregiverAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), on: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_caregiver_alerts", { _grant: data.id, _on: data.on });
    if (error) fail("Could not change alerts.", error);
    return { ok: true };
  });

export const leaveCaregiving = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("leave_caregiver_grant", { _grant: data.id });
    if (error) fail("Could not stop.", error);
    return { ok: true };
  });
