import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Called by the notification buttons (Taken, Skip, Snooze) and by test-reminder receipts.
// No sign-in is available there, so each request carries a signed, expiring token
// that names exactly one dose (or test) and its owner.
const body = z.object({
  token: z.string().min(10).max(2000),
  action: z.enum(["taken", "skip", "snooze10", "snooze30", "received"]),
});

export const Route = createFileRoute("/api/public/push-action")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { verifyAction } = await import("@/lib/push.server");
        const claims = await verifyAction(parsed.data.token);
        if (!claims) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date().toISOString();
        const a = parsed.data.action;

        if (claims.k === "test") {
          if (a !== "received") return new Response("Bad request", { status: 400 });
          await supabaseAdmin.from("reminder_settings").update({ last_test_received_at: now }).eq("user_id", claims.u);
          return Response.json({ ok: true });
        }

        let patch: { status?: "taken" | "skipped"; logged_at?: string; snoozed_until: string | null };
        if (a === "taken" || a === "skip") {
          patch = { status: a === "taken" ? "taken" : "skipped", logged_at: now, snoozed_until: null };
        } else if (a === "snooze10" || a === "snooze30") {
          patch = { snoozed_until: new Date(Date.now() + (a === "snooze10" ? 10 : 30) * 60e3).toISOString() };
        } else {
          return Response.json({ ok: true });
        }
        await supabaseAdmin.from("dose_logs").update(patch).eq("id", claims.id).eq("user_id", claims.u).eq("status", "pending");
        return Response.json({ ok: true });
      },
    },
  },
});
