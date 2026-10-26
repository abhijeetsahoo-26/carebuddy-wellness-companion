import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { saveMeal, deleteMeal, restoreMeal } from "@/lib/plan.functions";
import { MEAL_TYPES, mealSchema, firstIssue } from "@/lib/validation";
import { MEAL_NOTE_UNAVAILABLE } from "@/lib/meal-note";
import { showError } from "@/lib/errors";
import { formatTimeIST, istDate, TZ } from "@/lib/time";
import type { Database } from "@/integrations/supabase/types";

type Meal = Database["public"]["Tables"]["meals"]["Row"];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(MEAL_TYPES.map((m) => [m.value, m.label]));

export const Route = createFileRoute("/meals")({
  head: () => ({
    meta: [
      { title: "Meals · CareBuddy" },
      { name: "description", content: "Note what you ate each day." },
      { property: "og:title", content: "Meals · CareBuddy" },
      { property: "og:description", content: "Note what you ate each day." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Meals /></AppShell>,
});

function dayLabel(date: string) {
  const today = istDate();
  const yesterday = istDate(new Date(Date.now() - 86400e3));
  if (date === today) return "Today";
  if (date === yesterday) return "Yesterday";
  return new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
}

function Meals() {
  const qc = useQueryClient();
  const del = useServerFn(deleteMeal);
  const restore = useServerFn(restoreMeal);
  const [editing, setEditing] = useState<Meal | "new" | null>(null);
  const q = useQuery({
    queryKey: ["meals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("meals").select("*").is("deleted_at", null).order("eaten_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });
  const groups = new Map<string, Meal[]>();
  for (const m of q.data ?? []) {
    const d = istDate(new Date(m.eaten_at));
    groups.set(d, [...(groups.get(d) ?? []), m]);
  }

  async function remove(m: Meal) {
    try {
      await del({ data: { id: m.id } });
      await qc.invalidateQueries({ queryKey: ["meals"] });
      toast.success("Meal deleted", {
        duration: 8000,
        action: { label: "Undo", onClick: async () => { try { await restore({ data: { id: m.id } }); await qc.invalidateQueries({ queryKey: ["meals"] }); } catch (e) { showError(e); } } },
      });
    } catch (e) { showError(e); }
  }

  return (
    <>
      <PageTitle title="Meals" sub="Note what you ate. A short note about nutrients may appear." />
      <Button size="lg" className="mt-6 w-full" onClick={() => setEditing("new")}><Plus /> Add a meal</Button>
      <div className="mt-6 space-y-6">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !groups.size ? <EmptyState title="No meals noted yet">Add what you ate today.</EmptyState> :
          [...groups].map(([date, meals]) => (
            <section key={date} aria-label={dayLabel(date)}>
              <h2 className="text-xl font-semibold">{dayLabel(date)}</h2>
              <ul className="mt-2 space-y-3">
                {meals.map((m) => (
                  <li key={m.id} className="rounded-2xl border bg-card p-4">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">{TYPE_LABEL[m.meal_type]} · {formatTimeIST(m.eaten_at)} {m.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
                        <p className="text-lg">{m.description}</p>
                      </div>
                      <Button size="icon" variant="ghost" aria-label="Edit meal" onClick={() => setEditing(m)}><Pencil /></Button>
                      <Button size="icon" variant="ghost" aria-label="Delete meal" onClick={() => remove(m)}><Trash2 /></Button>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap rounded-xl bg-secondary/60 p-3 text-base">
                      {m.ai_note_status === "ok" && m.ai_note ? m.ai_note : m.ai_note_status === "pending" ? "Preparing a note…" : MEAL_NOTE_UNAVAILABLE}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        {groups.size > 0 && <p className="text-sm text-muted-foreground">Nutrient notes are written by AI from your meal text only. They are general information, not advice.</p>}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === "new" ? "Add a meal" : "Edit meal"}</DialogTitle></DialogHeader>
          {editing !== null && <MealForm meal={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 330 * 60e3);
  return d.toISOString().slice(0, 16);
}

function MealForm({ meal, onDone }: { meal: Meal | null; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveMeal);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState(meal?.meal_type ?? "breakfast");
  const [desc, setDesc] = useState(meal?.description ?? "");
  const [when, setWhen] = useState(toLocalInput(meal?.eaten_at ?? new Date().toISOString()));

  async function submit() {
    const r = mealSchema.safeParse({ meal_type: type, description: desc, eaten_at: when ? `${when}:00+05:30` : "" });
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try {
      await save({ data: { id: meal?.id, meal: r.data } });
      await qc.invalidateQueries({ queryKey: ["meals"] });
      toast.success("Meal saved");
      onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {MEAL_TYPES.map((t) => (
          <button key={t.value} type="button" aria-pressed={type === t.value} onClick={() => setType(t.value)}
            className="min-h-11 rounded-xl border-2 px-2 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{t.label}</button>
        ))}
      </div>
      <div className="space-y-1">
        <Label htmlFor="meal-desc" className="text-base">What did you eat?</Label>
        <Textarea id="meal-desc" className="text-base" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="For example: 2 chapatis, dal, salad" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="meal-when" className="text-base">When (India time)</Label>
        <Input id="meal-when" type="datetime-local" className="h-12 text-base" value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save meal"}</Button>
    </div>
  );
}
