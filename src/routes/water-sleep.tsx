import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplet, Moon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { setWaterGoal, saveSleep, deleteSleep } from "@/lib/tracking.functions";
import { sleepSchema, waterGoalSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";
import { istDate, istDayStartUTC, TZ } from "@/lib/time";

export const Route = createFileRoute("/water-sleep")({
  head: () => ({
    meta: [
      { title: "Water and sleep · CareBuddy" },
      { name: "description", content: "Your daily water and nightly sleep." },
      { property: "og:title", content: "Water and sleep · CareBuddy" },
      { property: "og:description", content: "Your daily water and nightly sleep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><WaterSleep /></AppShell>,
});

const dayName = (d: string) => new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const lastDays = (n: number) => Array.from({ length: n }, (_, i) => istDate(new Date(Date.now() - i * 86400e3)));

function WaterSleep() {
  const qc = useQueryClient();
  const saveGoal = useServerFn(setWaterGoal);
  const save = useServerFn(saveSleep);
  const del = useServerFn(deleteSleep);
  const days = lastDays(14);
  const q = useQuery({
    queryKey: ["water", "history"],
    queryFn: async () => {
      const [w, g, s] = await Promise.all([
        supabase.from("water_logs").select("logged_at").gte("logged_at", istDayStartUTC(days.at(-1)!).toISOString()),
        supabase.from("hydration_logs").select("day, goal_glasses").order("day"),
        supabase.from("sleep_logs").select("*").order("night", { ascending: false }).limit(30),
      ]);
      const err = w.error ?? g.error ?? s.error;
      if (err) throw err;
      const counts: Record<string, number> = {};
      for (const r of w.data ?? []) { const d = istDate(new Date(r.logged_at)); counts[d] = (counts[d] ?? 0) + 1; }
      const goalOn = (d: string) => [...(g.data ?? [])].reverse().find((x) => x.day <= d)?.goal_glasses ?? null;
      return { counts, goalOn, sleep: s.data ?? [] };
    },
  });
  const currentGoal = q.data?.goalOn(istDate()) ?? null;
  const [goalText, setGoalText] = useState("");
  const [night, setNight] = useState(istDate(new Date(Date.now() - 86400e3)));
  const [hours, setHours] = useState("");

  async function submitGoal(clear = false) {
    const r = waterGoalSchema.safeParse({ goal_glasses: clear ? null : goalText === "" ? NaN : Number(goalText) });
    if (!r.success) return void toast.error(firstIssue(r));
    try { await saveGoal({ data: r.data }); await qc.invalidateQueries({ queryKey: ["water"] }); setGoalText(""); toast.success(clear ? "Goal removed" : "Goal saved"); }
    catch (e) { showError(e); }
  }
  async function submitSleep() {
    const r = sleepSchema.safeParse({ night, hours: hours === "" ? NaN : Number(hours) });
    if (!r.success) return void toast.error(firstIssue(r));
    try { await save({ data: r.data }); await qc.invalidateQueries({ queryKey: ["water"] }); setHours(""); toast.success("Sleep saved"); }
    catch (e) { showError(e); }
  }

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  return (
    <>
      <PageTitle title="Water and sleep" sub="Add glasses of water with the +1 button on Today." />

      <section className="mt-6 rounded-2xl border bg-card p-5" aria-labelledby="wg">
        <h2 id="wg" className="flex items-center gap-2 text-xl font-semibold"><Droplet className="size-6 text-primary" aria-hidden /> Daily water goal (optional)</h2>
        <p className="mt-1 text-lg">{currentGoal ? `Your goal: ${currentGoal} glasses a day` : "No goal set."}</p>
        <div className="mt-3 flex gap-2">
          <Input aria-label="Glasses a day" type="number" inputMode="numeric" min={1} max={30} placeholder="Glasses a day" className="h-12 text-base" value={goalText} onChange={(e) => setGoalText(e.target.value)} />
          <Button size="lg" onClick={() => submitGoal()}>Save</Button>
          {currentGoal && <Button size="lg" variant="ghost" onClick={() => submitGoal(true)}>Remove</Button>}
        </div>
        <h3 className="mt-5 text-lg font-semibold">Last 14 days</h3>
        <ul className="mt-2 divide-y">
          {days.map((d) => {
            const n = q.data!.counts[d] ?? 0;
            const goal = q.data!.goalOn(d);
            return <li key={d} className="flex min-h-11 items-center justify-between"><span>{dayName(d)}</span><span className="font-semibold">{n} glass{n === 1 ? "" : "es"}{goal ? ` of ${goal}` : ""}</span></li>;
          })}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5" aria-labelledby="sl">
        <h2 id="sl" className="flex items-center gap-2 text-xl font-semibold"><Moon className="size-6 text-primary" aria-hidden /> Sleep</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="s-night" className="text-base">Night of</Label>
            <Input id="s-night" type="date" max={istDate()} className="h-12 text-base" value={night} onChange={(e) => setNight(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="s-hours" className="text-base">Hours slept</Label>
            <Input id="s-hours" type="number" inputMode="decimal" step="0.5" min={0} max={24} className="h-12 text-base" value={hours} onChange={(e) => setHours(e.target.value)} /></div>
        </div>
        <Button size="lg" className="mt-3 w-full" onClick={submitSleep}>Save sleep</Button>
        <ul className="mt-4 divide-y">
          {q.data!.sleep.map((s) => (
            <li key={s.id} className="flex min-h-12 items-center justify-between gap-2">
              <span>Night of {dayName(s.night)} {s.is_demo && <Badge variant="secondary">Sample</Badge>}</span>
              <span className="flex items-center gap-1 font-semibold">{Number(s.hours)} h
                <Button size="icon" variant="ghost" aria-label={`Delete sleep for ${dayName(s.night)}`} onClick={async () => { try { await del({ data: { id: s.id } }); await qc.invalidateQueries({ queryKey: ["water"] }); } catch (e) { showError(e); } }}><Trash2 /></Button>
              </span>
            </li>
          ))}
          {!q.data!.sleep.length && <li className="py-2 text-muted-foreground">No sleep entered yet.</li>}
        </ul>
      </section>
    </>
  );
}
