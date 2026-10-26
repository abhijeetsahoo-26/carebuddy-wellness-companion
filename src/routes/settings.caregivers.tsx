import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Pause, Play, Share2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, INVITE_DAYS, inviteSchema, inviteUsable } from "@/lib/caregiver";
import { createCaregiverInvite, updateCaregiverGrant } from "@/lib/caregiver.functions";
import { showError } from "@/lib/errors";
import { formatDateTimeIST } from "@/lib/time";

export const Route = createFileRoute("/settings/caregivers")({
  head: () => ({
    meta: [
      { title: "Caregivers · CareBuddy" },
      { name: "description", content: "Invite a caregiver to see only what you choose, and stop sharing at any time." },
      { property: "og:title", content: "Caregivers · CareBuddy" },
      { property: "og:description", content: "Invite a caregiver to see only what you choose, and stop sharing at any time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AppShell><Caregivers /></AppShell>,
});

const FLAG = { adherence: "can_adherence", missed: "can_missed_alerts", appointments: "can_appointments" } as const;
const STATUS: Record<string, string> = { invited: "Invite sent", active: "Can see", paused: "Paused", revoked: "Access removed", cancelled: "Invite cancelled" };

function Caregivers() {
  const qc = useQueryClient();
  const create = useServerFn(createCaregiverInvite);
  const update = useServerFn(updateCaregiverGrant);
  const [label, setLabel] = useState("");
  const [cats, setCats] = useState({ can_adherence: true, can_missed_alerts: true, can_appointments: false });
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const grants = useQuery({
    queryKey: ["caregiver-grants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("caregiver_grants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const log = useQuery({
    queryKey: ["caregiver-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("caregiver_access_log").select("id, grant_id, categories, viewed_at").order("viewed_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["caregiver-grants"] }), qc.invalidateQueries({ queryKey: ["caregiver-log"] })]);

  async function invite() {
    const r = inviteSchema.safeParse({ label, ...cats });
    if (!r.success) return void toast.error(r.error.issues[0]?.message ?? "Please check the form.");
    setBusy(true);
    try {
      const res = await create({ data: r.data });
      setLink(`${window.location.origin}/caregiver-invite/${res.token}`);
      setLabel("");
      await refresh();
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function act(id: string, action: "pause" | "resume" | "revoke" | "cancel", ok: string) {
    try { await update({ data: { id, action } }); toast.success(ok); await refresh(); } catch (e) { showError(e); }
  }

  const labelOf = (id: string | null) => grants.data?.find((g) => g.id === id)?.label ?? "A caregiver";

  return (
    <>
      <PageTitle title="Caregivers" sub="Let someone you trust see a few things, read-only. You can pause or stop it at any time." />

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Invite a caregiver</h2>
        <Label htmlFor="cg-label" className="mt-3 block text-base">Who is this? (only you see this)</Label>
        <Input id="cg-label" className="mt-1 h-12 text-base" placeholder="For example: My son Rohan" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
        <p className="mt-4 font-medium">They can see:</p>
        <ul className="mt-1 space-y-1">
          {CATEGORIES.map((c) => (
            <li key={c.key}>
              <label className="flex min-h-11 items-center gap-3 text-base">
                <Checkbox className="size-6" checked={cats[FLAG[c.key]]} onCheckedChange={(v) => setCats((x) => ({ ...x, [FLAG[c.key]]: v === true }))} />
                {c.label}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-muted-foreground">Never shared: your diary, meals, numbers, Doctor's Plan or medicine names.</p>
        <Button size="lg" className="mt-4 w-full" disabled={busy} onClick={invite}><UserPlus /> {busy ? "Creating…" : "Create invite link"}</Button>
        {link && (
          <div className="mt-4 rounded-xl border-2 border-primary bg-primary/5 p-4" role="status">
            <p className="font-semibold">Send this link by message. It works once and expires in {INVITE_DAYS} days. It is shown only now.</p>
            <p className="mt-2 break-all font-mono text-sm">{link}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button className="h-11" onClick={async () => { try { await navigator.clipboard.writeText(link); toast.success("Link copied"); } catch { toast.error("Could not copy. Please select and copy the link."); } }}><Copy /> Copy</Button>
              <Button asChild variant="outline" className="h-11"><a href={`https://wa.me/?text=${encodeURIComponent(`Please be my caregiver on CareBuddy: ${link}`)}`} target="_blank" rel="noreferrer"><Share2 /> Send on WhatsApp</a></Button>
            </div>
            <Button variant="ghost" className="mt-2 h-11" onClick={() => setLink(null)}>Done</Button>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">My caregivers</h2>
        <div className="mt-3 space-y-3">
          {grants.isLoading ? <LoadingState /> : grants.error ? <ErrorState error={grants.error} onRetry={() => grants.refetch()} /> :
            !grants.data?.length ? <EmptyState title="No caregivers yet" /> : grants.data.map((g) => {
              const expired = g.status === "invited" && !inviteUsable(g);
              return (
                <article key={g.id} className="rounded-2xl border bg-card p-4">
                  <p className="text-lg font-semibold">{g.label} {g.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
                  <p>{expired ? "Invite expired" : STATUS[g.status]}{g.status === "invited" && !expired && g.invite_expires_at ? ` · expires ${formatDateTimeIST(g.invite_expires_at)}` : ""}</p>
                  <p className="text-sm text-muted-foreground">Shares: {CATEGORIES.filter((c) => g[FLAG[c.key]]).map((c) => c.label).join("; ") || "nothing"}</p>
                  {(g.status === "active" || g.status === "paused") && <CategoryEditor g={g} onSaved={refresh} />}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {g.status === "active" && <Button variant="outline" className="h-11" onClick={() => act(g.id, "pause", "Paused")}><Pause /> Pause</Button>}
                    {g.status === "paused" && <Button variant="outline" className="h-11" onClick={() => act(g.id, "resume", "Resumed")}><Play /> Resume</Button>}
                    {(g.status === "active" || g.status === "paused") && <Button variant="destructive" className="h-11" onClick={() => confirm(`Remove ${g.label}'s access now?`) && act(g.id, "revoke", "Access removed")}><Trash2 /> Remove access</Button>}
                    {g.status === "invited" && <Button variant="outline" className="h-11" onClick={() => act(g.id, "cancel", "Invite cancelled")}>Cancel invite</Button>}
                  </div>
                </article>
              );
            })}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-semibold">When caregivers looked</h2>
        <div className="mt-3">
          {log.isLoading ? <LoadingState /> : log.error ? <ErrorState error={log.error} onRetry={() => log.refetch()} /> :
            !log.data?.length ? <EmptyState title="No views yet" /> : (
              <ul className="space-y-2">
                {log.data.map((l) => (
                  <li key={l.id} className="rounded-xl border bg-card p-3">
                    <p className="font-medium">{labelOf(l.grant_id)} · {formatDateTimeIST(l.viewed_at)}</p>
                    <p className="text-sm text-muted-foreground">Saw: {l.categories.map((c) => CATEGORIES.find((x) => x.key === c)?.label ?? c).join("; ") || "nothing"}</p>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </section>
    </>
  );
}

type GrantRow = { id: string; can_adherence: boolean; can_missed_alerts: boolean; can_appointments: boolean };
function CategoryEditor({ g, onSaved }: { g: GrantRow; onSaved: () => Promise<unknown> }) {
  const update = useServerFn(updateCaregiverGrant);
  return (
    <ul className="mt-2 space-y-1">
      {CATEGORIES.map((c) => (
        <li key={c.key}>
          <label className="flex min-h-11 items-center gap-3 text-base">
            <Checkbox className="size-6" checked={g[FLAG[c.key]]} onCheckedChange={async (v) => {
              try { await update({ data: { id: g.id, action: "categories", can_adherence: g.can_adherence, can_missed_alerts: g.can_missed_alerts, can_appointments: g.can_appointments, [FLAG[c.key]]: v === true } }); await onSaved(); }
              catch (e) { showError(e); }
            }} />
            {c.label}
          </label>
        </li>
      ))}
    </ul>
  );
}
