import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { EmergencyDirectory } from "@/components/EmergencyDirectory";

export const Route = createFileRoute("/emergency")({
  head: () => ({
    meta: [
      { title: "Emergency help · CareBuddy" },
      { name: "description", content: "Call 112 or 108 in one tap." },
      { property: "og:title", content: "Emergency help · CareBuddy" },
      { property: "og:description", content: "Call 112 or 108 in one tap." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Emergency,
});

function Emergency() {
  return (
    <main className="mx-auto min-h-screen max-w-xl bg-emergency-soft px-5 py-8">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-semibold text-foreground">
        <ArrowLeft className="size-5" /> Back
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Need help now?</h1>
      <p className="mt-3 text-lg">
        If you have chest pain or pressure, trouble breathing, or feel very unwell, call now.
      </p>
      <div className="mt-8">
        <EmergencyDirectory />
      </div>
      <p className="mt-8 text-base text-muted-foreground">
        CareBuddy does not call anyone for you. Tapping a button opens your phone's dialer; only you can place the call. Please check these numbers work in your area.
      </p>
      <p className="mt-3 text-base text-muted-foreground">
        This app cannot detect a heart attack or diagnose anything. I'm not a doctor. Please follow
        your doctor's advice.
      </p>
    </main>
  );
}
