import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity · CareBuddy" },
      { name: "description", content: "A record of changes to your medicines, plan and contacts." },
      { property: "og:title", content: "Activity · CareBuddy" },
      { property: "og:description", content: "A record of changes to your medicines, plan and contacts." },
    ],
  }),
  component: () => <AppShell><Activity /></AppShell>,
});

const ENTITY: Record<string, string> = {
  emergency_contact: "Emergency contact",
  medicine: "Medicine",
  doctor_plan: "Doctor's Plan",
};
const ACTION: Record<string, string> = { create: "added", edit: "changed", delete: "removed", archive: "archived", restore: "restored" };

function Activity() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["audit"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageTitle title="Activity" sub="Who changed what, and when." />
      <div className="mt-6">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="Nothing here yet">Changes to medicines, your plan and contacts will show here.</EmptyState> : (
          <ol className="space-y-2">
            {q.data.map((a) => (
              <li key={a.id} className="rounded-2xl border bg-card p-4">
                <p className="text-lg font-semibold">{ENTITY[a.entity] ?? a.entity} {ACTION[a.action] ?? a.action}{a.entity === "medicine" && a.summary ? `: ${a.summary}` : ""}</p>
                <p className="text-muted-foreground">
                  By {a.actor_id === user?.id ? "you" : a.actor_id ? "someone you shared with" : "the system"} ·{" "}
                  {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
