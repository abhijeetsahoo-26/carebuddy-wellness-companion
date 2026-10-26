import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageTitle } from "@/components/AppShell";
import { EmptyState } from "@/components/States";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Doctor's Plan · CareBuddy" },
      { name: "description", content: "Your medicines, as your doctor wrote them." },
      { property: "og:title", content: "Doctor's Plan · CareBuddy" },
      { property: "og:description", content: "Your medicines, as your doctor wrote them." },
    ],
  }),
  component: () => (
    <AppShell>
      <PageTitle title="Doctor's Plan" sub="Your medicines, as your doctor wrote them." />
      <div className="mt-6"><EmptyState title="No plan yet">Adding your doctor's plan is coming soon.</EmptyState></div>
    </AppShell>
  ),
});
