import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useAccount } from "@/hooks/useAccount";

export const Route = createFileRoute("/unwell")({
  head: () => ({
    meta: [
      { title: "I feel unwell · CareBuddy" },
      { name: "description", content: "Check for warning signs and find the right help." },
      { property: "og:title", content: "I feel unwell · CareBuddy" },
      { property: "og:description", content: "Check for warning signs and find the right help." },
    ],
  }),
  component: () => <AppShell><Unwell /></AppShell>,
});

// Fixed list from the safety rules. No AI is used here.
const RED_FLAGS = [
  "Chest pain or pressure",
  "Trouble breathing",
  "Confusion",
  "Fainting",
  "A seizure (fit)",
  "Severe bleeding",
  "Very dry mouth, no urine, or feeling faint from lack of water",
  "Symptoms getting worse fast",
  "Thoughts of hurting yourself",
  "Swelling of the face or throat",
];

function Unwell() {
  const [answer, setAnswer] = useState<"none" | null>(null);
  const { data } = useAccount();
  const doc = data?.profile?.doctor_phone;

  return (
    <>
      <PageTitle title="I feel unwell" sub="Do you have any of these right now?" />
      <ul className="mt-6 space-y-2 rounded-2xl border bg-emergency-soft p-5 text-lg">
        {RED_FLAGS.map((r) => <li key={r}>• {r}</li>)}
      </ul>
      <div className="mt-6 grid gap-3">
        <Button asChild variant="emergency" size="lg"><Link to="/emergency">Yes, I have one of these</Link></Button>
        <Button variant="outline" size="lg" onClick={() => setAnswer("none")}>No, none of these</Button>
      </div>
      {answer === "none" && (
        <div className="mt-6 rounded-2xl border bg-card p-5" role="status">
          <p className="text-lg">Please contact your doctor or pharmacist.</p>
          {doc && (
            <Button asChild size="lg" className="mt-4 w-full">
              <a href={`tel:${doc.replace(/[^0-9+]/g, "")}`}><Phone /> Call your doctor</a>
            </Button>
          )}
          <p className="mt-4 text-muted-foreground">If you start to feel worse, tap Emergency help.</p>
          <p className="mt-4 font-semibold">I'm not a doctor. Please follow your doctor's advice.</p>
        </div>
      )}
    </>
  );
}
