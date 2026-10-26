import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy · CareBuddy" },
      { name: "description", content: "How CareBuddy collects, uses and protects your information." },
      { property: "og:title", content: "Privacy policy · CareBuddy" },
      { property: "og:description", content: "How CareBuddy collects, uses and protects your information." },
    ],
  }),
  component: () => (
    <InfoPage title="Privacy policy">
      <p>Last updated: October 2026 (version 2026-10-v1).</p>
      <h2>What CareBuddy is</h2>
      <p>CareBuddy helps you remember and keep track of your medicines, meals and how you feel. It is not a doctor, pharmacist, medical device or emergency service.</p>
      <h2>What we collect</h2>
      <p>Only what you type in: your email, name, age group, allergies, conditions, doctor and pharmacist details, food choice, emergency contacts, and your activity in the app. See “What we store” for the full list.</p>
      <h2>Why</h2>
      <p>To show you reminders, keep your records in one place, and help you reach the people you trust.</p>
      <h2>Who can see it</h2>
      <p>Only you. If you choose to share with someone, only they can see what you shared, and you can stop at any time.</p>
      <h2>What we never do</h2>
      <p>We never sell your data. We never share it with advertisers. We never call or message emergency services for you.</p>
      <h2>Your choices</h2>
      <p>You can download all your data, or delete your account and all your data, from More → Download or delete my data.</p>
      <h2>Location</h2>
      <p>CareBuddy does not collect your location.</p>
    </InfoPage>
  ),
});
