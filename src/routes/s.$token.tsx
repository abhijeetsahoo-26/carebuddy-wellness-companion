import { createFileRoute } from "@tanstack/react-router";
import { SummaryView } from "@/components/SummaryView";
import { getSharedSummary } from "@/lib/summary.functions";
import { NOT_AVAILABLE, SUMMARY_FOOTER } from "@/lib/summary";

export const Route = createFileRoute("/s/$token")({
  loader: async ({ params }) => {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(params.token)) return { doc: null };
    return getSharedSummary({ data: { token: params.token } });
  },
  staleTime: Infinity,
  head: () => ({
    meta: [
      { title: "Patient summary · CareBuddy" },
      { name: "description", content: "A read-only patient summary shared through CareBuddy." },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Patient summary · CareBuddy" },
      { property: "og:description", content: "A read-only patient summary shared through CareBuddy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Shared,
});

function Shared() {
  const { doc } = Route.useLoaderData();
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      {doc ? <SummaryView doc={doc} /> : (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <h1 className="text-2xl font-semibold">{NOT_AVAILABLE}</h1>
          <p className="mt-4 text-sm text-muted-foreground">{SUMMARY_FOOTER}</p>
        </div>
      )}
    </main>
  );
}
