import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, NotebookPen, PhoneCall, Users, History, Download, Shield, Database, FlaskConical, Bell, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell, PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { loadDemoData, clearDemoData } from "@/lib/carebuddy.functions";
import { showError } from "@/lib/errors";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "More · CareBuddy" },
      { name: "description", content: "Contacts, activity, privacy and your data." },
      { property: "og:title", content: "More · CareBuddy" },
      { property: "og:description", content: "Contacts, activity, privacy and your data." },
    ],
  }),
  component: () => <AppShell><More /></AppShell>,
});

const links = [
  { to: "/settings/reminders", label: "Reminders", icon: Bell },
  { to: "/reminder-health", label: "Reminder health", icon: HeartPulse },
  { to: "/diary", label: "Symptom diary", icon: NotebookPen },
  { to: "/contacts", label: "Emergency contacts", icon: Users },
  { to: "/settings/emergency-numbers", label: "Emergency numbers", icon: PhoneCall },
  { to: "/activity", label: "Activity", icon: History },
  { to: "/my-data", label: "Download or delete my data", icon: Download },
  { to: "/privacy", label: "Privacy policy", icon: Shield },
  { to: "/what-we-store", label: "What we store", icon: Database },
] as const;

function More() {
  const qc = useQueryClient();
  const load = useServerFn(loadDemoData);
  const clear = useServerFn(clearDemoData);
  const [busy, setBusy] = useState(false);
  const demo = useQuery({
    queryKey: ["demo-count"],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        supabase.from("emergency_contacts").select("id", { count: "exact", head: true }).eq("is_demo", true),
        supabase.from("medicines").select("id", { count: "exact", head: true }).eq("is_demo", true),
      ]);
      if (a.error ?? b.error) throw a.error ?? b.error;
      return (a.count ?? 0) + (b.count ?? 0);
    },
  });
  const hasDemo = (demo.data ?? 0) > 0;

  async function toggle() {
    setBusy(true);
    try {
      if (hasDemo) { await clear(); toast.success("Sample data removed"); }
      else { await load(); toast.success("Sample data added. It is marked “Sample”."); }
      await qc.invalidateQueries();
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="More" />
      <nav className="mt-6 overflow-hidden rounded-2xl border bg-card">
        {links.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex min-h-14 items-center gap-4 border-b px-5 text-lg last:border-b-0 hover:bg-accent">
            <Icon className="size-6 text-primary" aria-hidden />
            <span className="flex-1">{label}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </nav>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><FlaskConical className="size-6 text-primary" /> Sample data</h2>
        <p className="mt-1 text-muted-foreground">
          {hasDemo ? "Sample data is on. It is made up and marked “Sample”." : "Add made-up data to see how CareBuddy works. You can remove it in one tap."}
        </p>
        <Button className="mt-4 w-full" variant={hasDemo ? "outline" : "default"} disabled={busy || demo.isLoading} onClick={toggle}>
          {busy ? "Please wait…" : hasDemo ? "Remove sample data" : "Try with sample data"}
        </Button>
      </section>
    </>
  );
}
