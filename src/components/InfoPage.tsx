import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

// Public reading pages (privacy, what we store) — readable before sign-in.
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <button onClick={() => router.history.back()} className="inline-flex min-h-11 items-center gap-2 font-semibold">
        <ArrowLeft className="size-5" /> Back
      </button>
      <h1 className="mt-4 text-3xl font-bold">{title}</h1>
      <div className="mt-6 space-y-5 text-lg [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold">{children}</div>
      <p className="mt-10 text-center text-sm text-muted-foreground">CareBuddy is not a doctor or emergency service.</p>
    </main>
  );
}
