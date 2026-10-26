import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { getCaregiverDashboard, leaveCaregiving, setCaregiverAlerts } from "@/lib/caregiver.functions";
import { showError } from "@/lib/errors";
import { formatDateTimeIST } from "@/lib/time";

export const Route = createFileRoute("/caregiving")({
  head: () => ({
    meta: [
      { title: "People I look after · CareBuddy" },
      { name: "description", content: "Read-only updates shared with you by people who invited you as a caregiver." },
      { property: "og:title", content: "People I look after · CareBuddy" },
      { property: "og:description", content: "Read-only updates shared with you by people who invited you as a caregiver." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Caregiving /></AppShell>,
});

type Item = { id: string; status: string; alerts_enabled: boolean; can_missed_alerts: boolean; first_name: string };

function Caregiving() {
  const q = useQuery({
    queryKey: ["caregiving"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_caregiving");
      if (error) throw error;
      return (data as Item[] | null) ?? [];
    },
  });
  return (
    <>
      <PageTitle title="People I look after" sub="Read-only. You see only what each person chose to share." />
      <div className="mt-6 space-y-6">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="No one has shared with you yet">When someone sends you an invite link, open it to start.</EmptyState> :
          q.data.map((g) => <Person key={g.id} g={g} />)}
      </div>
    </>
  );
}

function Person({ g }: { g: Item }) {
  const qc = useQueryClient();
  const load = useServerFn(getCaregiverDashboard);
  const alerts = useServerFn(setCaregiverAlerts);
  const leave = useServerFn(leaveCaregiving);
  const d = useQuery({
    queryKey: ["caregiving", g.id],
    enabled: g.status === "active",
    staleTime: 60_000,
    queryFn: async () => (await load({ data: { id: g.id } })).dashboard,
  });
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-2xl font-semibold">{g.first_name}</h2>
      {g.status === "paused" ? <p className="mt-2 text-lg">{g.first_name} has paused sharing for now.</p> :
        d.isLoading ? <LoadingState /> : d.error ? <ErrorState error={d.error} onRetry={() => d.refetch()} /> : !d.data ? <p className="mt-2 text-lg">Sharing is not available.</p> : (
          <div className="mt-3 space-y-4 text-lg">
            {d.data.adherence && (
              <div>
                <h3 className="font-semibold">Doses, last 7 days</h3>
                <p>Taken: {d.data.adherence.taken} of {d.data.adherence.due} · Skipped: {d.data.adherence.skipped} · Not marked: {d.data.adherence.not_marked}</p>
              </div>
            )}
            {d.data.not_marked && (
              <div>
                <h3 className="font-semibold">Doses not marked after 2 hours (last 2 days)</h3>
                {d.data.not_marked.length ? <ul className="list-disc pl-6">{d.data.not_marked.map((t) => <li key={t}>{formatDateTimeIST(t)}</li>)}</ul> : <p>None.</p>}
              </div>
            )}
            {d.data.appointments && (
              <div>
                <h3 className="font-semibold">Upcoming appointments</h3>
                {d.data.appointments.length ? <ul className="list-disc pl-6">{d.data.appointments.map((a) => <li key={a.starts_at}>{formatDateTimeIST(a.starts_at)} · {a.doctor}{a.location ? ` · ${a.location}` : ""}</li>)}</ul> : <p>None.</p>}
              </div>
            )}
            <p className="text-sm text-muted-foreground">{g.first_name} can see each time you open this.</p>
          </div>
        )}
      {g.can_missed_alerts && (
        <div className="mt-4 flex min-h-11 items-center justify-between gap-3">
          <Label htmlFor={`al-${g.id}`} className="text-base">Alert me when a dose is not marked</Label>
          <Switch id={`al-${g.id}`} checked={g.alerts_enabled} onCheckedChange={async (on) => {
            try { await alerts({ data: { id: g.id, on } }); await qc.invalidateQueries({ queryKey: ["caregiving"] }); } catch (e) { showError(e); }
          }} />
        </div>
      )}
      <Button variant="ghost" className="mt-2 h-11" onClick={async () => {
        if (!confirm(`Stop seeing ${g.first_name}'s updates?`)) return;
        try { await leave({ data: { id: g.id } }); toast.success("Stopped"); await qc.invalidateQueries({ queryKey: ["caregiving"] }); } catch (e) { showError(e); }
      }}>Stop seeing these updates</Button>
    </section>
  );
}
