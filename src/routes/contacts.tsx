import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { supabase } from "@/integrations/supabase/client";
import { addEmergencyContact, deleteEmergencyContact } from "@/lib/carebuddy.functions";
import { emergencyContactSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";

export const Route = createFileRoute("/contacts")({
  head: () => ({
    meta: [
      { title: "Emergency contacts · CareBuddy" },
      { name: "description", content: "People to call when you need help." },
      { property: "og:title", content: "Emergency contacts · CareBuddy" },
      { property: "og:description", content: "People to call when you need help." },
    ],
  }),
  component: () => <AppShell><Contacts /></AppShell>,
});

function Contacts() {
  const qc = useQueryClient();
  const add = useServerFn(addEmergencyContact);
  const del = useServerFn(deleteEmergencyContact);
  const [form, setForm] = useState({ name: "", phone: "", relationship: "" });
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("emergency_contacts").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => qc.invalidateQueries();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = emergencyContactSchema.safeParse(form);
    if (!r.success) return void toast.error(firstIssue(r));
    setBusy(true);
    try { await add({ data: r.data }); setForm({ name: "", phone: "", relationship: "" }); toast.success("Contact saved"); await refresh(); }
    catch (err) { showError(err); } finally { setBusy(false); }
  }

  async function remove(c: { id: string; name: string; phone: string; relationship: string | null }) {
    try {
      await del({ data: { id: c.id } });
      await refresh();
      toast("Contact removed", {
        action: { label: "Undo", onClick: async () => {
          try { await add({ data: { name: c.name, phone: c.phone, relationship: c.relationship ?? undefined } }); await refresh(); }
          catch (err) { showError(err); }
        } },
      });
    } catch (err) { showError(err); }
  }

  return (
    <>
      <PageTitle title="Emergency contacts" sub="People you can call fast." />
      <div className="mt-6 space-y-3">
        {q.isLoading ? <LoadingState /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> :
          !q.data?.length ? <EmptyState title="No contacts yet">Add someone you trust below.</EmptyState> :
          q.data.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="flex-1">
                <p className="text-lg font-semibold">{c.name} {c.is_demo && <Badge variant="secondary">Sample</Badge>}</p>
                <p className="text-muted-foreground">{c.relationship ?? "Contact"} · {c.phone}</p>
              </div>
              <Button asChild size="icon" aria-label={`Call ${c.name}`}><a href={`tel:${c.phone.replace(/[^0-9+]/g, "")}`}><Phone /></a></Button>
              <Button size="icon" variant="ghost" aria-label={`Remove ${c.name}`} onClick={() => remove(c)}><Trash2 /></Button>
            </div>
          ))}
      </div>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Add a contact</h2>
        {([["name", "Name", "text"], ["phone", "Phone", "tel"], ["relationship", "Relationship (optional)", "text"]] as const).map(([k, l, t]) => (
          <div key={k} className="space-y-2">
            <Label htmlFor={`c-${k}`} className="text-base">{l}</Label>
            <Input id={`c-${k}`} type={t} className="h-12 text-base" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save contact"}</Button>
      </form>
    </>
  );
}
