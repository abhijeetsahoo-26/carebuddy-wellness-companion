import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { saveMedicine, setMedicineArchived } from "@/lib/medicines.functions";
import { FOOD_OPTIONS, FORMS, medicineSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";
import { adherence, istDate, istDayStartUTC, TZ } from "@/lib/time";
import { useDoses } from "@/hooks/useDoses";
import { supplyStatus, daysOfSupply, LOW_SUPPLY_TEXT, OUT_OF_SUPPLY_TEXT } from "@/lib/tracking";
import type { Database } from "@/integrations/supabase/types";

type Med = Database["public"]["Tables"]["medicines"]["Row"];

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicines · CareBuddy" },
      { name: "description", content: "Your medicines and reminders." },
      { property: "og:title", content: "Medicines · CareBuddy" },
      { property: "og:description", content: "Your medicines and reminders." },
    ],
  }),
  component: () => <AppShell><Medicines /></AppShell>,
});

const FOOD_LABEL: Record<string, string> = Object.fromEntries(FOOD_OPTIONS.map((f) => [f.value, f.label]));

function Medicines() {
  const qc = useQueryClient();
  const archive = useServerFn(setMedicineArchived);
  const [editing, setEditing] = useState<Med | "new" | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const q = useQuery({
    queryKey: ["medicines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("medicines").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const active = q.data?.filter((m) => !m.archived_at) ?? [];
  const archived = q.data?.filter((m) => m.archived_at) ?? [];

  async function toggleArchive(m: Med) {
    try {
      await archive({ data: { id: m.id, archived: !m.archived_at } });
      await qc.invalidateQueries();
      toast.success(m.archived_at ? "Medicine restored" : "Medicine archived", {
        action: { label: "Undo", onClick: async () => { await archive({ data: { id: m.id, archived: !!m.archived_at } }); await qc.invalidateQueries(); } },
      });
    } catch (e) { showError(e); }
  }

  return (
    <>
      <PageTitle title="Medicines" sub="From your doctor's plan, as you entered it." />
      <Button size="lg" className="mt-6 w-full" onClick={() => setEditing("new")}><Plus /> Add a medicine</Button>

      <div className="mt-6 space-y-3">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !active.length ? <EmptyState title="No medicines yet">Add the medicines your doctor gave you.</EmptyState> :
          active.map((m) => <MedCard key={m.id} m={m} onEdit={() => setEditing(m)} onArchive={() => toggleArchive(m)} />)}
      </div>

      <WeeklyAdherence />

      {archived.length > 0 && (
        <div className="mt-8">
          <Button variant="ghost" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </Button>
          {showArchived && <div className="mt-3 space-y-3">{archived.map((m) => <MedCard key={m.id} m={m} onEdit={() => setEditing(m)} onArchive={() => toggleArchive(m)} />)}</div>}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "Add a medicine" : "Edit medicine"}</DialogTitle></DialogHeader>
          {editing !== null && <MedForm med={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function MedCard({ m, onEdit, onArchive }: { m: Med; onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary">From your doctor's plan</p>
          <h2 className="text-xl font-semibold">{m.name} {m.is_demo && <Badge variant="secondary">Sample</Badge>} {m.archived_at && <Badge variant="outline">Archived</Badge>}</h2>
          {m.generic_name && <p className="text-muted-foreground">{m.generic_name}</p>}
        </div>
        <Button size="icon" variant="ghost" aria-label={`Edit ${m.name}`} onClick={onEdit}><Pencil /></Button>
        <Button size="icon" variant="ghost" aria-label={m.archived_at ? `Restore ${m.name}` : `Archive ${m.name}`} onClick={onArchive}>
          {m.archived_at ? <ArchiveRestore /> : <Archive />}
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          ["Amount", [m.dose_amount, m.strength, m.form].filter(Boolean).join(" · ")],
          ["Times", m.times.join(", ")],
          ["Food", FOOD_LABEL[m.food]],
          ["Dates", `${m.start_date}${m.end_date ? ` to ${m.end_date}` : " onwards"}`],
          ["Prescribed by", m.prescribed_by],
        ].filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="col-span-2 sm:col-span-1"><dt className="text-sm text-muted-foreground">{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
      {m.notes && <p className="mt-2 text-muted-foreground">{m.notes}</p>}
      <SupplyLine m={m} />
    </div>
  );
}

function SupplyLine({ m }: { m: Med }) {
  if (m.tablets_remaining === null) return null;
  const st = supplyStatus(Number(m.tablets_remaining), Number(m.tablets_per_dose), m.times.length);
  const days = daysOfSupply(Number(m.tablets_remaining), Number(m.tablets_per_dose), m.times.length);
  return (
    <div className={`mt-3 rounded-xl p-3 ${st === "out" || st === "low" ? "border-2 border-primary bg-secondary" : "bg-secondary/50"}`} role={st === "out" ? "alert" : undefined}>
      <p className="font-semibold">{Number(m.tablets_remaining)} left{days !== null && st !== "out" ? ` · about ${days} day${days === 1 ? "" : "s"}` : ""}</p>
      {st === "low" && <p>{LOW_SUPPLY_TEXT}</p>}
      {st === "out" && <p>{OUT_OF_SUPPLY_TEXT}</p>}
    </div>
  );
}

type FormState = { tablets_remaining: string; tablets_per_dose: string; missed_dose_instruction: string; name: string; generic_name: string; strength: string; form: string; dose_amount: string; times: string[]; food: "with" | "without" | "any"; start_date: string; end_date: string; prescribed_by: string; notes: string };

function MedForm({ med, onDone }: { med: Med | null; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveMedicine);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<FormState>({
    tablets_remaining: med?.tablets_remaining?.toString() ?? "", tablets_per_dose: med?.tablets_per_dose?.toString() ?? "1",
    missed_dose_instruction: med?.missed_dose_instruction ?? "",
    name: med?.name ?? "", generic_name: med?.generic_name ?? "", strength: med?.strength ?? "", form: med?.form ?? "",
    dose_amount: med?.dose_amount ?? "", times: med?.times ?? ["08:00"], food: (med?.food as FormState["food"]) ?? "any",
    start_date: med?.start_date ?? istDate(), end_date: med?.end_date ?? "", prescribed_by: med?.prescribed_by ?? "", notes: med?.notes ?? "",
  });
  const set = (k: keyof FormState, v: FormState[keyof FormState]) => setF({ ...f, [k]: v });

  async function submit() {
    const r = medicineSchema.safeParse({ ...f, times: [...f.times].sort(), end_date: f.end_date || null });
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try {
      await save({ data: { id: med?.id, medicine: r.data } });
      await qc.invalidateQueries();
      toast.success("Medicine saved");
      onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  const text = (k: keyof FormState, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={`m-${k}`} className="text-base">{label}</Label>
      <Input id={`m-${k}`} type={type} className="h-12 text-base" value={f[k] as string} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Copy these exactly from your doctor's prescription. CareBuddy does not suggest medicines or doses.</p>
      {text("name", "Medicine name")}
      {text("generic_name", "Generic name (optional)")}
      <div className="grid grid-cols-2 gap-3">{text("strength", "Strength")}{text("dose_amount", "Amount each time")}</div>
      <div className="space-y-2">
        <Label className="text-base">Form</Label>
        <div className="flex flex-wrap gap-2">
          {FORMS.map((x) => (
            <button key={x} type="button" aria-pressed={f.form === x} onClick={() => set("form", x)}
              className="min-h-11 rounded-xl border-2 px-3 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{x}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-base">Times each day (India time)</Label>
        {f.times.map((t, i) => (
          <div key={i} className="flex gap-2">
            <Input type="time" aria-label={`Time ${i + 1}`} className="h-12 text-base" value={t}
              onChange={(e) => set("times", f.times.map((x, j) => (j === i ? e.target.value : x)))} />
            {f.times.length > 1 && <Button size="icon" variant="ghost" aria-label="Remove time" onClick={() => set("times", f.times.filter((_, j) => j !== i))}><X /></Button>}
          </div>
        ))}
        {f.times.length < 8 && <Button variant="outline" onClick={() => set("times", [...f.times, "12:00"])}><Plus /> Add a time</Button>}
      </div>
      <div className="space-y-2">
        <Label className="text-base">Food</Label>
        <div className="grid grid-cols-3 gap-2">
          {FOOD_OPTIONS.map((o) => (
            <button key={o.value} type="button" aria-pressed={f.food === o.value} onClick={() => set("food", o.value)}
              className="min-h-11 rounded-xl border-2 px-2 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{o.label}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">{text("start_date", "Start date", "date")}{text("end_date", "End date (optional)", "date")}</div>
      {text("prescribed_by", "Prescribed by")}
      <div className="grid grid-cols-2 gap-3">{text("tablets_remaining", "Tablets remaining (optional)", "number")}{text("tablets_per_dose", "Tablets per dose", "number")}</div>
      <p className="text-sm text-muted-foreground">If you enter how many are left, CareBuddy counts down when you mark a dose Taken and reminds you to check your supply.</p>
      <div className="space-y-2">
        <Label htmlFor="m-missed" className="text-base">My doctor's instruction for a missed dose (optional)</Label>
        <Textarea id="m-missed" className="text-base" value={f.missed_dose_instruction} onChange={(e) => set("missed_dose_instruction", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="m-notes" className="text-base">Notes</Label>
        <Textarea id="m-notes" className="text-base" value={f.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save medicine"}</Button>
    </div>
  );
}

function WeeklyAdherence() {
  const q = useDoses(6);
  if (q.isLoading || q.error || !q.data?.length) return null;
  const today = istDate();
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(istDayStartUTC(today).getTime() - (6 - i) * 86400e3);
    const end = new Date(start.getTime() + 86400e3);
    const ds = q.data.filter((d) => new Date(d.scheduled_at) >= start && new Date(d.scheduled_at) < end);
    return { day: start.toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short" }), pct: adherence(ds) ?? 0 };
  });
  const week = adherence(q.data);
  return (
    <section className="mt-8 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-semibold">This week</h2>
      <p className="mt-1 text-lg">{week === null ? "No doses due yet." : `${week}% of doses marked taken (calculated).`}</p>
      <div className="mt-4 h-40" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days}>
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} hide />
            <Bar dataKey="pct" radius={[6, 6, 0, 0]} fill="var(--color-primary)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only">{days.map((d) => <li key={d.day}>{d.day}: {d.pct}%</li>)}</ul>
    </section>
  );
}
