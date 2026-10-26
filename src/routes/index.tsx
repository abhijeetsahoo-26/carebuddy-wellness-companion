import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Frown, NotebookPen } from "lucide-react";
import { TodayDoses } from "@/components/TodayDoses";
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
      <p className="mt-1 text-lg text-muted-foreground">Here is your day.</p>

      <Button asChild variant="outline" size="lg" className="mt-6 w-full">
        <Link to="/unwell"><Frown /> I feel unwell</Link>
      </Button>
      <Link to="/diary" className="mt-3 inline-flex min-h-11 items-center gap-2 text-lg font-semibold text-primary underline-offset-4 hover:underline">
        <NotebookPen className="size-5" /> Symptom diary
      </Link>

      <TodayDoses />

      <p className="mt-8 text-sm text-muted-foreground">
        CareBuddy is a reminder and tracking helper. It is not a doctor and does not give medical advice.
      </p>
    </>
  );
}
