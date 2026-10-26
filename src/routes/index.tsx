import { createFileRoute, Link } from "@tanstack/react-router";
import { LogOut, Frown, NotebookPen, Leaf } from "lucide-react";
import { TodayDoses } from "@/components/TodayDoses";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { Landing } from "@/components/Landing";
import { LoadingState } from "@/components/States";
import { useAccount } from "@/hooks/useAccount";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CareBuddy · Your calm daily health companion" },
      { name: "description", content: "Medicine reminders, meal and symptom tracking, and a summary to show your doctor. Not a doctor or emergency service." },
      { property: "og:title", content: "CareBuddy · Your calm daily health companion" },
      { property: "og:description", content: "Medicine reminders, meal and symptom tracking, and a summary to show your doctor." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://carebuddy-wellness-companion.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  // Signed-out visitors see the public landing page; signed-in users get Today.
  const { user, authLoading } = useAccount();
  if (authLoading) return <LoadingState />;
  if (!user) return <Landing />;
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

      <SickDayBanner />
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

function SickDayBanner() {
  const q = useQuery({
    queryKey: ["sick-day"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sick_day_sessions").select("id, started_at, checkins").is("ended_at", null).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  if (!q.data) return null;
  return (
    <section className="mt-6 rounded-2xl border-2 border-primary bg-secondary/60 p-5">
      <h2 className="flex items-center gap-2 text-xl font-semibold"><Leaf className="size-6 text-primary" aria-hidden /> Sick-day mode is on</h2>
      <p className="mt-1 text-lg">Water, light meals, rest, and your doctor's plan in one place.</p>
      <Button asChild size="lg" className="mt-3 w-full"><Link to="/sick-day">Open sick-day view</Link></Button>
    </section>
  );
}
