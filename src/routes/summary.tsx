import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, FileText, Link2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AppShell, PageTitle } from "@/components/AppShell";
import { SummaryView } from "@/components/SummaryView";
import { ErrorState, LoadingState, EmptyState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/errors";
import { formatDateTimeIST } from "@/lib/time";
import { ALL_SECTIONS, DEFAULT_EXPIRY_DAYS, EXPIRY_CHOICES, SECTIONS, defaultRange, summaryRequestSchema, type SectionKey, type SummaryDoc } from "@/lib/summary";
import { createShareLink, getMySummary, getQuestionPrefill, revokeShareLink } from "@/lib/summary.functions";

export const Route = createFileRoute("/summary")({
  head: () => ({
    meta: [
      { title: "Summary for my doctor · CareBuddy" },
      { name: "description", content: "Prepare a one-minute summary for your doctor as a PDF or a private read-only link." },
      { property: "og:title", content: "Summary for my doctor · CareBuddy" },
      { property: "og:description", content: "Prepare a one-minute summary for your doctor as a PDF or a private read-only link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Summary /></AppShell>,
});

function Summary() {
  const build = useServerFn(getMySummary);
  const prefill = useServerFn(getQuestionPrefill);
  const share = useServerFn(createShareLink);
  const [range, setRange] = useState(defaultRange);
  const [sections, setSections] = useState<SectionKey[]>(ALL_SECTIONS);
  const [questions, setQuestions] = useState<string[]>([]);
  const [newQ, setNewQ] = useState("");
  const [preview, setPreview] = useState<SummaryDoc | null>(null);
  const [pdf, setPdf] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "pdf" | "share">("");
  const [expiry, setExpiry] = useState<number>(DEFAULT_EXPIRY_DAYS);
  const [newLink, setNewLink] = useState<string | null>(null);
  const qc = useQueryClient();

  useEffect(() => {
    prefill().then((r) => setQuestions((q) => (q.length ? q : r.questions))).catch(() => {});
  }, [prefill]);

  // Any change makes an earlier preview / PDF stale.
  useEffect(() => { setPdf(null); setPreview(null); }, [range, sections, questions]);

  function request() {
    const r = summaryRequestSchema.safeParse({ ...range, sections, questions });
    if (!r.success) { toast.error(r.error.issues[0]?.message ?? "Please check the dates."); return null; }
    return r.data;
  }

  async function doPreview() {
    const r = request(); if (!r) return;
    setBusy("preview");
    try { setPreview(await build({ data: { request: r, record: false } })); } catch (e) { showError(e); } finally { setBusy(""); }
  }

  async function makePdf() {
    const r = request(); if (!r) return;
    setBusy("pdf");
    try {
      const doc = await build({ data: { request: r, record: true } });
      const { summaryPdf } = await import("@/lib/summary-pdf");
      setPdf(summaryPdf(doc));
      setPreview(doc);
    } catch (e) { showError(e); } finally { setBusy(""); }
  }

  function savePdf() {
    if (!pdf) return;
    const url = URL.createObjectURL(pdf);
    const a = document.createElement("a");
    a.href = url; a.download = `carebuddy-summary-${range.from}-to-${range.to}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function makeLink() {
    const r = request(); if (!r) return;
    setBusy("share");
    try {
      const res = await share({ data: { request: r, expiryDays: expiry as 1 | 7 | 30 } });
      setNewLink(`${window.location.origin}/s/${res.token}`);
      qc.invalidateQueries({ queryKey: ["share-links"] });
    } catch (e) { showError(e); } finally { setBusy(""); }
  }

  const toggle = (k: SectionKey, on: boolean) => setSections((s) => on ? ALL_SECTIONS.filter((x) => x === k || s.includes(x)) : s.filter((x) => x !== k));

  return (
    <>
      <PageTitle title="Summary for my doctor" sub="A short, factual summary to read in about a minute. It lists what you logged, with no advice." />

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">1. Choose dates</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div><Label htmlFor="from">From</Label><Input id="from" type="date" className="h-12 text-base" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></div>
          <div><Label htmlFor="to">To</Label><Input id="to" type="date" className="h-12 text-base" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Default: the last 30 days.</p>
      </section>

      <section className="mt-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">2. Choose what to include</h2>
        <p className="text-sm text-muted-foreground">"At a glance" is always on the first page.</p>
        <ul className="mt-3 space-y-1">
          {SECTIONS.map((s) => (
            <li key={s.key}>
              <label className="flex min-h-11 items-center gap-3 text-base">
                <Checkbox checked={sections.includes(s.key)} onCheckedChange={(v) => toggle(s.key, v === true)} className="size-6" />
                {s.label}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {sections.includes("questions") && (
        <section className="mt-4 rounded-2xl border bg-card p-5">
          <h2 className="text-xl font-semibold">3. Questions for my doctor</h2>
          <p className="text-sm text-muted-foreground">Filled in from your next appointment, if you have one. Edit freely.</p>
          <ul className="mt-3 space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <Input aria-label={`Question ${i + 1}`} className="h-11 text-base" value={q} maxLength={300} onChange={(e) => setQuestions((qs) => qs.map((x, j) => j === i ? e.target.value : x))} />
                <Button variant="ghost" size="icon" className="size-11" aria-label="Remove question" onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}><X /></Button>
              </li>
            ))}
          </ul>
          <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = newQ.trim(); if (t && questions.length < 20) { setQuestions((q) => [...q, t]); setNewQ(""); } }}>
            <Input aria-label="New question" placeholder="Add a question" className="h-11 text-base" value={newQ} maxLength={300} onChange={(e) => setNewQ(e.target.value)} />
            <Button type="submit" variant="outline" className="h-11"><Plus /> Add</Button>
          </form>
        </section>
      )}

      <section className="mt-4 grid gap-3">
        <Button size="lg" variant="outline" disabled={!!busy} onClick={doPreview}>{busy === "preview" ? "Preparing…" : "Preview"}</Button>
        {pdf ? <Button size="lg" onClick={savePdf}><Download /> Save PDF</Button>
          : <Button size="lg" disabled={!!busy} onClick={makePdf}><FileText /> {busy === "pdf" ? "Preparing PDF…" : "Make PDF"}</Button>}
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Share with my doctor</h2>
        <p className="mt-1 text-muted-foreground">Creates a private, read-only link with the dates and sections chosen above. No sign-in needed to open it. You can turn it off anytime.</p>
        <fieldset className="mt-3">
          <legend className="font-medium">Link works for</legend>
          <div className="mt-2 flex gap-2">
            {EXPIRY_CHOICES.map((d) => (
              <Button key={d} type="button" variant={expiry === d ? "default" : "outline"} className="h-11 flex-1" aria-pressed={expiry === d} onClick={() => setExpiry(d)}>
                {d} day{d > 1 ? "s" : ""}
              </Button>
            ))}
          </div>
        </fieldset>
        <Button size="lg" className="mt-4 w-full" disabled={!!busy} onClick={makeLink}><Link2 /> {busy === "share" ? "Creating…" : "Create link"}</Button>
        {newLink && (
          <div className="mt-4 rounded-xl border-2 border-primary bg-primary/5 p-4" role="status">
            <p className="font-semibold">Your link is shown only now. Copy it before leaving this page.</p>
            <p className="mt-2 break-all font-mono text-sm">{newLink}</p>
            <div className="mt-3 flex gap-2">
              <Button className="h-11 flex-1" onClick={async () => { try { await navigator.clipboard.writeText(newLink); toast.success("Link copied"); } catch { toast.error("Could not copy. Please select and copy the link."); } }}><Copy /> Copy</Button>
              <Button variant="outline" className="h-11" onClick={() => setNewLink(null)}>Done</Button>
            </div>
          </div>
        )}
        <ShareLinks />
      </section>

      {preview && <div className="mt-6"><h2 className="mb-3 text-xl font-semibold">Preview</h2><SummaryView doc={preview} /></div>}
    </>
  );
}

function ShareLinks() {
  const revoke = useServerFn(revokeShareLink);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["share-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("share_links")
        .select("id, range_from, range_to, sections, expires_at, revoked_at, view_count, first_viewed_at, last_viewed_at, created_at")
        .order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });
  if (q.isLoading) return <LoadingState label="Loading your links…" />;
  if (q.error) return <div className="mt-4"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>;
  if (!q.data?.length) return <div className="mt-4"><EmptyState title="No links yet" /></div>;
  const now = new Date().toISOString();
  return (
    <ul className="mt-5 space-y-3">
      {q.data.map((l) => {
        const live = !l.revoked_at && l.expires_at > now;
        return (
          <li key={l.id} className="rounded-xl border p-4">
            <p className="font-semibold">{l.range_from} to {l.range_to} · {live ? "Active" : l.revoked_at ? "Turned off" : "Expired"}</p>
            <p className="text-sm text-muted-foreground">Created {formatDateTimeIST(l.created_at)} · {live ? "works until" : "ended"} {formatDateTimeIST(l.revoked_at ?? l.expires_at)}</p>
            <p className="mt-1">Opened {l.view_count} time{l.view_count === 1 ? "" : "s"}{l.last_viewed_at ? ` · last opened ${formatDateTimeIST(l.last_viewed_at)}` : " · not opened yet"}</p>
            {live && (
              <Button variant="outline" className="mt-2 h-11" onClick={async () => {
                try { await revoke({ data: { id: l.id } }); toast.success("Link turned off"); qc.invalidateQueries({ queryKey: ["share-links"] }); } catch (e) { showError(e); }
              }}><Trash2 /> Turn off link</Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
