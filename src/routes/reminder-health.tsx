import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell, PageTitle } from "@/components/AppShell";
import { ErrorState, LoadingState } from "@/components/States";
import { useReminderSettings } from "@/hooks/useReminderSettings";
import { currentSubscription, inIframe, isInstalled, isIOS, permission } from "@/lib/push-client";
import { formatDateTimeIST } from "@/lib/time";

export const Route = createFileRoute("/reminder-health")({
  head: () => ({
    meta: [
      { title: "Reminder health · CareBuddy" },
      { name: "description", content: "Check that medicine reminders can reach you." },
      { property: "og:title", content: "Reminder health · CareBuddy" },
      { property: "og:description", content: "Check that medicine reminders can reach you." },
    ],
  }),
  component: () => <AppShell><Health /></AppShell>,
});

type Local = { perm: string; installed: boolean; ios: boolean; iframe: boolean; thisDevice: boolean };

function Row({ ok, title, children }: { ok: boolean; title: string; children?: React.ReactNode }) {
  return (
    <li className="rounded-2xl border bg-card p-5">
      <div className="flex items-start gap-3">
        {ok ? <CheckCircle2 className="mt-1 size-6 shrink-0 text-primary" aria-label="OK" /> : <AlertCircle className="mt-1 size-6 shrink-0 text-emergency" aria-label="Needs attention" />}
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {children && <div className="mt-1 text-muted-foreground">{children}</div>}
        </div>
      </div>
    </li>
  );
}

function Health() {
  const q = useReminderSettings();
  const [local, setLocal] = useState<Local | null>(null);

  useEffect(() => {
    (async () => {
      const sub = await currentSubscription().catch(() => null);
      setLocal({ perm: permission(), installed: isInstalled(), ios: isIOS(), iframe: inIframe(), thisDevice: !!sub && !!q.data?.endpoints.includes(sub.endpoint) });
    })();
  }, [q.data]);

  if (q.isLoading || !local) return <LoadingState />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data?.settings;
  const sent = s?.last_test_sent_at;
  const got = s?.last_test_received_at;
  const testOk = !!sent && !!got && new Date(got) >= new Date(sent);
  const fixSteps = local.ios
    ? "On iPhone: tap Share → Add to Home Screen. Open CareBuddy from the Home Screen, then go to More → Reminders and turn reminders on. Tap Allow when asked."
    : "On Android: allow notifications for CareBuddy when asked. In phone Settings → Apps → your browser (or CareBuddy) → Battery, choose Unrestricted so reminders are not delayed.";

  return (
    <>
      <PageTitle title="Reminder health" sub="Checks that reminders can reach this device." />
      {local.iframe && <p className="mt-4 rounded-2xl bg-secondary p-4">You are viewing CareBuddy inside a preview. Open it in its own tab or on your phone to check this device.</p>}
      <ul className="mt-6 space-y-3">
        <Row ok={!!s?.enabled} title={s?.enabled ? "Reminders are on" : "Reminders are off"}>
          {!s?.enabled && <>Turn them on in <Link to="/settings/reminders" className="font-semibold text-primary underline">Reminder settings</Link>.</>}
        </Row>
        <Row ok={local.perm === "granted"} title={local.perm === "granted" ? "Notifications are allowed" : local.perm === "denied" ? "Notifications are blocked" : local.perm === "unsupported" ? "This browser can't show notifications" : "Notifications not allowed yet"}>
          {local.perm !== "granted" && fixSteps}
        </Row>
        <Row ok={local.installed} title={local.installed ? "Added to your Home Screen" : "Not added to your Home Screen"}>
          {!local.installed && (local.ios
            ? "iPhone needs this for reminders: tap Share → Add to Home Screen, then open CareBuddy from there."
            : "Recommended: open your browser menu and choose Install app or Add to Home screen.")}
        </Row>
        <Row ok={local.thisDevice} title={local.thisDevice ? "This device is set up for reminders" : "This device is not set up yet"}>
          {!local.thisDevice && <>Go to <Link to="/settings/reminders" className="font-semibold text-primary underline">Reminder settings</Link> and turn reminders on from this device.</>}
        </Row>
        <Row ok={testOk} title={!sent ? "No test sent yet" : testOk ? "Last test arrived" : "Last test has not arrived"}>
          {sent && <>Sent {formatDateTimeIST(sent)}{got ? `, arrived ${formatDateTimeIST(got)}` : ""}. </>}
          {!testOk && fixSteps}
        </Row>
      </ul>
      <Button asChild size="lg" variant="outline" className="mt-6 w-full"><Link to="/settings/reminders">Send a test reminder</Link></Button>
    </>
  );
}
