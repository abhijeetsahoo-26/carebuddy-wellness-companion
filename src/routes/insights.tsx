import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { weeklyInsights, TIME_SLOTS, MIN_DAYS, streak, streakMessage } from "@/lib/tracking";
import { istDate, istDayStartUTC } from "@/lib/time";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "This week · CareBuddy" },
      { name: "description", content: "A kind weekly look at your medicines, water, sleep and symptoms." },
      { property: "og:title", content: "This week · CareBuddy" },
      { property: "og:description", content: "A kind weekly look at your medicines, water, sleep and symptoms." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Insights /></AppShell>,
});

function Insights() {
  const q = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const from = istDayStartUTC(istDate(new Date(Date.now() - 60 * 86400e3))).toISOString();
      const [d, w, s, e] = await Promise.all([
        supabase.from("dose_logs").select("scheduled_at, status").gte("scheduled_at", from).lte("scheduled_at", new Date(Date.now() + 86400e3).toISOString()),
        supabase.from("water_logs").select("logged_at").gte("logged_at", from),
        supabase.from("sleep_logs").select("night, hours").gte("night", istDate(new Date(from))),
        supabase.from("symptom_entries").select("occurred_at, symptoms").is("deleted_at", null).gte("occurred_at", from),
      ]);
      const err = d.error ?? w.error ?? s.error ?? e.error;
      if (err) throw err;
      const waterDays: Record<string, number> = {};
      for (const r of w.data) { const k = istDate(new Date(r.logged_at)); waterDays[k] = (waterDays[k] ?? 0) + 1; }
      return {
        insights: weeklyInsights({ doses: d.data, waterDays, sleep: s.data.map((x) => ({ night: x.night, hours: Number(x.hours) })), symptoms: e.data }),
        streak: streak(d.data),
      };
    },
  });

  return (
    <>
      <PageTitle title="This week" sub="A look back at the last 7 days." />
      <div className="mt-6 space-y-4">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !q.data!.insights.enough ? (
          <EmptyState title="Not enough data yet">
            Insights appear once you have used CareBuddy on {MIN_DAYS} different days. So far: {q.data!.insights.dataDays} day{q.data!.insights.dataDays === 1 ? "" : "s"}.
          </EmptyState>
        ) : (() => {
          const i = q.data!.insights;
          return (
            <>
              <Card title="Medicines">
                <p className="text-3xl font-bold">{i.adherencePct === null ? "—" : `${i.adherencePct}%`}</p>
                <p className="text-muted-foreground">of doses this week were marked taken.</p>
                <p className="mt-2">{streakMessage(q.data!.streak, false)}</p>
              </Card>
              <Card title={'"Not marked" doses by time of day'}>
                <ul className="divide-y">
                  {TIME_SLOTS.map((t) => <li key={t.key} className="flex min-h-11 items-center justify-between"><span>{t.label}</span><span className="font-semibold">{i.notMarked[t.key] ?? 0}</span></li>)}
                </ul>
              </Card>
              <Card title="Water and sleep">
                <p className="text-lg">Average water: <span className="font-semibold">{i.avgWater ?? "—"} glasses a day</span></p>
                <p className="text-lg">Average sleep: <span className="font-semibold">{i.avgSleep === null ? "not entered" : `${i.avgSleep} hours a night`}</span></p>
              </Card>
              <Card title="Most logged symptoms">
                {i.topSymptoms.length ? <ul className="list-disc pl-6 text-lg">{i.topSymptoms.map((s) => <li key={s.name}>{s.name}: {s.days} day{s.days === 1 ? "" : "s"}</li>)}</ul>
                  : <p className="text-lg">No symptoms logged this week.</p>}
              </Card>
              {i.patterns.length > 0 && (
                <Card title="Things we noticed">
                  <ul className="list-disc space-y-1 pl-6 text-lg">{i.patterns.map((p) => <li key={p}>{p}</li>)}</ul>
                  <p className="mt-2 text-sm text-muted-foreground">These are simple counts from what you entered. They do not explain causes. You may want to show them to your doctor.</p>
                </Card>
              )}
            </>
          );
        })()}
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border bg-card p-5"><h2 className="mb-2 text-xl font-semibold">{title}</h2>{children}</section>;
}
