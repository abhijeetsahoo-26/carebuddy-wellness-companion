import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

export const Route = createFileRoute("/api/public/jobs/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runReminderJob } = await import("@/lib/reminders.server");
        try {
          const r = await runReminderJob(supabaseAdmin);
          return Response.json({ ok: true, ...r });
        } catch (e) {
          console.error("reminder job failed", e);
          return Response.json({ ok: false }, { status: 500 });
        }
      },
    },
  },
});
