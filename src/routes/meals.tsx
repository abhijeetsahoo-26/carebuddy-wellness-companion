import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState } from "@/components/States";

export const Route = createFileRoute("/meals")({
  head: () => ({
    meta: [
      { title: "Meals · CareBuddy" },
      { name: "description", content: "Note what you ate each day." },
      { property: "og:title", content: "Meals · CareBuddy" },
      { property: "og:description", content: "Note what you ate each day." },
    ],
  }),
  component: () => (
    <AppShell>
      <PageTitle title="Meals" />
      <div className="mt-6"><EmptyState title="No meals noted yet">Meal notes are coming soon.</EmptyState></div>
    </AppShell>
  ),
});
