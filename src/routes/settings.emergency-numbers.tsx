import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AppShell, PageTitle } from "@/components/AppShell";
import { useDirectory } from "@/hooks/useDirectory";
import { saveDirectoryNumber, resetDirectoryNumber } from "@/lib/diary.functions";
import { directoryNumberSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";
import type { DirEntry } from "@/lib/directory";

export const Route = createFileRoute("/settings/emergency-numbers")({
  head: () => ({
    meta: [
      { title: "Emergency numbers · CareBuddy" },
      { name: "description", content: "Check and edit the emergency numbers for your area." },
      { property: "og:title", content: "Emergency numbers · CareBuddy" },
      { property: "og:description", content: "Check and edit the emergency numbers for your area." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Numbers /></AppShell>,
});

function Numbers() {
  const { list, isLoading } = useDirectory();
  return (
    <>
      <PageTitle title="Emergency numbers" />
      <div className="mt-4 flex gap-3 rounded-2xl border-2 border-primary bg-card p-4" role="note">
        <AlertTriangle className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
        <p className="text-lg"><strong>Verify these numbers for your area.</strong> They are common numbers in India and may differ where you live. Changes apply only to you.</p>
      </div>
      <div className="mt-6 space-y-3">
        {isLoading ? <p>Loading…</p> : list.map((d) => <Row key={d.key} d={d} />)}
      </div>
    </>
  );
}

function Row({ d }: { d: DirEntry }) {
  const qc = useQueryClient();
  const save = useServerFn(saveDirectoryNumber);
  const reset = useServerFn(resetDirectoryNumber);
  const [num, setNum] = useState(d.number);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["directory"] }); toast.success(msg); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }
  function submit() {
    const r = directoryNumberSchema.safeParse({ key: d.key, label: d.label, number: num });
    if (!r.success) return void toast.error(firstIssue(r));
    void run(() => save({ data: r.data }), "Number saved");
  }
  return (
    <div className="rounded-2xl border bg-card p-4">
      <label htmlFor={`n-${d.key}`} className="text-lg font-semibold">{d.label} {d.edited && <Badge variant="secondary">Changed by you</Badge>}</label>
      <div className="mt-2 flex gap-2">
        <Input id={`n-${d.key}`} inputMode="tel" className="h-12 text-lg" value={num} onChange={(e) => setNum(e.target.value)} />
        <Button size="lg" disabled={busy || num === d.number} onClick={submit}>Save</Button>
        {d.edited && <Button size="lg" variant="ghost" aria-label={`Reset ${d.label} to the default`} disabled={busy} onClick={() => run(() => reset({ data: { key: d.key } }), "Reset to default")}><RotateCcw /></Button>}
      </div>
    </div>
  );
}
