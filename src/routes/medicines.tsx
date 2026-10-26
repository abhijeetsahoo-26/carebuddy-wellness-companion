import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState } from "@/components/States";

export const Route = createFileRoute("/medicines")({
  head: () => ({
    meta: [
      { title: "Medicines · CareBuddy" },
      { name: "description", content: "Your medicines and reminders." },
      { property: "og:title", content: "Medicines · CareBuddy" },
      { property: "og:description", content: "Your medicines and reminders." },
    ],
  }),
  component: () => (
    <AppShell>
      <PageTitle title="Medicines" />
      <div className="mt-6"><EmptyState title="No medicines yet">Medicine reminders are coming soon.</EmptyState></div>
    </AppShell>
  ),
});
