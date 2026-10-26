import { Link } from "@tanstack/react-router";
import { Bell, Utensils, ClipboardList, Frown, NotebookPen, FileText, Siren, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Bell, title: "Medicine reminders and refills", text: "Reminders at the times your doctor set, and a nudge when your supply runs low." },
  { icon: Utensils, title: "Meal log", text: "Write down what you ate, with the time, in a few taps." },
  { icon: ClipboardList, title: "Your doctor's plan", text: "Keep the medicines, diet rules and limits your doctor gave you in one place." },
  { icon: Frown, title: "\"I feel unwell\" check", text: "Simple questions, with emergency numbers one tap away." },
  { icon: NotebookPen, title: "Symptom diary", text: "A timeline of how you have been feeling." },
  { icon: FileText, title: "Doctor-ready summary", text: "A clear summary of what you logged to show your doctor." },
];

const STEPS = [
  { title: "Add your doctor's plan", text: "Enter the medicines and advice your doctor gave you." },
  { title: "Log your day", text: "Mark doses, meals, water, sleep and how you feel." },
  { title: "Share a summary with your doctor", text: "Show it on your phone, print it, or send a private link." },
];

const FAQ = [
  { q: "Does it replace my doctor?", a: "No. CareBuddy is a reminder and tracking helper. Always follow your doctor's advice." },
  { q: "Can it recommend medicine?", a: "No. It only shows the medicines you entered from your doctor's plan." },
  { q: "Who can see my data?", a: "Only you, unless you choose to share it." },
  { q: "Can I delete my data?", a: "Yes, anytime. You can also download a copy first." },
  { q: "Does it work on my phone?", a: "Yes. It works in your phone's browser, and you can add it to your Home Screen." },
  { q: "Is it free?", a: "Yes, it is free to use right now." },
];

export function Landing() {
  return (
    <div className="mx-auto min-h-screen max-w-xl px-5 pb-36 pt-8 md:max-w-3xl">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl font-bold text-primary">CareBuddy</span>
        <Button asChild variant="ghost" size="lg"><Link to="/auth">Log in</Link></Button>
      </header>

      <main>
        <section className="mt-12" aria-labelledby="hero">
          <h1 id="hero" className="text-4xl font-bold leading-tight md:text-5xl">Your calm daily health companion</h1>
          <p className="mt-4 text-lg text-muted-foreground">Medicine reminders, meal and symptom tracking, and a summary to show your doctor.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth">Log in</Link></Button>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="what">
          <h2 id="what" className="text-2xl font-bold">What it does</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border bg-card p-5">
                <Icon className="size-7 text-primary" aria-hidden />
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-16" aria-labelledby="how">
          <h2 id="how" className="text-2xl font-bold">How it works</h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border bg-card p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-hidden>{i + 1}</span>
                <div><h3 className="text-lg font-semibold">{s.title}</h3><p className="mt-1 text-muted-foreground">{s.text}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-16 rounded-2xl border-2 border-primary bg-secondary/60 p-5" aria-labelledby="safety">
          <h2 id="safety" className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="size-7 text-primary" aria-hidden /> Safety and privacy</h2>
          <ul className="mt-3 list-disc space-y-2 pl-6 text-lg">
            <li>CareBuddy is not a doctor, pharmacist or emergency service.</li>
            <li>It never diagnoses or recommends medicines.</li>
            <li>It follows only the plan you enter from your doctor.</li>
            <li>Your data is private. You can download or delete it anytime.</li>
          </ul>
          <p className="mt-4 rounded-xl border-2 border-emergency bg-emergency-soft p-4 text-lg font-semibold">
            CareBuddy cannot detect a heart attack or diagnose anything. If you have chest pain, pressure, trouble breathing or feel very unwell, call 112 now.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6">
            <Link to="/privacy" className="inline-flex min-h-11 items-center text-lg font-semibold text-primary underline underline-offset-4">Privacy policy</Link>
            <Link to="/what-we-store" className="inline-flex min-h-11 items-center text-lg font-semibold text-primary underline underline-offset-4">What we store</Link>
          </div>
        </section>

        <section className="mt-16" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-bold">Questions</h2>
          <div className="mt-4 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="rounded-2xl border bg-card p-5">
                <summary className="min-h-11 cursor-pointer text-lg font-semibold">{f.q}</summary>
                <p className="mt-2 text-lg text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t pt-6 text-center">
        <p className="text-muted-foreground">CareBuddy is not a doctor or emergency service. In an emergency call 112.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-x-6">
          <Link to="/privacy" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">Privacy policy</Link>
          <Link to="/emergency" className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">Emergency numbers</Link>
        </div>
      </footer>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <Button asChild variant="emergency" size="lg" className="w-full"><Link to="/emergency"><Siren /> Emergency help</Link></Button>
        </div>
      </div>
    </div>
  );
}
