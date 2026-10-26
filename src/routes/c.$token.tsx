import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardView } from "@/components/CardView";
import { getPublicCard } from "@/lib/tracking.functions";

export const Route = createFileRoute("/c/$token")({
  loader: async ({ params }) => {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(params.token)) return { card: null };
    return getPublicCard({ data: { token: params.token } });
  },
  head: () => ({
    meta: [
      { title: "Emergency card · CareBuddy" },
      { name: "description", content: "A shared CareBuddy emergency card." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Emergency card · CareBuddy" },
      { property: "og:description", content: "A shared CareBuddy emergency card." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SharedCard,
});

function SharedCard() {
  const { card } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-8">
      {card ? <CardView card={card} /> : (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold">This card isn't available</h1>
          <p className="mt-2 text-lg">The link may have been turned off by its owner.</p>
        </div>
      )}
      <Button asChild variant="emergency" size="lg" className="mt-6 w-full"><a href="tel:112"><Phone /> Call 112 · Emergency</a></Button>
      <p className="mt-4 text-center"><Link to="/emergency" className="font-semibold underline">All emergency numbers</Link></p>
    </main>
  );
}
