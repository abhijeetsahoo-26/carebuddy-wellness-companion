import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { AlertTriangle, Droplets, Leaf, Phone, Stethoscope, Utensils, BedDouble, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmergencyCallButtons } from "@/components/EmergencyCallButtons";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { telHref } from "@/lib/directory";
import { showError } from "@/lib/errors";
import { formatTimeIST } from "@/lib/time";
import { addWater } from "@/lib/medicines.functions";
import { endSickDay, recordSickCheckin } from "@/lib/sickday.functions";
import { CHECKIN_AFTER_H, NOT_A_DOCTOR, SAME_TEXT, SICK_RED_FLAGS, WATER_EVERY_H, nextCheckinAt, type CheckinAnswer, type CheckinOutcome, type RedFlagKey } from "@/lib/sickday";

export const Route = createFileRoute("/sick-day")({
  validateSearch: z.object({ answer: z.enum(["better", "same", "worse"]).optional() }),
  head: () => ({
    meta: [
      { title: "Sick-day mode · CareBuddy" },
      { name: "description", content: "Gentle reminders for water, light meals and rest while you are unwell." },
      { property: "og:title", content: "Sick-day mode · CareBuddy" },
      { property: "og:description", content: "Gentle reminders for water, light meals and rest while you are unwell." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><SickDay /></AppShell>,
});

function useActiveSickDay() {
  return useQuery({
    queryKey: ["sick-day"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sick_day_sessions").select("id, started_at, checkins").is("ended_at", null).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function SickDay() {
  const q = useActiveSickDay();
  const { answer } = Route.useSearch();
  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return (
    <>
      <PageTitle title="Sick-day mode" />
      <div className="mt-6"><EmptyState title="Sick-day mode is off">It can be started after a self-care result from "I feel unwell".</EmptyState></div>
      <Button asChild size="lg" variant="outline" className="mt-4 w-full"><Link to="/unwell">I feel unwell</Link></Button>
      <p className="mt-6 text-lg font-semibold">{NOT_A_DOCTOR}</p>
    </>
  );
  return <Active session={q.data} initialAnswer={answer ?? null} />;
}

function Active({ session, initialAnswer }: { session: { id: string; started_at: string }; initialAnswer: CheckinAnswer | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const check = useServerFn(recordSickCheckin);
  const end = useServerFn(endSickDay);
  const water = useServerFn(addWater);
  const { data: acc } = useAccount();
  const [flags, setFlags] = useState<RedFlagKey[]>([]);
  const [outcome, setOutcome] = useState<CheckinOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);

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

  async function submit(answer: CheckinAnswer | null, red: RedFlagKey[]) {
    // Decide on the spot so help is never delayed; the server decides again when saving.
    const local: CheckinOutcome = red.length ? "emergency" : answer === "better" ? "offer_end" : answer === "worse" ? "doctor_soon" : "contact_if_3_days";
    setOutcome(local);
    window.scrollTo(0, 0);
    try { await check({ data: { answer, red_flags: red } }); toast.success("Saved to your symptom diary"); }
    catch (e) { showError(e); }
  }

  // Opened from the check-in notification's Better / Same / Worse button.
  useEffect(() => {
    if (initialAnswer && !sent.current) { sent.current = true; submit(initialAnswer, []); navigate({ to: "/sick-day", search: {}, replace: true }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAnswer]);

  async function stop() {
    setBusy(true);
    try { await end(); await qc.invalidateQueries({ queryKey: ["sick-day"] }); toast.success("Sick-day mode ended"); navigate({ to: "/" }); }
    catch (e) { showError(e); setBusy(false); }
  }

  const docPhone = acc?.profile?.doctor_phone;
  const callDoctor = docPhone
    ? <Button asChild size="lg" className="w-full"><a href={telHref(docPhone)}><Phone /> Call my doctor{acc?.profile?.doctor_name ? ` (${acc.profile.doctor_name})` : ""}</a></Button>
    : <p className="text-muted-foreground">No doctor phone saved. You can add it under More.</p>;

  return (
    <>
      <PageTitle title="Sick-day mode" sub={`Started ${formatTimeIST(session.started_at)}. Next check-in around ${formatTimeIST(nextCheckinAt(session.started_at))}.`} />

      {outcome === "emergency" && (
        <section role="alert" className="mt-6 rounded-2xl border-2 border-emergency bg-emergency-soft p-5">
          <AlertTriangle className="size-12 text-emergency" aria-hidden />
          <h2 className="mt-2 text-3xl font-bold">Emergency: get help now</h2>
          <p className="mt-2 text-lg">This cannot diagnose anything. Please call for help now.</p>
          <div className="mt-4"><EmergencyCallButtons /></div>
          {flags.includes("self_harm") && <Button asChild variant="outline" size="lg" className="mt-3 w-full"><a href="tel:14416">Call 14416 · Mental health support</a></Button>}
          <Button asChild variant="outline" size="lg" className="mt-3 w-full"><Link to="/emergency">All emergency numbers</Link></Button>
          <p className="mt-3">CareBuddy does not call anyone for you.</p>
        </section>
      )}
      {outcome === "doctor_soon" && (
        <section className="mt-6 rounded-2xl border-2 border-primary bg-card p-5" role="status">
          <Stethoscope className="size-10 text-primary" aria-hidden />
          <h2 className="mt-2 text-3xl font-bold">See a doctor soon</h2>
          <p className="mt-2 text-lg">Please contact your doctor today or as soon as you can.</p>
          <div className="mt-4 grid gap-3">{callDoctor}<Button asChild size="lg" variant="outline"><Link to="/summary">Prepare summary for doctor</Link></Button></div>
        </section>
      )}
      {outcome === "contact_if_3_days" && (
        <section className="mt-6 rounded-2xl border bg-card p-5" role="status">
          <p className="text-xl font-semibold">{SAME_TEXT}</p>
          <div className="mt-4">{callDoctor}</div>
        </section>
      )}
      {outcome === "offer_end" && (
        <section className="mt-6 rounded-2xl border bg-card p-5" role="status">
          <p className="text-xl font-semibold">Glad you feel better. Would you like to end sick-day mode?</p>
          <div className="mt-4 grid gap-3">
            <Button size="lg" disabled={busy} onClick={stop}>End sick-day mode</Button>
            <Button size="lg" variant="outline" onClick={() => setOutcome(null)}>Keep it on for now</Button>
          </div>
        </section>
      )}

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">How are you feeling now?</h2>
        <p className="text-muted-foreground">We will also ask you every {CHECKIN_AFTER_H} hours.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["better", "same", "worse"] as const).map((a) => (
            <Button key={a} size="lg" variant="outline" className="h-14 text-lg" onClick={() => submit(a, [])}>{a === "better" ? "Better" : a === "same" ? "Same" : "Worse"}</Button>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border-2 border-emergency bg-card p-5">
        <h2 className="text-xl font-semibold">Do you have any of these now?</h2>
        <ul className="mt-2 space-y-1">
          {SICK_RED_FLAGS.map((f) => (
            <li key={f.key}>
              <label className="flex min-h-11 items-center gap-3 text-lg">
                <Checkbox className="size-6" checked={flags.includes(f.key)} onCheckedChange={(v) => setFlags((x) => v === true ? [...x, f.key] : x.filter((k) => k !== f.key))} />
                {f.label}
              </label>
            </li>
          ))}
        </ul>
        <Button size="lg" variant="emergency" className="mt-3 w-full" disabled={!flags.length} onClick={() => submit(null, flags)}><AlertTriangle /> Get emergency help</Button>
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Today's reminders</h2>
        <ul className="mt-2 space-y-3 text-lg">
          <li className="flex gap-3"><Droplets className="mt-1 size-6 shrink-0 text-primary" aria-hidden /><span>Drink some water every {WATER_EVERY_H} hours while you are awake. We will send "Time for some water".</span></li>
          <li className="flex gap-3"><Utensils className="mt-1 size-6 shrink-0 text-primary" aria-hidden /><span>Eat something light at meal times, such as khichdi, curd rice, toast or soup.</span></li>
          <li className="flex gap-3"><BedDouble className="mt-1 size-6 shrink-0 text-primary" aria-hidden /><span>Rest as much as you can.</span></li>
        </ul>
        <Button size="lg" variant="outline" className="mt-4 w-full" onClick={async () => {
          try { await water(); await qc.invalidateQueries(); toast.success("Glass of water added"); } catch (e) { showError(e); }
        }}><Droplets /> I drank a glass of water</Button>
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold"><Leaf className="mr-2 inline size-5 text-primary" aria-hidden />From your doctor's plan</h2>
        <p className="text-sm text-muted-foreground">Shown as your doctor wrote it. CareBuddy does not time or suggest doses.</p>
        {plan.isLoading ? <p>Loading…</p> : plan.error ? <ErrorState error={plan.error} onRetry={() => plan.refetch()} /> : !plan.data?.length ? (
          <p className="mt-2 text-lg">No doctor-approved symptom medicines saved. Please contact your doctor or pharmacist.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {plan.data.map((m) => (
              <li key={m.id} className="rounded-xl bg-secondary/60 p-3 text-lg">
                <p className="font-semibold">{m.name}{m.dose ? ` · ${m.dose}` : ""}</p>
                <p>How often: {m.interval_text || "Not written"}</p>
                <p>Most per day: {m.max_per_day || "Not written"}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-6 text-lg font-semibold">{NOT_A_DOCTOR}</p>
      <Button size="lg" variant="outline" className="mt-4 w-full" disabled={busy} onClick={stop}><X /> Exit sick-day mode</Button>
    </>
  );
}
