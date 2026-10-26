import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Droplet, SkipForward, Clock, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { useDoses, type DoseRow } from "@/hooks/useDoses";
import { markDose, undoDose, snoozeDose, refreshMyDoses, addWater, removeWater } from "@/lib/medicines.functions";
import { showError } from "@/lib/errors";
import { canUndo, formatTimeIST, istDate, istDayStartUTC } from "@/lib/time";
import { FOOD_OPTIONS } from "@/lib/validation";

const FOOD: Record<string, string> = Object.fromEntries(FOOD_OPTIONS.map((f) => [f.value, f.label]));
const STATUS: Record<string, string> = { taken: "Taken", skipped: "Skipped", late: "Taken late" };

export function TodayDoses() {
  const qc = useQueryClient();
  const refresh = useServerFn(refreshMyDoses);
  const mark = useServerFn(markDose);
  const undo = useServerFn(undoDose);
  const snooze = useServerFn(snoozeDose);
  const q = useDoses(0);
  const [, tick] = useState(0);

  useEffect(() => {
    refresh().then(() => qc.invalidateQueries({ queryKey: ["doses"] })).catch(() => {});
    const t = setInterval(() => tick((n) => n + 1), 30000); // keeps Undo windows and "next" fresh
    return () => clearInterval(t);
  }, [refresh, qc]);

  const reload = () => qc.invalidateQueries({ queryKey: ["doses"] });

  async function doMark(d: DoseRow, status: "taken" | "skipped" | "late") {
    try {
      await mark({ data: { id: d.id, status } });
      await reload();
      toast(status === "skipped" ? "Marked as skipped" : "Marked as taken", {
        action: { label: "Undo", onClick: () => doUndo(d) },
      });
    } catch (e) { showError(e); }
  }
  async function doUndo(d: DoseRow) {
    try { await undo({ data: { id: d.id } }); await reload(); } catch (e) { showError(e); }
  }
  async function doSnooze(d: DoseRow, minutes: 10 | 30) {
    try { await snooze({ data: { id: d.id, minutes } }); await reload(); toast(`We'll remind you again in ${minutes} minutes`); }
    catch (e) { showError(e); }
  }

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const doses = q.data ?? [];
  const next = doses.find((d) => d.status === "pending");

  return (
    <>
      <section className="mt-6 rounded-2xl border-2 border-primary bg-card p-5" aria-labelledby="next-dose">
        <h2 id="next-dose" className="text-xl font-semibold">Next medicine</h2>
        {!doses.length ? (
          <p className="mt-2 text-muted-foreground">No medicines for today. <Link to="/medicines" className="font-semibold text-primary underline">Add one</Link></p>
        ) : !next ? (
          <p className="mt-2 text-lg">All done for today. Well done.</p>
        ) : (
          <>
            <p className="mt-2 text-2xl font-bold">{formatTimeIST(next.scheduled_at)}</p>
            <p className="text-lg">{next.medicine?.name} {next.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
            <p className="text-muted-foreground">{[next.medicine?.dose_amount, FOOD[next.medicine?.food ?? "any"]].filter(Boolean).join(" · ")}</p>
            {next.snoozed_until && new Date(next.snoozed_until) > new Date() && (
              <p className="mt-1 text-sm text-muted-foreground">Reminder snoozed until {formatTimeIST(next.snoozed_until)}</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => doMark(next, "taken")}><Check /> Taken</Button>
              <Button size="lg" variant="outline" onClick={() => doMark(next, "skipped")}><SkipForward /> Skip</Button>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => doSnooze(next, 10)}><Clock /> 10 min</Button>
              <Button variant="ghost" size="sm" onClick={() => doSnooze(next, 30)}><Clock /> 30 min</Button>
            </div>
          </>
        )}
      </section>

      {doses.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-semibold">Today's checklist</h2>
          <ul className="mt-3 space-y-2">
            {doses.map((d) => (
              <li key={d.id} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="w-20 shrink-0 font-semibold">{formatTimeIST(d.scheduled_at)}</span>
                  <span className="flex-1">{d.medicine?.name} {d.is_demo && <Badge variant="secondary">Sample</Badge>}</span>
                </div>
                {d.status === "pending" ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Button size="sm" onClick={() => doMark(d, "taken")}>Taken</Button>
                    <Button size="sm" variant="outline" onClick={() => doMark(d, "late")}>Late</Button>
                    <Button size="sm" variant="outline" onClick={() => doMark(d, "skipped")}>Skip</Button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
                    <span>{STATUS[d.status]}{d.logged_at ? ` at ${formatTimeIST(d.logged_at)}` : ""}</span>
                    {canUndo(d.logged_at) && <Button size="sm" variant="ghost" onClick={() => doUndo(d)}><Undo2 /> Undo</Button>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <WaterCard />
    </>
  );
}

function WaterCard() {
  const qc = useQueryClient();
  const add = useServerFn(addWater);
  const remove = useServerFn(removeWater);
  const q = useQuery({
    queryKey: ["water", istDate()],
    queryFn: async () => {
      const { count, error } = await supabase.from("water_logs").select("id", { count: "exact", head: true })
        .gte("logged_at", istDayStartUTC(istDate()).toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
  async function plus() {
    try {
      const { id } = await add();
      await qc.invalidateQueries({ queryKey: ["water"] });
      toast("Added a glass of water", { action: { label: "Undo", onClick: async () => { await remove({ data: { id } }); await qc.invalidateQueries({ queryKey: ["water"] }); } } });
    } catch (e) { showError(e); }
  }
  return (
    <section className="mt-6 flex items-center gap-4 rounded-2xl border bg-card p-5">
      <Droplet className="size-8 text-primary" aria-hidden />
      <div className="flex-1">
        <h2 className="text-xl font-semibold">Water</h2>
        <p className="text-muted-foreground">{q.data ?? 0} glasses today</p>
      </div>
      <Button size="lg" onClick={plus} aria-label="Add one glass of water">+1</Button>
    </section>
  );
}

export function EmptyDoses() {
  return <EmptyState title="Nothing due">Your medicines will show here.</EmptyState>;
}
