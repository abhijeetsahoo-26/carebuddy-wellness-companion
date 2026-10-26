import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Utensils, Pill } from "lucide-react";
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
import { addDiaryEntry, updateDiaryNotes, setDiaryDeleted } from "@/lib/diary.functions";
import { diaryEntrySchema, firstIssue } from "@/lib/validation";
import { RESULT_LABEL, SYMPTOMS, type UnwellResult } from "@/lib/unwell";
import { showError } from "@/lib/errors";
import { formatDateTimeIST, formatTimeIST, istDate } from "@/lib/time";
import type { Database } from "@/integrations/supabase/types";

type Entry = Database["public"]["Tables"]["symptom_entries"]["Row"];

export const Route = createFileRoute("/diary")({
  head: () => ({
    meta: [
      { title: "Symptom diary · CareBuddy" },
      { name: "description", content: "A timeline of how you have been feeling." },
      { property: "og:title", content: "Symptom diary · CareBuddy" },
      { property: "og:description", content: "A timeline of how you have been feeling." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Diary /></AppShell>,
});

const RESULT_STYLE: Record<UnwellResult, string> = {
  emergency: "bg-emergency text-emergency-foreground",
  doctor_soon: "bg-primary text-primary-foreground",
  self_care: "bg-secondary text-secondary-foreground",
};

function Diary() {
  const qc = useQueryClient();
  const setDeleted = useServerFn(setDiaryDeleted);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const q = useQuery({
    queryKey: ["diary"],
    queryFn: async () => {
      const { data: entries, error } = await supabase.from("symptom_entries").select("*").is("deleted_at", null).order("occurred_at", { ascending: false }).limit(200);
      if (error) throw error;
      if (!entries.length) return { entries, meals: [], doses: [] };
      const from = new Date(Math.min(...entries.map((e) => new Date(e.occurred_at).getTime())) - 86400e3).toISOString();
      const [m, d] = await Promise.all([
        supabase.from("meals").select("id, meal_type, description, eaten_at").is("deleted_at", null).gte("eaten_at", from),
        supabase.from("dose_logs").select("id, scheduled_at, logged_at, status, medicines(name)").in("status", ["taken", "late"]).gte("scheduled_at", from),
      ]);
      if (m.error ?? d.error) throw m.error ?? d.error;
      return { entries, meals: m.data, doses: d.data };
    },
  });

  async function remove(e: Entry) {
    try {
      await setDeleted({ data: { id: e.id, deleted: true } });
      await qc.invalidateQueries({ queryKey: ["diary"] });
      toast.success("Entry deleted", {
        duration: 8000,
        action: { label: "Undo", onClick: async () => { try { await setDeleted({ data: { id: e.id, deleted: false } }); await qc.invalidateQueries({ queryKey: ["diary"] }); } catch (err) { showError(err); } } },
      });
    } catch (err) { showError(err); }
  }

  return (
    <>
      <PageTitle title="Symptom diary" sub="How you have been feeling, with India times." />
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={() => setAdding(true)}><Plus /> Add an entry</Button>
        <Button asChild size="lg" variant="outline"><Link to="/unwell">Check how I feel</Link></Button>
      </div>
      <div className="mt-6 space-y-4">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.entries.length ? <EmptyState title="No entries yet">Each "I feel unwell" check is saved here. You can also add your own.</EmptyState> :
          q.data.entries.map((e) => {
            const day = istDate(new Date(e.occurred_at));
            const meals = q.data.meals.filter((m) => istDate(new Date(m.eaten_at)) === day);
            const doses = q.data.doses.filter((x) => istDate(new Date(x.scheduled_at)) === day);
            return (
              <article key={e.id} className="rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{formatDateTimeIST(e.occurred_at)} · {e.source === "check" ? "Unwell check" : "My entry"} {e.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
                    <p className="mt-1 text-lg font-semibold">{e.symptoms.join(", ") || "No symptoms listed"}</p>
                  </div>
                  <Button size="icon" variant="ghost" aria-label="Edit notes" onClick={() => setEditing(e)}><Pencil /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete entry" onClick={() => remove(e)}><Trash2 /></Button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {e.severity !== null && <Badge variant="outline">Severity {e.severity} of 10</Badge>}
                  {e.result && <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${RESULT_STYLE[e.result as UnwellResult]}`}>Result: {RESULT_LABEL[e.result as UnwellResult]}</span>}
                </div>
                {e.notes && <p className="mt-2 whitespace-pre-wrap">{e.notes}</p>}
                {(meals.length > 0 || doses.length > 0) && (
                  <div className="mt-3 space-y-1 rounded-xl bg-secondary/50 p-3 text-base">
                    <p className="text-sm font-semibold text-muted-foreground">That day</p>
                    {meals.map((m) => <p key={m.id} className="flex gap-2"><Utensils className="mt-1 size-4 shrink-0" aria-hidden /> {formatTimeIST(m.eaten_at)} · {m.description}</p>)}
                    {doses.map((x) => <p key={x.id} className="flex gap-2"><Pill className="mt-1 size-4 shrink-0" aria-hidden /> {formatTimeIST(x.logged_at ?? x.scheduled_at)} · Took {x.medicines?.name ?? "a medicine"}</p>)}
                  </div>
                )}
              </article>
            );
          })}
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add a diary entry</DialogTitle></DialogHeader>
          {adding && <AddForm onDone={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit notes</DialogTitle></DialogHeader>
          {editing && <NotesForm entry={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function nowLocal() { return new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 16); }

function AddForm({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const add = useServerFn(addDiaryEntry);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [severity, setSeverity] = useState<number | null>(null);
  const [when, setWhen] = useState(nowLocal());
  const [notes, setNotes] = useState("");
  async function submit() {
    const symptoms = [...picked, ...other.split(",").map((s) => s.trim()).filter(Boolean)];
    const r = diaryEntrySchema.safeParse({ occurred_at: when ? `${when}:00+05:30` : "", symptoms, severity, notes });
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try { await add({ data: r.data }); await qc.invalidateQueries({ queryKey: ["diary"] }); toast.success("Entry saved"); onDone(); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SYMPTOMS.filter((s) => !("red" in s)).map((s) => {
          const on = picked.includes(s.label);
          return <button key={s.value} type="button" aria-pressed={on} onClick={() => setPicked(on ? picked.filter((x) => x !== s.label) : [...picked, s.label])}
            className="min-h-11 rounded-xl border-2 px-3 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{s.label}</button>;
        })}
      </div>
      <div className="space-y-1"><Label htmlFor="d-other" className="text-base">Other symptoms (separate with commas)</Label>
        <Input id="d-other" className="h-12 text-base" value={other} onChange={(e) => setOther(e.target.value)} /></div>
      <div className="space-y-1">
        <Label className="text-base">How bad, 0 to 10 (optional)</Label>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, n) => (
            <button key={n} type="button" aria-pressed={severity === n} onClick={() => setSeverity(severity === n ? null : n)}
              className="min-h-11 rounded-xl border-2 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{n}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1"><Label htmlFor="d-when" className="text-base">When (India time)</Label>
        <Input id="d-when" type="datetime-local" className="h-12 text-base" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="d-notes" className="text-base">Notes (optional)</Label>
        <Textarea id="d-notes" className="text-base" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <p className="text-sm text-muted-foreground">A diary entry does not check for warning signs. If you feel very unwell, tap Emergency.</p>
      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save entry"}</Button>
    </div>
  );
}

function NotesForm({ entry, onDone }: { entry: Entry; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(updateDiaryNotes);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try { await save({ data: { id: entry.id, notes } }); await qc.invalidateQueries({ queryKey: ["diary"] }); toast.success("Notes saved"); onDone(); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <Textarea aria-label="Notes" className="min-h-32 text-base" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save notes"}</Button>
    </div>
  );
}
