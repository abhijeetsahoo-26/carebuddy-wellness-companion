import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/States";
import { useAuth } from "@/hooks/useAuth";
import { acceptCaregiverInvite } from "@/lib/caregiver.functions";
import { friendlyMessage } from "@/lib/errors";

export const Route = createFileRoute("/caregiver-invite/$token")({
  head: () => ({
    meta: [
      { title: "Caregiver invite · CareBuddy" },
      { name: "description", content: "Accept an invite to see someone's CareBuddy updates, read-only." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Caregiver invite · CareBuddy" },
      { property: "og:description", content: "Accept an invite to see someone's CareBuddy updates, read-only." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Invite,
});

function Invite() {
  const { token } = Route.useParams();
  const { session, loading } = useAuth();
  const accept = useServerFn(acceptCaregiverInvite);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[A-Za-z0-9_-]{32,128}$/.test(token);

  useEffect(() => { if (valid && !loading && !session) sessionStorage.setItem("cb_invite", token); }, [valid, loading, session, token]);

  async function go() {
    setBusy(true);
    try {
      await accept({ data: { token } });
      sessionStorage.removeItem("cb_invite");
      navigate({ to: "/caregiving" });
    } catch (e) { sessionStorage.removeItem("cb_invite"); setError(friendlyMessage(e)); setBusy(false); }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10">
      <h1 className="text-3xl font-bold">Caregiver invite</h1>
      {!valid ? <p className="mt-4 text-lg">This invite is not available.</p> : loading ? <LoadingState /> : !session ? (
        <>
          <p className="mt-4 text-lg">Someone invited you to see some of their CareBuddy updates, read-only. Please sign in or create your own account first.</p>
          <Button asChild size="lg" className="mt-6 w-full"><Link to="/auth">Sign in to continue</Link></Button>
        </>
      ) : (
        <>
          <p className="mt-4 text-lg">You will see only what they chose to share, such as dose counts or appointments. You cannot change anything. They can stop sharing at any time.</p>
          {error && <p role="alert" className="mt-4 rounded-xl border-2 border-emergency bg-emergency-soft p-4 text-lg">{error}</p>}
          <Button size="lg" className="mt-6 w-full" disabled={busy || !!error} onClick={go}>{busy ? "Accepting…" : "Accept invite"}</Button>
        </>
      )}
      <p className="mt-10 text-center text-sm text-muted-foreground">CareBuddy is not a doctor or emergency service.</p>
    </main>
  );
}
