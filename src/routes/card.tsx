import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Image as ImageIcon, Link2, Link2Off, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ErrorState, LoadingState } from "@/components/States";
import { CardView } from "@/components/CardView";
import { supabase } from "@/integrations/supabase/client";
import { useAccount } from "@/hooks/useAccount";
import { saveCardPrefs, createCardLink, revokeCardLinks, type PublicCard } from "@/lib/tracking.functions";
import { CARD_FIELDS } from "@/lib/validation";
import { showError } from "@/lib/errors";
import { formatDateTimeIST } from "@/lib/time";

export const Route = createFileRoute("/card")({
  head: () => ({
    meta: [
      { title: "Emergency card · CareBuddy" },
      { name: "description", content: "Your emergency card: choose what shows, print it or share a link." },
      { property: "og:title", content: "Emergency card · CareBuddy" },
      { property: "og:description", content: "Your emergency card: choose what shows, print it or share a link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Card /></AppShell>,
});

type Prefs = Record<(typeof CARD_FIELDS)[number]["key"], boolean>;

function Card() {
  const qc = useQueryClient();
  const savePrefs = useServerFn(saveCardPrefs);
  const create = useServerFn(createCardLink);
  const revoke = useServerFn(revokeCardLinks);
  const ref = useRef<HTMLDivElement>(null);
  const [newLink, setNewLink] = useState<string | null>(null);
  const account = useAccount();
  const q = useQuery({
    queryKey: ["card"],
    queryFn: async () => {
      const [m, c, t] = await Promise.all([
        supabase.from("medicines").select("name, strength, dose_amount").is("archived_at", null).order("created_at"),
        supabase.from("emergency_contacts").select("name, phone, relationship").order("created_at"),
        supabase.from("emergency_card_tokens").select("id, created_at").is("revoked_at", null),
      ]);
      const err = m.error ?? c.error ?? t.error;
      if (err) throw err;
      return { meds: m.data, contacts: c.data, liveLinks: t.data };
    },
  });
  if (account.isLoading || q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = account.data?.profile;
  const prefs = (p?.card_prefs ?? {}) as Prefs;

  const card: PublicCard = {};
  if (prefs.name) card.name = p?.full_name ?? null;
  if (prefs.allergies) card.allergies = p?.allergies ?? null;
  if (prefs.conditions) card.conditions = p?.conditions ?? null;
  if (prefs.medicines) card.medicines = q.data!.meds.map((m) => ({ name: m.name, strength: m.strength, dose: m.dose_amount }));
  if (prefs.doctor) card.doctor = { name: p?.doctor_name ?? null, phone: p?.doctor_phone ?? null };
  if (prefs.contacts) card.contacts = q.data!.contacts;

  async function toggle(k: keyof Prefs, v: boolean) {
    try { await savePrefs({ data: { ...{ name: true, allergies: true, conditions: true, medicines: true, doctor: true, contacts: true }, ...prefs, [k]: v } }); await qc.invalidateQueries({ queryKey: ["account"] }); }
    catch (e) { showError(e); }
  }
  async function saveImage() {
    if (!ref.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(ref.current, { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor });
      const a = document.createElement("a"); a.href = url; a.download = "carebuddy-emergency-card.png"; a.click();
    } catch (e) { showError(e); }
  }
  async function makeLink() {
    try {
      const { token } = await create();
      setNewLink(`${window.location.origin}/c/${token}`);
      await qc.invalidateQueries({ queryKey: ["card"] });
    } catch (e) { showError(e); }
  }
  async function stopLink() {
    if (!window.confirm("Turn off the share link? Anyone with it will no longer see your card.")) return;
    try { await revoke(); setNewLink(null); await qc.invalidateQueries({ queryKey: ["card"] }); toast.success("Share link turned off"); }
    catch (e) { showError(e); }
  }
  const live = q.data!.liveLinks.length > 0;

  return (
    <>
      <PageTitle title="Emergency card" sub="Choose what appears. Only switched-on items are shown." />
      <section className="mt-6 rounded-2xl border bg-card p-5 print:hidden" aria-label="What appears on the card">
        {CARD_FIELDS.map((f) => (
          <div key={f.key} className="flex min-h-12 items-center justify-between">
            <Label htmlFor={`cf-${f.key}`} className="text-lg">{f.label}</Label>
            <Switch id={`cf-${f.key}`} checked={!!prefs[f.key]} onCheckedChange={(v) => toggle(f.key, v)} />
          </div>
        ))}
      </section>
      <div className="mt-6"><CardView ref={ref} card={card} /></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 print:hidden">
        <Button size="lg" variant="outline" onClick={() => window.print()}><Printer /> Print</Button>
        <Button size="lg" variant="outline" onClick={saveImage}><ImageIcon /> Save as image</Button>
      </div>

      <section className="mt-6 rounded-2xl border bg-card p-5 print:hidden" aria-labelledby="share">
        <h2 id="share" className="text-xl font-semibold">Share link (optional)</h2>
        <p className="mt-1 text-muted-foreground">Anyone with the link can see the switched-on items, without signing in. It is off until you create one, and you can turn it off at any time.</p>
        {newLink && (
          <div className="mt-3 rounded-xl bg-secondary p-3">
            <p className="font-semibold">Your link (shown only now; copy it):</p>
            <p className="break-all">{newLink}</p>
            <Button className="mt-2" variant="outline" onClick={() => navigator.clipboard.writeText(newLink).then(() => toast.success("Link copied"))}><Copy /> Copy link</Button>
          </div>
        )}
        <p className="mt-3 text-lg">{live ? `Link is on (created ${formatDateTimeIST(q.data!.liveLinks[0]!.created_at)}).` : "Link is off."}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Button size="lg" onClick={makeLink}><Link2 /> {live ? "Make a new link" : "Create a share link"}</Button>
          {live && <Button size="lg" variant="outline" onClick={stopLink}><Link2Off /> Turn off link</Button>}
        </div>
        {live && <p className="mt-2 text-sm text-muted-foreground">Making a new link turns off the old one.</p>}
      </section>
    </>
  );
}
