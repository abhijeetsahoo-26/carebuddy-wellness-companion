import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell, PageTitle } from "@/components/AppShell";
import { exportMyData, deleteMyAccount } from "@/lib/carebuddy.functions";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/lib/errors";

export const Route = createFileRoute("/my-data")({
  head: () => ({
    meta: [
      { title: "My data · CareBuddy" },
      { name: "description", content: "Download or delete everything CareBuddy stores about you." },
      { property: "og:title", content: "My data · CareBuddy" },
      { property: "og:description", content: "Download or delete everything CareBuddy stores about you." },
    ],
  }),
  component: () => <AppShell><MyData /></AppShell>,
});

function MyData() {
  const exp = useServerFn(exportMyData);
  const del = useServerFn(deleteMyAccount);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [file, setFile] = useState<Blob | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");

  async function prepare() {
    setBusy(true);
    try { setFile(new Blob([await exp()], { type: "application/json" })); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }

  function save() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `carebuddy-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function deleteAll() {
    setBusy(true);
    try {
      await del({ data: { confirm } });
      qc.clear();
      await supabase.auth.signOut();
      toast.success("Your account and all your data have been deleted.");
      navigate({ to: "/auth", replace: true });
    } catch (e) { showError(e); setBusy(false); }
  }

  return (
    <>
      <PageTitle title="My data" />
      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Download my data</h2>
        <p className="mt-1 text-muted-foreground">Get a copy of everything we store about you, as a file.</p>
        {file ? (
          <Button size="lg" className="mt-4 w-full" onClick={save}><Download /> Save my file</Button>
        ) : (
          <Button size="lg" variant="outline" className="mt-4 w-full" disabled={busy} onClick={prepare}>
            {busy ? "Preparing…" : "Prepare my file"}
          </Button>
        )}
      </section>

      <section className="mt-6 rounded-2xl border bg-emergency-soft p-5">
        <h2 className="text-xl font-semibold">Delete my account and all data</h2>
        <p className="mt-1">This removes your account and everything in it. It cannot be undone.</p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="lg" variant="destructive" className="mt-4 w-full"><Trash2 /> Delete everything</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete everything?</AlertDialogTitle>
              <AlertDialogDescription>Your account, profile, contacts and activity will be removed forever. Type DELETE to confirm.</AlertDialogDescription>
            </AlertDialogHeader>
            <Label htmlFor="confirm-del" className="sr-only">Type DELETE</Label>
            <Input id="confirm-del" className="h-12 text-base" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <AlertDialogFooter>
              <AlertDialogCancel>Keep my account</AlertDialogCancel>
              <AlertDialogAction disabled={confirm !== "DELETE" || busy} onClick={(e) => { e.preventDefault(); deleteAll(); }}>
                {busy ? "Deleting…" : "Delete forever"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </>
  );
}
