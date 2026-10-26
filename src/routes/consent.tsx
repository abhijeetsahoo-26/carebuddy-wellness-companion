import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useGate } from "@/components/AppShell";
import { LoadingState } from "@/components/States";
import { acceptConsent } from "@/lib/carebuddy.functions";
import { showError } from "@/lib/errors";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Your privacy · CareBuddy" },
      { name: "description", content: "What CareBuddy stores, why, and who can see it." },
      { property: "og:title", content: "Your privacy · CareBuddy" },
      { property: "og:description", content: "What CareBuddy stores, why, and who can see it." },
    ],
  }),
  component: ConsentPage,
});

const points = [
  { h: "What we keep", p: "Your name, age group, allergies, health conditions, doctor and pharmacist details, food choice, emergency contacts, and what you log in the app." },
  { h: "Why", p: "Only to remind you, keep your records in one place, and help you reach your contacts fast." },
  { h: "Who can see it", p: "Only you. Someone else can see it only if you choose to share it, and you can stop sharing at any time." },
  { h: "Never sold", p: "We never sell your data or share it with advertisers or anyone else." },
  { h: "Your control", p: "You can download all your data or delete your account and everything in it at any time." },
];

function ConsentPage() {
  const g = useGate("signed-in");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const accept = useServerFn(acceptConsent);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (g.data?.consent) navigate({ to: g.data.profile?.onboarding_done ? "/" : "/onboarding" });
  }, [g.data, navigate]);

  if (!g.ready) return <LoadingState />;

  async function submit() {
    setBusy(true);
    try {
      await accept({ data: { agreed } });
      await qc.invalidateQueries({ queryKey: ["account"] });
      navigate({ to: "/onboarding" });
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <h1 className="text-3xl font-bold">Before we start</h1>
      <p className="mt-2 text-lg text-muted-foreground">Here is how CareBuddy looks after your information.</p>
      <ul className="mt-6 space-y-4">
        {points.map((x) => (
          <li key={x.h} className="rounded-2xl border bg-card p-5">
            <h2 className="text-xl font-semibold">{x.h}</h2>
            <p className="mt-1">{x.p}</p>
          </li>
        ))}
      </ul>
      <p className="mt-4">
        Read more in our <Link to="/privacy" className="font-semibold text-primary underline">privacy policy</Link> and{" "}
        <Link to="/what-we-store" className="font-semibold text-primary underline">what we store</Link>.
      </p>
      <label className="mt-6 flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl bg-secondary p-4">
        <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-1 size-6" aria-required="true" />
        <span className="text-lg">I understand and agree to CareBuddy storing my information as described above.</span>
      </label>
      <Button size="lg" className="mt-6 w-full" disabled={!agreed || busy} onClick={submit}>
        {busy ? "Saving…" : "Agree and continue"}
      </Button>
    </main>
  );
}
