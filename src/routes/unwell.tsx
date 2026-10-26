import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Check, Phone, Stethoscope, Leaf, FileText, BookOpen, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AppShell, PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { useDirectory } from "@/hooks/useDirectory";
import { saveUnwellCheck } from "@/lib/diary.functions";
import { decide, DURATIONS, GI_FREQUENCY, SYMPTOMS, type UnwellAnswers, type UnwellResult } from "@/lib/unwell";
import { telHref } from "@/lib/directory";
import { showError } from "@/lib/errors";

export const Route = createFileRoute("/unwell")({
  head: () => ({
    meta: [
      { title: "I feel unwell · CareBuddy" },
      { name: "description", content: "A few simple questions to help you find the right help." },
      { property: "og:title", content: "I feel unwell · CareBuddy" },
      { property: "og:description", content: "A few simple questions to help you find the right help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Unwell /></AppShell>,
});

type Draft = Partial<UnwellAnswers> & { symptoms: string[]; other: string; tempText: string };
const TOTAL = 13;

function Unwell() {
  const save = useServerFn(saveUnwellCheck);
  const [step, setStep] = useState(0);
  const [d, setD] = useState<Draft>({ symptoms: [], other: "", tempText: "" });
  const [result, setResult] = useState<{ result: UnwellResult; reasons: string[]; answers: UnwellAnswers } | null>(null);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const next = () => setStep((s) => s + 1);
  const yesNo = (k: keyof UnwellAnswers) => (v: boolean) => { set({ [k]: v } as Partial<Draft>); next(); };

  async function finish(final: Draft) {
    const t = final.tempText ? Number(final.tempText) : null;
    const answers: UnwellAnswers = {
      symptoms: final.symptoms, other: final.other.trim(), duration: final.duration!, fever: !!final.fever,
      temperature_f: final.fever && t !== null && Number.isFinite(t) ? t : null, breathing: !!final.breathing,
      chest_pain: !!final.chest_pain, gi: final.gi ?? "none", fluids_ok: final.fluids_ok ?? true, pain: final.pain ?? 0,
      confusion: !!final.confusion, worsening: !!final.worsening, allergic: !!final.allergic, self_harm: !!final.self_harm,
    };
    // Show the result straight away; saving to the diary must never delay help.
    setResult({ ...decide(answers), answers });
    window.scrollTo(0, 0);
    try { await save({ data: answers }); toast.success("Saved to your symptom diary"); }
    catch (e) { showError(e); }
  }

  if (result) return <Result r={result.result} reasons={result.reasons} answers={result.answers} />;

  const q = (title: string, body: React.ReactNode) => (
    <>
      <p className="text-muted-foreground">Question {step + 1} of {TOTAL}</p>
      <div className="mt-1 h-2 rounded-full bg-secondary"><div className="h-2 rounded-full bg-primary" style={{ width: `${((step + 1) / TOTAL) * 100}%` }} /></div>
      <h2 className="mt-6 text-2xl font-semibold">{title}</h2>
      <div className="mt-6">{body}</div>
      {step > 0 && <Button variant="ghost" size="lg" className="mt-6" onClick={() => setStep(step - 1)}><ArrowLeft /> Back</Button>}
    </>
  );
  const YN = ({ k, value }: { k: keyof UnwellAnswers; value?: boolean }) => (
    <div className="grid gap-3">
      <Big pressed={value === true} onClick={() => yesNo(k)(true)}>Yes</Big>
      <Big pressed={value === false} onClick={() => yesNo(k)(false)}>No</Big>
    </div>
  );

  const steps: (() => React.ReactNode)[] = [
    () => q("What are your main symptoms?", (
      <>
        <p className="mb-3 text-muted-foreground">Choose all that apply.</p>
        <div className="grid gap-2">
          {SYMPTOMS.map((s) => {
            const on = d.symptoms.includes(s.value);
            return (
              <button key={s.value} type="button" aria-pressed={on} onClick={() => set({ symptoms: on ? d.symptoms.filter((x) => x !== s.value) : [...d.symptoms, s.value] })}
                className="flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 text-left text-lg aria-pressed:border-primary aria-pressed:bg-secondary aria-pressed:font-semibold">
                <span className="flex size-6 shrink-0 items-center justify-center rounded border-2">{on && <Check className="size-4" />}</span>{s.label}
              </button>
            );
          })}
        </div>
        <Label htmlFor="u-other" className="mt-4 block text-base">Anything else? (optional)</Label>
        <Textarea id="u-other" className="mt-1 text-base" maxLength={300} value={d.other} onChange={(e) => set({ other: e.target.value })} />
        <Button size="lg" className="mt-4 w-full" disabled={!d.symptoms.length && !d.other.trim()} onClick={next}>Next</Button>
      </>
    )),
    () => q("How long have you felt this way?", (
      <div className="grid gap-3">{DURATIONS.map((o) => <Big key={o.value} pressed={d.duration === o.value} onClick={() => { set({ duration: o.value }); next(); }}>{o.label}</Big>)}</div>
    )),
    () => q("Do you have a fever?", (
      <div className="grid gap-3">
        <Big pressed={d.fever === true} onClick={() => set({ fever: true })}>Yes</Big>
        {d.fever && (
          <div className="rounded-xl border p-4">
            <Label htmlFor="u-temp" className="text-base">Temperature in °F, if you know it (optional)</Label>
            <Input id="u-temp" type="number" inputMode="decimal" step="0.1" min={90} max={110} className="mt-1 h-12 text-base" value={d.tempText} onChange={(e) => set({ tempText: e.target.value })} />
            <Button size="lg" className="mt-3 w-full" disabled={!!d.tempText && !(Number(d.tempText) >= 90 && Number(d.tempText) <= 110)} onClick={next}>Next</Button>
          </div>
        )}
        <Big pressed={d.fever === false} onClick={() => { set({ fever: false, tempText: "" }); next(); }}>No</Big>
      </div>
    )),
    () => q("Do you have trouble breathing?", <YN k="breathing" value={d.breathing} />),
    () => q("Do you have chest pain or pressure?", <YN k="chest_pain" value={d.chest_pain} />),
    () => q("Are you vomiting or having diarrhoea?", (
      <div className="grid gap-3">{GI_FREQUENCY.map((o) => <Big key={o.value} pressed={d.gi === o.value} onClick={() => { set({ gi: o.value }); next(); }}>{o.label}</Big>)}</div>
    )),
    () => q("Can you drink fluids and keep them down?", <YN k="fluids_ok" value={d.fluids_ok} />),
    () => q("How bad is your pain right now?", (
      <>
        <p className="mb-3 text-muted-foreground">0 means no pain. 10 means the worst pain you can imagine.</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {Array.from({ length: 11 }, (_, n) => (
            <Big key={n} pressed={d.pain === n} onClick={() => { set({ pain: n }); next(); }}>{n}</Big>
          ))}
        </div>
      </>
    )),
    () => q("Have you had confusion, fainting or a seizure (fit)?", <YN k="confusion" value={d.confusion} />),
    () => q("Are you getting worse quickly?", <YN k="worsening" value={d.worsening} />),
    () => q("Any signs of an allergic reaction?", (
      <><p className="mb-3 text-lg">For example: swelling of the face or throat, or hives with trouble breathing.</p><YN k="allergic" value={d.allergic} /></>
    )),
    () => q("Are you having thoughts of harming yourself?", (
      <div className="grid gap-3">
        <Big pressed={d.self_harm === true} onClick={() => { const f = { ...d, self_harm: true }; setD(f); void finish(f); }}>Yes</Big>
        <Big pressed={d.self_harm === false} onClick={() => yesNo("self_harm")(false)}>No</Big>
      </div>
    )),
    () => q("Your medicines and allergies", (
      <>
        <Reminder />
        <Button size="lg" className="mt-6 w-full" onClick={() => void finish(d)}>See what to do</Button>
      </>
    )),
  ];

  return (
    <>
      <PageTitle title="I feel unwell" sub="One question at a time. If it feels serious, tap Emergency now." />
      <div className="mt-6">{steps[step]!()}</div>
    </>
  );
}

function Big({ pressed, onClick, children }: { pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={!!pressed} onClick={onClick}
      className="min-h-16 rounded-2xl border-2 bg-card px-4 text-xl font-semibold aria-pressed:border-primary aria-pressed:bg-secondary">{children}</button>
  );
}

function Reminder() {
  const { data } = useAccount();
  const meds = useQuery({
    queryKey: ["medicines", "active-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("medicines").select("id, name, dose_amount, strength").is("archived_at", null).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">A reminder from what you saved. Read-only.</p>
      <div>
        <h3 className="text-lg font-semibold">Medicines you take</h3>
        {meds.isLoading ? <p>Loading…</p> : !meds.data?.length ? <p className="text-muted-foreground">None saved.</p> :
          <ul className="mt-1 list-disc pl-6">{meds.data.map((m) => <li key={m.id}>{m.name}{m.dose_amount ? ` · ${m.dose_amount}` : ""}{m.strength ? ` · ${m.strength}` : ""}</li>)}</ul>}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Allergies</h3>
        <p className="whitespace-pre-wrap">{data?.profile?.allergies || "None saved."}</p>
      </div>
    </div>
  );
}

const NOT_A_DOCTOR = "I'm not a doctor. Please follow your doctor's advice.";

function Result({ r, reasons, answers }: { r: UnwellResult; reasons: string[]; answers: UnwellAnswers }) {
  const { data } = useAccount();
  const docPhone = data?.profile?.doctor_phone;
  const docName = data?.profile?.doctor_name;
  const callDoctor = docPhone ? (
    <Button asChild size="lg" variant={r === "emergency" ? "outline" : "default"} className="w-full"><a href={telHref(docPhone)}><Phone /> Call my doctor{docName ? ` (${docName})` : ""}</a></Button>
  ) : null;

  return (
    <>
      {r === "emergency" && <EmergencyResult reasons={reasons} selfHarm={answers.self_harm} callDoctor={callDoctor} />}
      {r === "doctor_soon" && (
        <section className="rounded-2xl border-2 border-primary bg-card p-5" aria-labelledby="res">
          <Stethoscope className="size-10 text-primary" aria-hidden />
          <h1 id="res" className="mt-2 text-3xl font-bold">See a doctor soon</h1>
          <p className="mt-2 text-lg">Please contact your doctor today or as soon as you can.</p>
          <Reasons reasons={reasons} />
          <div className="mt-5 grid gap-3">
            {callDoctor ?? <p className="text-muted-foreground">No doctor phone saved. You can add it under More.</p>}
            <Button size="lg" variant="outline" className="w-full" onClick={() => toast.info("The summary for your doctor (PDF) is coming in a later update.")}><FileText /> Prepare summary for doctor</Button>
          </div>
          <p className="mt-4 text-muted-foreground">If you start to feel worse, tap Emergency.</p>
        </section>
      )}
      {r === "self_care" && <SelfCare />}
      <p className="mt-6 text-lg font-semibold">{NOT_A_DOCTOR}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="outline"><Link to="/diary"><BookOpen /> Open my symptom diary</Link></Button>
        <Button asChild variant="ghost"><Link to="/">Back to Today</Link></Button>
      </div>
    </>
  );
}

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return <><p className="mt-3 font-semibold">Because you said:</p><ul className="list-disc pl-6 text-lg">{reasons.map((x) => <li key={x}>{x}</li>)}</ul></>;
}

function EmergencyResult({ reasons, selfHarm, callDoctor }: { reasons: string[]; selfHarm: boolean; callDoctor: React.ReactNode }) {
  const { list } = useDirectory();
  const n = (k: string, f: string) => list.find((d) => d.key === k)?.number ?? f;
  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("emergency_contacts").select("id, name, phone, relationship").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const contact = contacts.data?.[0];
  return (
    <section role="alert" aria-labelledby="res" className="-mx-5 min-h-[70vh] rounded-none bg-emergency px-5 py-8 text-emergency-foreground sm:mx-0 sm:rounded-2xl">
      <AlertTriangle className="size-14" aria-hidden />
      <h1 id="res" className="mt-2 text-4xl font-bold">Emergency: get help now</h1>
      <p className="mt-3 text-xl">This cannot detect a heart attack or diagnose anything. If you have chest pain, pressure, trouble breathing or feel very unwell, call 112 now.</p>
      {reasons.length > 0 && <><p className="mt-4 font-semibold">Because you said:</p><ul className="list-disc pl-6 text-lg">{reasons.map((x) => <li key={x}>{x}</li>)}</ul></>}
      <div className="mt-6 grid gap-3">
        <Button asChild variant="secondary" className="h-24 w-full text-3xl font-bold">
          <a href={telHref(n("emergency", "112"))} aria-label="Call 112, police, fire, ambulance"><Phone className="size-9" /> Call {n("emergency", "112")} · Police, fire, ambulance</a>
        </Button>
        <Button asChild variant="secondary" size="lg" className="h-16 w-full text-xl">
          <a href={telHref(n("ambulance_108", "108"))} aria-label="Call 108, ambulance"><Phone /> Call {n("ambulance_108", "108")} · Ambulance</a>
        </Button>
        {selfHarm && (
          <Button asChild variant="secondary" size="lg" className="h-16 w-full text-xl">
            <a href={telHref(n("mental_health", "14416"))} aria-label="Call 14416, mental health support"><HeartHandshake /> Call {n("mental_health", "14416")} · Mental health support</a>
          </Button>
        )}
        {callDoctor}
        {contact && (
          <Button asChild variant="outline" size="lg" className="w-full text-foreground"><a href={telHref(contact.phone)}><Phone /> Call {contact.name}{contact.relationship ? ` (${contact.relationship})` : ""}</a></Button>
        )}
        <Button asChild variant="outline" size="lg" className="w-full text-foreground"><Link to="/emergency">All emergency numbers</Link></Button>
      </div>
      {selfHarm && <p className="mt-4 text-lg">You are not alone. Please talk to someone now — a helpline, a family member or a friend.</p>}
      <p className="mt-4">CareBuddy does not call anyone for you. Only you can place these calls.</p>
    </section>
  );
}

function SelfCare() {
  const plan = useQuery({
    queryKey: ["plan", "latest-meds"],
    queryFn: async () => {
      const { data: v, error } = await supabase.from("doctor_plan_versions").select("id").order("version_no", { ascending: false }).limit(1);
      if (error) throw error;
      if (!v[0]) return [];
      const { data, error: e2 } = await supabase.from("doctor_plan_medicines").select("*").eq("version_id", v[0].id).order("position");
      if (e2) throw e2;
      return data;
    },
  });
  return (
    <section className="rounded-2xl border bg-card p-5" aria-labelledby="res">
      <Leaf className="size-10 text-primary" aria-hidden />
      <h1 id="res" className="mt-2 text-3xl font-bold">Self-care at home</h1>
      <ul className="mt-3 list-disc space-y-1 pl-6 text-lg">
        <li>Rest as much as you can.</li>
        <li>Drink water and other fluids often, in small sips.</li>
        <li>Eat light, easy-to-digest food, such as khichdi, curd rice, toast or soup.</li>
        <li>Check how you feel again later today.</li>
        <li>If you feel worse, or new symptoms start, contact your doctor or tap Emergency.</li>
      </ul>
      <h2 className="mt-6 text-xl font-semibold">From your doctor's plan</h2>
      {plan.isLoading ? <p>Loading…</p> : !plan.data?.length ? (
        <p className="mt-1 text-lg">No doctor-approved medicines saved. Please contact your doctor or pharmacist.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Exactly as you saved them in your Doctor's Plan.</p>
          <ul className="mt-2 space-y-3">
            {plan.data.map((m) => (
              <li key={m.id} className="rounded-xl bg-secondary/50 p-3">
                <p className="font-semibold">{m.name}</p>
                <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                  {[["Dose", m.dose], ["How often", m.interval_text], ["Most per day", m.max_per_day], ["Doctor", m.doctor_name], ["Date advised", m.date_advised]]
                    .map(([k, x]) => <div key={k}><dt className="text-sm text-muted-foreground">{k}</dt><dd>{x || "—"}</dd></div>)}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
