import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, History, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { saveDoctorPlan } from "@/lib/plan.functions";
import { planSchema, firstIssue, LIMIT_METRICS, ATTACHMENT_TYPES, ATTACHMENT_MAX_BYTES } from "@/lib/validation";
import { showError } from "@/lib/errors";
import { formatDateTimeIST, istDate } from "@/lib/time";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
type Version = T["doctor_plan_versions"]["Row"];
type FullPlan = { version: Version; medicines: T["doctor_plan_medicines"]["Row"][]; diet: T["doctor_plan_diet"]["Row"] | null; limits: T["doctor_plan_limits"]["Row"][] };

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Doctor's Plan · CareBuddy" },
      { name: "description", content: "Enter exactly what your doctor or pharmacist told you." },
      { property: "og:title", content: "Doctor's Plan · CareBuddy" },
      { property: "og:description", content: "Enter exactly what your doctor or pharmacist told you." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Plan /></AppShell>,
});

async function loadPlan(versionId?: string): Promise<FullPlan | null> {
  let q = supabase.from("doctor_plan_versions").select("*");
  q = versionId ? q.eq("id", versionId) : q.order("version_no", { ascending: false }).limit(1);
  const { data: vs, error } = await q;
  if (error) throw error;
  const version = vs?.[0];
  if (!version) return null;
  const [m, d, l] = await Promise.all([
    supabase.from("doctor_plan_medicines").select("*").eq("version_id", version.id).order("position"),
    supabase.from("doctor_plan_diet").select("*").eq("version_id", version.id).maybeSingle(),
    supabase.from("doctor_plan_limits").select("*").eq("version_id", version.id),
  ]);
  const err = m.error ?? d.error ?? l.error;
  if (err) throw err;
  return { version, medicines: m.data ?? [], diet: d.data, limits: l.data ?? [] };
}

function Plan() {
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["plan", "latest"], queryFn: () => loadPlan() });
  const versions = useQuery({
    queryKey: ["plan", "versions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_plan_versions").select("id, version_no, created_at, is_demo").order("version_no", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <>
      <PageTitle title="Doctor's Plan" sub="Enter exactly what your doctor or pharmacist told you." />
      <p className="mt-2 text-muted-foreground">CareBuddy only shows what you write here. It does not suggest medicines, doses or diets.</p>

      <div className="mt-6">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data ? (
            <>
              <EmptyState title="No plan yet">Add what your doctor or pharmacist told you.</EmptyState>
              <Button size="lg" className="mt-4 w-full" onClick={() => setEditing(true)}><Plus /> Add my plan</Button>
            </>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={() => setEditing(true)}><Pencil /> Update my plan</Button>
              <div className="mt-4"><PlanView plan={q.data} /></div>
            </>
          )}
      </div>

      {(versions.data?.length ?? 0) > 0 && (
        <section className="mt-8" aria-labelledby="vh">
          <h2 id="vh" className="flex items-center gap-2 text-xl font-semibold"><History className="size-5" /> Version history</h2>
          <p className="text-muted-foreground">Each save is kept. Older versions are read-only.</p>
          <ul className="mt-3 space-y-2">
            {versions.data!.map((v, i) => (
              <li key={v.id}>
                <button onClick={() => setViewing(v.id)} className="flex min-h-12 w-full items-center justify-between rounded-xl border bg-card px-4 text-left">
                  <span>Version {v.version_no} · {formatDateTimeIST(v.created_at)}</span>
                  <span className="flex gap-1">{i === 0 && <Badge>Current</Badge>}{v.is_demo && <Badge variant="secondary">Sample</Badge>}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{q.data ? "Update my plan" : "Add my plan"}</DialogTitle></DialogHeader>
          {editing && <PlanForm current={q.data ?? null} onDone={() => setEditing(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Older version (read-only)</DialogTitle></DialogHeader>
          {viewing && <OldVersion id={viewing} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function OldVersion({ id }: { id: string }) {
  const q = useQuery({ queryKey: ["plan", "version", id], queryFn: () => loadPlan(id) });
  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <p>This version could not be found.</p>;
  return <PlanView plan={q.data} />;
}

const METRIC = Object.fromEntries(LIMIT_METRICS.map((m) => [m.value, m]));

function PlanView({ plan }: { plan: FullPlan }) {
  const { version: v, medicines, diet, limits } = plan;
  async function openFile() {
    if (!v.attachment_path) return;
    const { data, error } = await supabase.storage.from("prescriptions").createSignedUrl(v.attachment_path, 300);
    if (error || !data) return showError("Could not open the file.");
    window.open(data.signedUrl, "_blank", "noopener");
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Version {v.version_no}, saved {formatDateTimeIST(v.created_at)} {v.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Medicines for symptoms, as my doctor advised</h3>
        {!medicines.length ? <p className="mt-2 text-muted-foreground">None added.</p> : (
          <ul className="mt-3 space-y-3">
            {medicines.map((m) => (
              <li key={m.id} className="rounded-xl bg-secondary/50 p-3">
                <p className="font-semibold">{m.name}</p>
                <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-base">
                  {[["Dose", m.dose], ["How often", m.interval_text], ["Most per day", m.max_per_day], ["Doctor", m.doctor_name], ["Date advised", m.date_advised]]
                    .filter(([, x]) => x).map(([k, x]) => <div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd>{x}</dd></div>)}
                </dl>
                <p className="mt-1 text-sm">{m.confirmed ? `Confirmed with my doctor on ${m.confirmed_on}` : "Not yet confirmed with my doctor"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-5">
        <h3 className="text-lg font-semibold">Food and instructions</h3>
        {[["Diet rules", diet?.diet_rules], ["Foods to avoid", diet?.foods_to_avoid], ["Special instructions", diet?.special_instructions]].map(([k, x]) => (
          <div key={k} className="mt-2"><p className="text-sm text-muted-foreground">{k}</p><p className="whitespace-pre-wrap">{x || "—"}</p></div>
        ))}
      </section>
      {limits.length > 0 && (
        <section className="rounded-2xl border bg-card p-5">
          <h3 className="text-lg font-semibold">Limits my doctor gave me</h3>
          <ul className="mt-2 space-y-2">
            {limits.map((l) => (
              <li key={l.id}>
                <span className="font-semibold">{METRIC[l.metric]?.label}:</span>{" "}
                {l.min_value != null && `lowest ${l.min_value}`}{l.min_value != null && l.max_value != null && ", "}{l.max_value != null && `highest ${l.max_value}`} {METRIC[l.metric]?.unit}
                <span className="block text-sm text-muted-foreground">Set by {l.set_by}{l.set_on && ` on ${l.set_on}`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {v.attachment_path && (
        <Button variant="outline" onClick={openFile}><FileText /> Open my prescription ({v.attachment_name})</Button>
      )}
    </div>
  );
}

type MedF = { name: string; dose: string; interval_text: string; max_per_day: string; doctor_name: string; date_advised: string; confirmed: boolean; confirmed_on: string };
type LimF = { metric: "heart_rate" | "temperature" | "oxygen"; min_value: string; max_value: string; set_by: string; set_on: string };
const blankMed = (): MedF => ({ name: "", dose: "", interval_text: "", max_per_day: "", doctor_name: "", date_advised: "", confirmed: false, confirmed_on: "" });

function PlanForm({ current, onDone }: { current: FullPlan | null; onDone: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(saveDoctorPlan);
  const [busy, setBusy] = useState(false);
  const [meds, setMeds] = useState<MedF[]>(current?.medicines.map((m) => ({
    name: m.name, dose: m.dose ?? "", interval_text: m.interval_text ?? "", max_per_day: m.max_per_day ?? "", doctor_name: m.doctor_name ?? "",
    date_advised: m.date_advised ?? "", confirmed: m.confirmed, confirmed_on: m.confirmed_on ?? "",
  })) ?? []);
  const [diet, setDiet] = useState({
    diet_rules: current?.diet?.diet_rules ?? "", foods_to_avoid: current?.diet?.foods_to_avoid ?? "", special_instructions: current?.diet?.special_instructions ?? "",
  });
  const [limits, setLimits] = useState<LimF[]>(current?.limits.map((l) => ({
    metric: l.metric as LimF["metric"], min_value: l.min_value?.toString() ?? "", max_value: l.max_value?.toString() ?? "", set_by: l.set_by ?? "", set_on: l.set_on ?? "",
  })) ?? []);
  const [file, setFile] = useState<File | null>(null);
  const [keepFile, setKeepFile] = useState(!!current?.version.attachment_path);

  const setMed = (i: number, k: keyof MedF, v: string | boolean) => setMeds(meds.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const setLim = (i: number, k: keyof LimF, v: string) => setLimits(limits.map((l, j) => (j === i ? { ...l, [k]: v } : l)));

  async function submit() {
    if (file && (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type) || file.size > ATTACHMENT_MAX_BYTES))
      return void toast.error("Please choose a PDF or photo under 10 MB");
    let attachment = keepFile && current ? { attachment_path: current.version.attachment_path, attachment_name: current.version.attachment_name, attachment_type: current.version.attachment_type } : { attachment_path: null, attachment_name: null, attachment_type: null };
    const draft = { medicines: meds, diet, limits, ...attachment, ...(file ? { attachment_path: null } : {}) };
    const r = planSchema.safeParse({ ...draft, attachment_type: file ? null : attachment.attachment_type });
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try {
      if (file) {
        const { data: u } = await supabase.auth.getUser();
        const path = `${u.user!.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_").slice(-80)}`;
        const { error } = await supabase.storage.from("prescriptions").upload(path, file, { contentType: file.type });
        if (error) throw new Error("Could not upload the file. Please try again.");
        attachment = { attachment_path: path, attachment_name: file.name.slice(0, 200), attachment_type: file.type };
      }
      await save({ data: { ...r.data, ...attachment } as never });
      await qc.invalidateQueries();
      toast.success("Plan saved as a new version");
      onDone();
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  const field = (id: string, label: string, value: string, on: (v: string) => void, type = "text") => (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-base">{label}</Label>
      <Input id={id} type={type} className="h-12 text-base" value={value} onChange={(e) => on(e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-secondary p-3">Enter exactly what your doctor or pharmacist told you.</p>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Doctor-approved medicines for symptoms</h3>
        {meds.map((m, i) => (
          <div key={i} className="space-y-3 rounded-xl border p-3">
            <div className="flex items-center justify-between"><p className="font-semibold">Medicine {i + 1}</p>
              <Button size="icon" variant="ghost" aria-label={`Remove medicine ${i + 1}`} onClick={() => setMeds(meds.filter((_, j) => j !== i))}><Trash2 /></Button></div>
            {field(`pm-name-${i}`, "Name", m.name, (v) => setMed(i, "name", v))}
            <div className="grid grid-cols-2 gap-3">{field(`pm-dose-${i}`, "Dose", m.dose, (v) => setMed(i, "dose", v))}{field(`pm-int-${i}`, "How often", m.interval_text, (v) => setMed(i, "interval_text", v))}</div>
            <div className="grid grid-cols-2 gap-3">{field(`pm-max-${i}`, "Most per day", m.max_per_day, (v) => setMed(i, "max_per_day", v))}{field(`pm-doc-${i}`, "Doctor name", m.doctor_name, (v) => setMed(i, "doctor_name", v))}</div>
            {field(`pm-date-${i}`, "Date advised", m.date_advised, (v) => setMed(i, "date_advised", v), "date")}
            <div className="flex min-h-11 items-center gap-3">
              <Checkbox id={`pm-conf-${i}`} className="size-6" checked={m.confirmed} onCheckedChange={(c) => setMeds(meds.map((x, j) => (j === i ? { ...x, confirmed: c === true, confirmed_on: c === true ? x.confirmed_on || istDate() : "" } : x)))} />
              <Label htmlFor={`pm-conf-${i}`} className="text-base">Confirmed with my doctor</Label>
            </div>
            {m.confirmed && field(`pm-cdate-${i}`, "Date confirmed", m.confirmed_on, (v) => setMed(i, "confirmed_on", v), "date")}
          </div>
        ))}
        <Button variant="outline" onClick={() => setMeds([...meds, blankMed()])}><Plus /> Add a medicine</Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Food and instructions</h3>
        {([["diet_rules", "Diet rules"], ["foods_to_avoid", "Foods to avoid"], ["special_instructions", "Special instructions"]] as const).map(([k, label]) => (
          <div key={k} className="space-y-1">
            <Label htmlFor={`pd-${k}`} className="text-base">{label}</Label>
            <Textarea id={`pd-${k}`} className="text-base" value={diet[k]} onChange={(e) => setDiet({ ...diet, [k]: e.target.value })} />
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Limits my doctor gave me (optional)</h3>
        {limits.map((l, i) => {
          const meta = METRIC[l.metric]!;
          return (
            <div key={l.metric} className="space-y-3 rounded-xl border p-3">
              <div className="flex items-center justify-between"><p className="font-semibold">{meta.label} ({meta.unit})</p>
                <Button size="icon" variant="ghost" aria-label={`Remove ${meta.label} limit`} onClick={() => setLimits(limits.filter((_, j) => j !== i))}><Trash2 /></Button></div>
              <div className="grid grid-cols-2 gap-3">{field(`pl-min-${i}`, "Lowest", l.min_value, (v) => setLim(i, "min_value", v), "number")}{field(`pl-max-${i}`, "Highest", l.max_value, (v) => setLim(i, "max_value", v), "number")}</div>
              <div className="grid grid-cols-2 gap-3">{field(`pl-by-${i}`, "Set by", l.set_by, (v) => setLim(i, "set_by", v))}{field(`pl-on-${i}`, "Date set", l.set_on, (v) => setLim(i, "set_on", v), "date")}</div>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {LIMIT_METRICS.filter((m) => !limits.some((l) => l.metric === m.value)).map((m) => (
            <Button key={m.value} variant="outline" onClick={() => setLimits([...limits, { metric: m.value, min_value: "", max_value: "", set_by: "", set_on: "" }])}><Plus /> {m.label}</Button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Prescription photo or PDF (optional)</h3>
        <p className="text-sm text-muted-foreground">Kept only for you to look at. CareBuddy does not read or check it.</p>
        {current?.version.attachment_path && keepFile && !file && (
          <div className="flex items-center gap-2"><FileText className="size-5" /><span className="flex-1">{current.version.attachment_name}</span>
            <Button variant="ghost" onClick={() => setKeepFile(false)}>Remove</Button></div>
        )}
        <Label htmlFor="pf" className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed text-base">
          <Upload className="size-5" /> {file ? file.name : "Choose a file"}
        </Label>
        <input id="pf" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </section>

      <Button size="lg" className="w-full" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save as new version"}</Button>
    </div>
  );
}
