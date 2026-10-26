import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill, Utensils, HeartPulse, ClipboardList, LogOut, Frown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareBuddy · Your medicine and meal companion" },
      { name: "description", content: "Reminders and tracking for medicines, meals and symptoms." },
      { property: "og:title", content: "CareBuddy" },
      { property: "og:description", content: "Reminders and tracking for medicines, meals and symptoms." },
    ],
  }),
  component: Home,
});

const tiles = [
  { icon: ClipboardList, title: "Doctor's Plan", text: "Your medicines, as your doctor wrote them." },
  { icon: Pill, title: "Today's medicines", text: "Gentle reminders through the day." },
  { icon: Utensils, title: "Meals", text: "Note what you ate." },
  { icon: HeartPulse, title: "How I feel", text: "Write down how you are today." },
];

function Home() {
  return (
    <AppShell>
      <HomeBody />
    </AppShell>
  );
}

function HomeBody() {
  const qc = useQueryClient();
  const hour = new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" });
  const h = Number(hour);
  const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
  }

  return (
    <>
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl font-bold text-primary">CareBuddy</span>
        <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
          <LogOut /> Sign out
        </Button>
      </header>

      <h1 className="mt-8 text-3xl font-bold">{greet}</h1>
      <p className="mt-1 text-lg text-muted-foreground">What would you like to do?</p>

      <Button asChild variant="outline" size="lg" className="mt-6 w-full">
        <Link to="/unwell"><Frown /> I feel unwell</Link>
      </Button>

      <ul className="mt-6 grid gap-4">
        {tiles.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-4 rounded-2xl border bg-card p-5">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <Icon className="size-6" aria-hidden />
            </span>
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="text-muted-foreground">{text}</p>
              <p className="mt-1 text-sm font-semibold text-primary">Coming soon</p>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm text-muted-foreground">
        CareBuddy is a reminder and tracking helper. It is not a doctor and does not give medical advice.
      </p>
    </>
  );
}
