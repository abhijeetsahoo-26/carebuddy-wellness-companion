import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { addVital, deleteVital } from "@/lib/tracking.functions";
import { VITAL_KINDS, vitalSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";
import { formatDateTimeIST, TZ } from "@/lib/time";
import type { Database } from "@/integrations/supabase/types";

type Vital = Database["public"]["Tables"]["vitals"]["Row"];
type Kind = (typeof VITAL_KINDS)[number]["value"];

export const Route = createFileRoute("/vitals")({
  head: () => ({
    meta: [
      { title: "My numbers · CareBuddy" },
      { name: "description", content: "Weight, blood pressure, blood sugar and temperature you enter yourself." },
      { property: "og:title", content: "My numbers · CareBuddy" },
      { property: "og:description", content: "Weight, blood pressure, blood sugar and temperature you enter yourself." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Vitals /></AppShell>,
});

const fmt = (v: Vital) => (v.kind === "blood_pressure" ? `${Number(v.value)}/${Number(v.value2)}` : `${Number(v.value)}`) + ` ${v.unit}`;

function Vitals() {
  const qc = useQueryClient();
  const del = useServerFn(deleteVital);
  const [kind, setKind] = useState<Kind>("weight");
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<"chart" | "table">("chart");
  const q = useQuery({
    queryKey: ["vitals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vitals").select("*").order("measured_at");
      if (error) throw error;
      return data;
    },
  });
  const list = (q.data ?? []).filter((v) => v.kind === kind);
  // Temperatures in both units are charted in the unit used most recently.
  const unit = list.at(-1)?.unit;
  const chartList = list.filter((v) => v.unit === unit);
  const meta = VITAL_KINDS.find((k) => k.value === kind)!;

  async function remove(v: Vital) {
    try { await del({ data: { id: v.id } }); await qc.invalidateQueries({ queryKey: ["vitals"] }); toast.success("Entry deleted"); }
    catch (e) { showError(e); }
  }

  return (
    <>
      <PageTitle title="My numbers" />
      <p className="mt-2 rounded-xl bg-secondary p-3 text-lg">Your doctor decides what these numbers mean.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose what to show">
        {VITAL_KINDS.map((k) => (
          <button key={k.value} type="button" aria-pressed={kind === k.value} onClick={() => setKind(k.value)}
            className="min-h-11 rounded-xl border-2 px-3 aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{k.label}</button>
        ))}
      </div>
      <Button size="lg" className="mt-4 w-full" onClick={() => setAdding(true)}><Plus /> Add {meta.label.toLowerCase()}</Button>

      <div className="mt-6">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !list.length ? <EmptyState title="Nothing entered yet">Add a {meta.label.toLowerCase()} reading when you take one.</EmptyState> : (
            <>
              <div className="flex gap-2">
                <Button variant={view === "chart" ? "default" : "outline"} onClick={() => setView("chart")}>Chart</Button>
                <Button variant={view === "table" ? "default" : "outline"} onClick={() => setView("table")}>Table</Button>
              </div>
              {view === "chart" ? (
                <div className="mt-4 h-64 rounded-2xl border bg-card p-3" role="img" aria-label={`${meta.label} over time, in ${unit}. Switch to Table to read each value.`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartList.map((v) => ({ t: new Date(v.measured_at).toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" }), a: Number(v.value), b: v.value2 === null ? undefined : Number(v.value2) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="t" tick={{ fontSize: 14 }} />
                      <YAxis tick={{ fontSize: 14 }} domain={["auto", "auto"]} unit={` ${unit}`} width={90} />
                      <Tooltip />
                      <Line type="monotone" dataKey="a" name={kind === "blood_pressure" ? "Top number" : meta.label} stroke="var(--foreground)" strokeWidth={2} dot />
                      {kind === "blood_pressure" && <Line type="monotone" dataKey="b" name="Bottom number" stroke="var(--muted-foreground)" strokeWidth={2} strokeDasharray="6 4" dot />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <table className="mt-4 w-full overflow-hidden rounded-2xl border bg-card text-left">
                  <thead><tr className="border-b"><th className="p-3">Date and time</th><th className="p-3">Value</th><th className="p-3">Source</th><th className="p-3"><span className="sr-only">Delete</span></th></tr></thead>
                  <tbody>
                    {[...list].reverse().map((v) => (
                      <tr key={v.id} className="border-b last:border-b-0">
                        <td className="p-3">{formatDateTimeIST(v.measured_at)}</td>
                        <td className="p-3 font-semibold">{fmt(v)}</td>
                        <td className="p-3 text-muted-foreground">entered by you {v.is_demo && <Badge variant="secondary">Sample</Badge>}</td>
                        <td className="p-3"><Button size="icon" variant="ghost" aria-label="Delete entry" onClick={() => remove(v)}><Trash2 /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
      </div>
      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add {meta.label.toLowerCase()}</DialogTitle></DialogHeader>
          {adding && <VitalForm kind={kind} onDone={() => setAdding(false)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function VitalForm({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const qc = useQueryClient();
  const add = useServerFn(addVital);
  const meta = VITAL_KINDS.find((k) => k.value === kind)!;
  const [unit, setUnit] = useState<string>(meta.units[0]);
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [when, setWhen] = useState(new Date(Date.now() + 330 * 60e3).toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);
  async function submit() {
    const r = vitalSchema.safeParse({ kind, unit, value: a === "" ? NaN : Number(a), value2: kind === "blood_pressure" ? (b === "" ? null : Number(b)) : null, measured_at: when ? `${when}:00+05:30` : "" });
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try { await add({ data: r.data }); await qc.invalidateQueries({ queryKey: ["vitals"] }); toast.success("Saved"); onDone(); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      {meta.units.length > 1 && (
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Unit">
          {meta.units.map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} onClick={() => setUnit(u)}
              className="min-h-12 rounded-xl border-2 text-lg aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">{u === "°C" ? "°C (Celsius)" : "°F (Fahrenheit)"}</button>
          ))}
        </div>
      )}
      {kind === "blood_pressure" ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="v-a" className="text-base">Top number (mmHg)</Label><Input id="v-a" type="number" inputMode="numeric" className="h-12 text-base" value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="v-b" className="text-base">Bottom number (mmHg)</Label><Input id="v-b" type="number" inputMode="numeric" className="h-12 text-base" value={b} onChange={(e) => setB(e.target.value)} /></div>
        </div>
      ) : (
        <div className="space-y-1"><Label htmlFor="v-a" className="text-base">{meta.label} ({unit})</Label><Input id="v-a" type="number" inputMode="decimal" step="0.1" className="h-12 text-base" value={a} onChange={(e) => setA(e.target.value)} /></div>
      )}
      <div className="space-y-1"><Label htmlFor="v-when" className="text-base">Date and time (India time)</Label>
        <Input id="v-when" type="datetime-local" className="h-12 text-base" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
      <p className="text-sm text-muted-foreground">Saved as "entered by you".</p>
      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save"}</Button>
    </div>
  );
}
