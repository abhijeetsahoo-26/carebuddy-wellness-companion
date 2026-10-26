import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ListPlus, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { saveAppointment, deleteAppointment } from "@/lib/tracking.functions";
import { appointmentSchema, firstIssue } from "@/lib/validation";
import { questionsFromDiary } from "@/lib/tracking";
import { showError } from "@/lib/errors";
import { formatDateTimeIST } from "@/lib/time";
import type { Database } from "@/integrations/supabase/types";

type Appt = Database["public"]["Tables"]["appointments"]["Row"];

export const Route = createFileRoute("/appointments")({
  head: () => ({
    meta: [
      { title: "Appointments · CareBuddy" },
      { name: "description", content: "Your doctor visits and the questions you want to ask." },
      { property: "og:title", content: "Appointments · CareBuddy" },
      { property: "og:description", content: "Your doctor visits and the questions you want to ask." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Appointments /></AppShell>,
});

function Appointments() {
  const qc = useQueryClient();
  const del = useServerFn(deleteAppointment);
  const [editing, setEditing] = useState<Appt | "new" | null>(null);
  const q = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*").order("starts_at");
      if (error) throw error;
      return data;
    },
  });
  const now = Date.now();
  const upcoming = q.data?.filter((a) => new Date(a.starts_at).getTime() >= now - 3600e3) ?? [];
  const past = q.data?.filter((a) => new Date(a.starts_at).getTime() < now - 3600e3).reverse() ?? [];

  async function remove(a: Appt) {
    if (!window.confirm("Delete this appointment?")) return;
    try { await del({ data: { id: a.id } }); await qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Appointment deleted"); }
    catch (e) { showError(e); }
  }

  const card = (a: Appt) => (
    <li key={a.id} className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-lg font-semibold">{formatDateTimeIST(a.starts_at)} {a.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
          <p className="text-lg">{a.doctor}</p>
          {a.location && <p className="text-muted-foreground">{a.location}</p>}
          {a.purpose && <p>{a.purpose}</p>}
        </div>
        <Button size="icon" variant="ghost" aria-label="Edit appointment" onClick={() => setEditing(a)}><Pencil /></Button>
        <Button size="icon" variant="ghost" aria-label="Delete appointment" onClick={() => remove(a)}><Trash2 /></Button>
      </div>
      {a.notes && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{a.notes}</p>}
      {a.questions.length > 0 && (
        <div className="mt-3 rounded-xl bg-secondary/50 p-3">
          <p className="font-semibold">Questions to ask</p>
          <ul className="list-disc pl-6">{a.questions.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      )}
    </li>
  );

  return (
    <>
      <PageTitle title="Appointments" sub="Reminders come the day before and 2 hours before." />
      <Button size="lg" className="mt-6 w-full" onClick={() => setEditing("new")}><Plus /> Add an appointment</Button>
      <div className="mt-6">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="No appointments yet">Add your next doctor visit.</EmptyState> : (
            <>
              <h2 className="flex items-center gap-2 text-xl font-semibold"><CalendarClock className="size-5" /> Coming up</h2>
              {upcoming.length ? <ul className="mt-2 space-y-3">{upcoming.map(card)}</ul> : <p className="mt-2 text-muted-foreground">Nothing coming up.</p>}
              {past.length > 0 && <><h2 className="mt-8 text-xl font-semibold">Earlier</h2><ul className="mt-2 space-y-3">{past.map(card)}</ul></>}
            </>
          )}
      </div>
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "Add an appointment" : "Edit appointment"}</DialogTitle></DialogHeader>
          {editing !== null && <ApptForm appt={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

const toLocal = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60e3).toISOString().slice(0, 16);

function ApptForm({ appt, onDone }: { appt: Appt | null; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveAppointment);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    doctor: appt?.doctor ?? "", when: appt ? toLocal(appt.starts_at) : "", location: appt?.location ?? "",
    purpose: appt?.purpose ?? "", notes: appt?.notes ?? "",
  });
  const [questions, setQuestions] = useState<string[]>(appt?.questions ?? []);
  const [newQ, setNewQ] = useState("");

  async function fromDiary() {
    const since = new Date(Date.now() - 14 * 86400e3).toISOString();
    const { data, error } = await supabase.from("symptom_entries").select("occurred_at, symptoms").is("deleted_at", null).gte("occurred_at", since).order("occurred_at");
    if (error) return showError(error);
    const lines = questionsFromDiary(data).map((l) => `I logged ${l}. What should I know about this?`);
    if (!lines.length) return void toast("No diary entries in the last 14 days");
    setQuestions([...questions, ...lines.filter((l) => !questions.includes(l))]);
    toast.success("Added from your diary. You can edit or remove any of them.");
  }

  async function submit() {
    const r = appointmentSchema.safeParse({ ...f, starts_at: f.when ? `${f.when}:00+05:30` : "", questions: questions.map((x) => x.trim()).filter(Boolean) });
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try { await save({ data: { id: appt?.id, appointment: r.data } }); await qc.invalidateQueries({ queryKey: ["appointments"] }); toast.success("Appointment saved"); onDone(); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }

  const field = (k: keyof typeof f, label: string, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={`a-${k}`} className="text-base">{label}</Label>
      <Input id={`a-${k}`} type={type} className="h-12 text-base" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      {field("doctor", "Doctor")}
      {field("when", "Date and time (India time)", "datetime-local")}
      {field("location", "Location")}
      {field("purpose", "Purpose")}
      <div className="space-y-1"><Label htmlFor="a-notes" className="text-base">Notes</Label>
        <Textarea id="a-notes" className="text-base" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      <div className="space-y-2">
        <p className="text-base font-semibold">Questions to ask</p>
        {questions.map((x, i) => (
          <div key={i} className="flex gap-2">
            <Input aria-label={`Question ${i + 1}`} className="h-12 text-base" value={x} onChange={(e) => setQuestions(questions.map((y, j) => (j === i ? e.target.value : y)))} />
            <Button size="icon" variant="ghost" aria-label={`Remove question ${i + 1}`} onClick={() => setQuestions(questions.filter((_, j) => j !== i))}><X /></Button>
          </div>
        ))}
        <div className="flex gap-2">
          <Input aria-label="New question" placeholder="Type a question" className="h-12 text-base" value={newQ} onChange={(e) => setNewQ(e.target.value)} />
          <Button variant="outline" onClick={() => { if (newQ.trim()) { setQuestions([...questions, newQ.trim()]); setNewQ(""); } }}><Plus /> Add</Button>
        </div>
        <Button variant="outline" className="w-full" onClick={fromDiary}><ListPlus /> Fill in from my diary (last 14 days)</Button>
        <p className="text-sm text-muted-foreground">Uses only symptom names and dates from your diary.</p>
      </div>
      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save appointment"}</Button>
    </div>
  );
}
