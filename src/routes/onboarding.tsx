import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useGate } from "@/components/AppShell";
import { LoadingState } from "@/components/States";
import { saveProfile, addEmergencyContact } from "@/lib/carebuddy.functions";
import { AGE_GROUPS, DIETS, profileFieldsSchema, emergencyContactSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Set up · CareBuddy" },
      { name: "description", content: "A few quick questions to set up CareBuddy." },
      { property: "og:title", content: "Set up · CareBuddy" },
      { property: "og:description", content: "A few quick questions to set up CareBuddy." },
    ],
  }),
  component: Onboarding,
});

type F = Record<string, string>;
const STEPS = ["Your name", "Age group", "Allergies and conditions", "Your doctor", "Your pharmacist", "Food choice", "Emergency contact"];

function Field({ id, label, f, set, type = "text", hint }: { id: string; label: string; f: F; set: (f: F) => void; type?: string; hint?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-base">{label}</Label>
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      <Input id={id} type={type} className="h-12 text-base" value={f[id] ?? ""} onChange={(e) => set({ ...f, [id]: e.target.value })} />
    </div>
  );
}

function Choice({ id, options, f, set }: { id: string; options: readonly { value: string; label: string }[]; f: F; set: (f: F) => void }) {
  return (
    <div className="grid gap-2" role="radiogroup">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={f[id] === o.value}
          onClick={() => set({ ...f, [id]: o.value })}
          className="min-h-12 rounded-xl border-2 px-4 text-left text-lg aria-checked:border-primary aria-checked:bg-secondary aria-checked:font-semibold">
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Onboarding() {
  const g = useGate("signed-in");
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(saveProfile);
  const addContact = useServerFn(addEmergencyContact);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<F>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!g.data || loaded) return;
    if (!g.data.consent) return void navigate({ to: "/consent" });
    if (g.data.profile?.onboarding_done) return void navigate({ to: "/" });
    const p = g.data.profile;
    if (p) {
      setStep(Math.min(p.onboarding_step, STEPS.length - 1));
      const init: F = {};
      for (const [k, v] of Object.entries(p)) if (typeof v === "string") init[k] = v;
      setF(init);
    }
    setLoaded(true);
  }, [g.data, loaded, navigate]);

  if (!g.ready || !loaded) return <LoadingState />;

  async function go(skip: boolean) {
    const last = step === STEPS.length - 1;
    setBusy(true);
    try {
      if (last && !skip) {
        const r = emergencyContactSchema.safeParse({ name: f.ec_name, phone: f.ec_phone, relationship: f.ec_rel });
        if (!r.success) { toast.error(firstIssue(r)); return; }
        await addContact({ data: r.data });
      }
      let fields = {};
      if (!skip && !last) {
        const keys = [["full_name"], ["age_group"], ["allergies", "conditions"], ["doctor_name", "doctor_phone"], ["pharmacist_name", "pharmacist_phone"], ["diet"]][step] ?? [];
        const r = profileFieldsSchema.safeParse(Object.fromEntries(keys.map((k) => [k, f[k] || undefined])));
        if (!r.success) { toast.error(firstIssue(r)); return; }
        fields = r.data;
      }
      await save({ data: { fields, step: step + 1, done: last } });
      if (last) {
        await qc.invalidateQueries({ queryKey: ["account"] });
        navigate({ to: "/" });
      } else setStep(step + 1);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <p className="text-muted-foreground">Step {step + 1} of {STEPS.length}</p>
      <Progress value={((step + 1) / STEPS.length) * 100} className="mt-2" aria-label="Setup progress" />
      <h1 className="mt-6 text-3xl font-bold">{STEPS[step]}</h1>
      <p className="mt-1 text-muted-foreground">You can skip this and add it later. Your progress is saved.</p>

      <div className="mt-6 space-y-5">
        {step === 0 && <Field id="full_name" label="What should we call you?" f={f} set={setF} />}
        {step === 1 && <Choice id="age_group" options={AGE_GROUPS} f={f} set={setF} />}
        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="allergies" className="text-base">Allergies (medicines, foods, other)</Label>
              <Textarea id="allergies" className="text-base" value={f.allergies ?? ""} onChange={(e) => setF({ ...f, allergies: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conditions" className="text-base">Health conditions your doctor told you about (optional)</Label>
              <Textarea id="conditions" className="text-base" value={f.conditions ?? ""} onChange={(e) => setF({ ...f, conditions: e.target.value })} />
            </div>
          </>
        )}
        {step === 3 && (<><Field id="doctor_name" label="Doctor's name" f={f} set={setF} /><Field id="doctor_phone" label="Doctor's phone" type="tel" f={f} set={setF} /></>)}
        {step === 4 && (<><Field id="pharmacist_name" label="Pharmacist or chemist (optional)" f={f} set={setF} /><Field id="pharmacist_phone" label="Pharmacist's phone" type="tel" f={f} set={setF} /></>)}
        {step === 5 && <Choice id="diet" options={DIETS} f={f} set={setF} />}
        {step === 6 && (
          <>
            <Field id="ec_name" label="Contact's name" f={f} set={setF} />
            <Field id="ec_phone" label="Contact's phone" type="tel" f={f} set={setF} />
            <Field id="ec_rel" label="How are they related to you?" hint="For example: son, friend, neighbour" f={f} set={setF} />
          </>
        )}
      </div>

      <div className="mt-8 grid gap-3">
        <Button size="lg" disabled={busy} onClick={() => go(false)}>{busy ? "Saving…" : step === STEPS.length - 1 ? "Save and finish" : "Save and continue"}</Button>
        <Button size="lg" variant="outline" disabled={busy} onClick={() => go(true)}>Skip for now</Button>
        {step > 0 && <Button variant="ghost" disabled={busy} onClick={() => setStep(step - 1)}>Back</Button>}
      </div>
    </main>
  );
}
