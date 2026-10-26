import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { BellRing, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ErrorState, LoadingState } from "@/components/States";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { getPushPublicKey, savePushSubscription, saveReminderSettings, sendTestReminder } from "@/lib/medicines.functions";
import { enablePush, ENABLE_MESSAGES } from "@/lib/push-client";
import { reminderSettingsSchema, firstIssue } from "@/lib/validation";
import { showError } from "@/lib/errors";

export const Route = createFileRoute("/settings/reminders")({
  head: () => ({
    meta: [
      { title: "Reminder settings · CareBuddy" },
      { name: "description", content: "Turn medicine reminders on or off and set quiet hours." },
      { property: "og:title", content: "Reminder settings · CareBuddy" },
      { property: "og:description", content: "Turn medicine reminders on or off and set quiet hours." },
    ],
  }),
  component: () => <AppShell><ReminderSettings /></AppShell>,
});

function ReminderSettings() {
  const qc = useQueryClient();
  const q = useReminderSettings();
  const getKey = useServerFn(getPushPublicKey);
  const saveSub = useServerFn(savePushSubscription);
  const saveSettings = useServerFn(saveReminderSettings);
  const test = useServerFn(sendTestReminder);
  const [busy, setBusy] = useState(false);
  const [quiet, setQuiet] = useState({ start: "", end: "" });

  useEffect(() => {
    const s = q.data?.settings;
    if (s) setQuiet({ start: s.quiet_start?.slice(0, 5) ?? "", end: s.quiet_end?.slice(0, 5) ?? "" });
  }, [q.data?.settings]);

  if (q.isLoading) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const enabled = !!q.data?.settings?.enabled;
  const reload = () => qc.invalidateQueries({ queryKey: ["reminder-settings"] });

  async function persist(next: { enabled: boolean; start: string; end: string }) {
    const r = reminderSettingsSchema.safeParse({ enabled: next.enabled, quiet_start: next.start || null, quiet_end: next.end || null });
    if (!r.success) { toast.error(firstIssue(r)); return false; }
    await saveSettings({ data: r.data });
    await reload();
    return true;
  }

  async function toggle(on: boolean) {
    setBusy(true);
    try {
      if (on) {
        const res = await enablePush(async () => (await getKey()).publicKey, (s) => saveSub({ data: s }));
        if (res !== "ok") { toast.error(ENABLE_MESSAGES[res]); return; }
        await persist({ enabled: true, ...quiet });
        toast.success("Reminders are on for this device");
      } else {
        await persist({ enabled: false, ...quiet });
        toast("Reminders are off");
      }
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function saveQuiet() {
    setBusy(true);
    try { if (await persist({ enabled, ...quiet })) toast.success("Quiet hours saved"); }
    catch (e) { showError(e); } finally { setBusy(false); }
  }

  async function sendTest() {
    setBusy(true);
    try {
      const r = await test();
      await reload();
      if (r.status === "sent") toast.success("Test sent. It should arrive in a few seconds.");
      else if (r.status === "no_device") toast.error("No device is set up yet. Turn reminders on first.");
      else toast.error("The test could not be delivered. See Reminder health for help.");
    } catch (e) { showError(e); } finally { setBusy(false); }
  }

  return (
    <>
      <PageTitle title="Reminders" sub="Gentle reminders when it's time for your medicine." />

      <section className="mt-6 flex items-center gap-4 rounded-2xl border bg-card p-5">
        <div className="flex-1">
          <Label htmlFor="rem-on" className="text-xl font-semibold">Medicine reminders</Label>
          <p className="text-muted-foreground">{enabled ? "On" : "Off"}. Your lock screen will only say “Time for your medicine”.</p>
        </div>
        <Switch id="rem-on" checked={enabled} disabled={busy} onCheckedChange={toggle} className="scale-125" />
      </section>

      <section className="mt-6 rounded-2xl border bg-card p-5">
        <h2 className="text-xl font-semibold">Quiet hours</h2>
        <p className="mt-1 text-muted-foreground">Medicine reminders wait until quiet hours end. India time. Leave empty for none.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label htmlFor="q-start" className="text-base">From</Label>
            <Input id="q-start" type="time" className="h-12 text-base" value={quiet.start} onChange={(e) => setQuiet({ ...quiet, start: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="q-end" className="text-base">Until</Label>
            <Input id="q-end" type="time" className="h-12 text-base" value={quiet.end} onChange={(e) => setQuiet({ ...quiet, end: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button disabled={busy} onClick={saveQuiet}>Save quiet hours</Button>
          {(quiet.start || quiet.end) && <Button variant="ghost" disabled={busy} onClick={() => setQuiet({ start: "", end: "" })}>Clear</Button>}
        </div>
      </section>

      <div className="mt-6 grid gap-3">
        <Button size="lg" variant="outline" disabled={busy} onClick={sendTest}><BellRing /> Send test reminder</Button>
        <Button asChild size="lg" variant="ghost"><Link to="/reminder-health"><HeartPulse /> Check reminder health</Link></Button>
      </div>
    </>
  );
}
