import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/what-we-store")({
  head: () => ({
    meta: [
      { title: "What we store · CareBuddy" },
      { name: "description", content: "A plain list of every piece of information CareBuddy keeps." },
      { property: "og:title", content: "What we store · CareBuddy" },
      { property: "og:description", content: "A plain list of every piece of information CareBuddy keeps." },
    ],
  }),
  component: () => (
    <InfoPage title="What we store">
      {[
        ["Your account", "Email address and a secure password (we cannot read your password)."],
        ["Your agreement", "The date and time you agreed to this privacy notice, and which version."],
        ["About you", "Name, age group, allergies, health conditions (optional), food choice. All entered by you."],
        ["Your care team", "Doctor's name and phone, pharmacist's name and phone (optional)."],
        ["Emergency contacts", "Name, phone and relationship of the people you add."],
        ["Activity", "When medicines, your Doctor's Plan or contacts were added, changed or removed, and by whom."],
        ["Sample data", "If you try sample data, it is marked “Sample” and removed when you tap Remove."],
      ].map(([h, p]) => (
        <section key={h}><h2>{h}</h2><p>{p}</p></section>
      ))}
    </InfoPage>
  ),
});
